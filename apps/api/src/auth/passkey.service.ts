import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { SessionService, SessionMeta, IssuedSession } from './session.service';
import { SecurityEventService } from './security-event.service';
import { PasskeyRegisterVerifyDto } from './dto/passkey-register-verify.dto';
import { PasskeyLoginVerifyDto } from './dto/passkey-login-verify.dto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes — one ceremony, not a token to carry around

export interface PasskeySummary {
  id: string;
  deviceLabel: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

// Cross-product passkey origins. WebAuthn credentials are bound to one
// origin by the spec itself (see Passkey.rpId's schema doc comment) — a
// NDYHUB-created passkey physically cannot authenticate ndymail.com.
// Every product that wants its own Face ID/Touch ID/passkey login needs
// an entry here, same allow-list-not-open-ended principle as
// TokenController's PASSWORD_GRANT_ALLOWED_CLIENT_IDS: adding a product
// is a deliberate decision, not something any caller can request by
// passing an arbitrary origin string (which would let anyone mint
// WebAuthn ceremonies claiming to be any site, defeating the entire
// phishing-resistance property passkeys exist for).
const RELYING_PARTIES: Record<string, { rpID: string; origin: string; rpName: string }> = {
  ndyhub: {
    rpID: 'ndyhub.com',
    origin: 'https://ndyhub.com',
    rpName: 'NDY HUB',
  },
  ndymail: {
    rpID: 'ndymail.com',
    origin: 'https://www.ndymail.com',
    rpName: 'NDYMAIL',
  },
};
export type RelyingPartyKey = keyof typeof RELYING_PARTIES;

/**
 * WebAuthn/passkey registration and login. Kept separate from AuthService
 * and TotpService — same "one auth method per file" split already used for
 * 2FA.
 *
 * A successful passkey sign-in issues a session directly, without also
 * requiring a TOTP code even if the account has 2FA enabled: a passkey is
 * already public-key crypto bound to this specific site (phishing-resistant
 * in a way a password never is) plus a user-verification check on the
 * authenticator itself (biometric/PIN) — it clears a higher bar than
 * "factor 1" already, not a peer of the password step 2FA sits behind.
 */
@Injectable()
export class PasskeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
    private readonly securityEvents: SecurityEventService,
    private readonly config: ConfigService,
  ) {}

  /** NDYHUB's own rpID historically came straight from WEB_APP_URL rather
   * than RELYING_PARTIES['ndyhub']'s hardcoded value — kept reading it
   * from config here (not the constant) so a WEB_APP_URL change (e.g. a
   * staging environment) still works for NDYHUB's own passkeys without
   * needing a matching RELYING_PARTIES edit. Cross-product entries
   * (ndymail, future others) don't have that flexibility need — they're
   * fixed, deliberately allow-listed real production domains. */
  private ndyHubRelyingParty(): { rpID: string; origin: string; rpName: string } {
    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    return {
      rpID: new URL(webAppUrl).hostname,
      origin: webAppUrl,
      rpName: 'NDY HUB',
    };
  }

  /** Cross-product registration/verify is a two-call ceremony
   * (register/options then register/verify) with no NDYHUB session
   * linking them — the account is established once, at the first call,
   * via password re-confirmation (see beginRegistration's caller in
   * CrossProductPasskeyController), then carried forward on the
   * WebauthnChallenge row itself. This reads that back for the second
   * call rather than trusting an unauthenticated caller's own claim of
   * whose account it's registering a credential for. */
  async challengeUserId(challengeId: string): Promise<string | null> {
    const row = await this.prisma.webauthnChallenge.findUnique({
      where: { id: challengeId },
      select: { userId: true },
    });
    return row?.userId ?? null;
  }

  private resolveRelyingParty(rpKey: RelyingPartyKey) {
    if (rpKey === 'ndyhub') return this.ndyHubRelyingParty();
    const rp = RELYING_PARTIES[rpKey];
    if (!rp) {
      throw new UnauthorizedException('Unknown relying party.');
    }
    return rp;
  }

  async listPasskeys(userId: string, rpKey: RelyingPartyKey = 'ndyhub'): Promise<PasskeySummary[]> {
    const { rpID } = this.resolveRelyingParty(rpKey);
    return this.prisma.passkey.findMany({
      where: { userId, rpId: rpID },
      select: {
        id: true,
        deviceLabel: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removePasskey(userId: string, passkeyId: string): Promise<void> {
    const result = await this.prisma.passkey.deleteMany({
      where: { id: passkeyId, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Passkey not found.');
    }
    void this.securityEvents.record(userId, 'PASSKEY_REMOVED');
  }

  async beginRegistration(
    userId: string,
    rpKey: RelyingPartyKey = 'ndyhub',
  ): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
    challengeId: string;
  }> {
    const { rpID, rpName } = this.resolveRelyingParty(rpKey);
    const user = await this.identity.findById(userId);
    const existing = await this.prisma.passkey.findMany({
      where: { userId, rpId: rpID },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userID: isoUint8Array.fromUTF8String(user.id),
      userDisplayName: user.fullName ?? user.email,
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        transports: p.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const { id: challengeId } = await this.prisma.webauthnChallenge.create({
      data: {
        challenge: options.challenge,
        userId,
        type: 'REGISTRATION',
        rpId: rpID,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return { options, challengeId };
  }

  async verifyRegistration(
    userId: string,
    dto: PasskeyRegisterVerifyDto,
    rpKey: RelyingPartyKey = 'ndyhub',
  ): Promise<PasskeySummary> {
    const { rpID, origin } = this.resolveRelyingParty(rpKey);
    const challenge = await this.consumeChallenge(
      dto.challengeId,
      'REGISTRATION',
      userId,
      rpID,
    );

    const result = await verifyRegistrationResponse({
      response: dto.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (!result.verified || !result.registrationInfo) {
      throw new UnauthorizedException(
        'Could not verify this passkey — try again.',
      );
    }

    const { credential } = result.registrationInfo;
    try {
      const passkey = await this.prisma.passkey.create({
        data: {
          userId,
          rpId: rpID,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports ?? [],
          deviceLabel: dto.deviceLabel,
        },
        select: {
          id: true,
          deviceLabel: true,
          createdAt: true,
          lastUsedAt: true,
        },
      });
      void this.securityEvents.record(userId, 'PASSKEY_ADDED');
      return passkey;
    } catch {
      // Unique constraint on credentialId — this exact authenticator/key
      // pair is already registered (to this account or another one).
      throw new ConflictException('This passkey is already registered.');
    }
  }

  async beginAuthentication(rpKey: RelyingPartyKey = 'ndyhub'): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }> {
    const { rpID } = this.resolveRelyingParty(rpKey);
    // No allowCredentials — usernameless/discoverable. The browser prompts
    // with whatever passkeys it has saved for this site before the server
    // knows who's signing in; the credential the user picks is what
    // resolves to an account in verifyAuthentication below.
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    });

    const { id: challengeId } = await this.prisma.webauthnChallenge.create({
      data: {
        challenge: options.challenge,
        type: 'AUTHENTICATION',
        rpId: rpID,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return { options, challengeId };
  }

  async verifyAuthentication(
    dto: PasskeyLoginVerifyDto,
    meta: SessionMeta,
    rpKey: RelyingPartyKey = 'ndyhub',
  ): Promise<IssuedSession> {
    const { user } = await this.verifyAuthenticationCore(dto, rpKey);
    const isNewDevice = await this.securityEvents.isNewDevice(user.id, meta);
    const session = await this.sessions.issueSession(user.id, user.ndyId, meta);
    void this.securityEvents.recordLogin(user.id, meta, isNewDevice);
    return session;
  }

  /** Same cryptographic verification as verifyAuthentication, but returns
   * the resolved user instead of issuing an NDYHUB session — for
   * cross-product callers (CrossProductPasskeyController) that need to
   * wrap the result in an OAuth token set for their own relying party
   * instead of an NDYHUB session cookie. Still records the login as a
   * security event (isNewDevice/recordLogin) — a passkey sign-in through
   * NDYMAIL is just as real a login as one through ndyhub.com and belongs
   * in the same security history. */
  async verifyAuthenticationForRelyingParty(
    dto: PasskeyLoginVerifyDto,
    meta: SessionMeta,
    rpKey: RelyingPartyKey,
  ): Promise<{ id: string; ndyId: string }> {
    const { user } = await this.verifyAuthenticationCore(dto, rpKey);
    const isNewDevice = await this.securityEvents.isNewDevice(user.id, meta);
    void this.securityEvents.recordLogin(user.id, meta, isNewDevice);
    return { id: user.id, ndyId: user.ndyId };
  }

  private async verifyAuthenticationCore(
    dto: PasskeyLoginVerifyDto,
    rpKey: RelyingPartyKey,
  ): Promise<{ user: { id: string; ndyId: string } }> {
    const { rpID, origin } = this.resolveRelyingParty(rpKey);
    const challenge = await this.consumeChallenge(
      dto.challengeId,
      'AUTHENTICATION',
      null,
      rpID,
    );

    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: dto.response.id },
    });
    // Same message either way (unrecognized credential vs. failed
    // cryptographic verification) — no reason to hand back an oracle for
    // which one it was.
    const genericFailure = () =>
      new UnauthorizedException('Could not sign in with this passkey.');
    // rpId mismatch is defense in depth, not the primary guarantee — a
    // real browser physically won't hand back a credential registered for
    // a different origin than the one currently asking (WebAuthn enforces
    // this itself). Still checked explicitly rather than assumed, same
    // "don't trust a single layer" reasoning as everywhere else auth-
    // adjacent in this codebase.
    if (!passkey || passkey.rpId !== rpID) throw genericFailure();

    const result = await verifyAuthenticationResponse({
      response: dto.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });
    if (!result.verified) throw genericFailure();

    const user = await this.identity.findById(passkey.userId);
    if (user.suspended) {
      throw new UnauthorizedException('This account has been suspended.');
    }

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: result.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });

    return { user: { id: user.id, ndyId: user.ndyId } };
  }

  /** Single-use redemption: read the challenge value the verify call below
   * needs (deleteMany can't return it), then delete by id and check the
   * count — same "delete/update then check count" shape every other
   * one-time token in this schema uses to detect replay, just against a
   * standalone table instead of a column on User (registration's
   * challenge has a userId to double-check against; login's doesn't, since
   * the account isn't known until the credential response resolves it).
   * The gap between the read and the delete only matters for a concurrent
   * double-redemption of the *same* challenge row, which the count check
   * on the delete still closes. rpId is checked the same "double-check
   * even though it shouldn't drift" way — a challenge minted for one
   * product's ceremony must never verify against a different product's
   * response. */
  private async consumeChallenge(
    challengeId: string,
    type: 'REGISTRATION' | 'AUTHENTICATION',
    userId: string | null,
    rpID: string,
  ): Promise<{ challenge: string }> {
    const row = await this.prisma.webauthnChallenge.findUnique({
      where: { id: challengeId },
    });
    const expired = new UnauthorizedException(
      'This attempt has expired — try again.',
    );
    if (
      !row ||
      row.rpId !== rpID ||
      row.type !== type ||
      row.expiresAt < new Date() ||
      (userId !== null && row.userId !== userId)
    ) {
      throw expired;
    }

    const deleted = await this.prisma.webauthnChallenge.deleteMany({
      where: { id: challengeId },
    });
    if (deleted.count === 0) throw expired;

    return row;
  }
}
