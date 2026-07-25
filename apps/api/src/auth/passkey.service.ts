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
import { PasskeyRegisterVerifyDto } from './dto/passkey-register-verify.dto';
import { PasskeyLoginVerifyDto } from './dto/passkey-login-verify.dto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes — one ceremony, not a token to carry around

export interface PasskeySummary {
  id: string;
  deviceLabel: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

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
  private readonly rpID: string;
  private readonly origin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    const webAppUrl = config.getOrThrow<string>('WEB_APP_URL');
    this.origin = webAppUrl;
    this.rpID = new URL(webAppUrl).hostname;
  }

  async listPasskeys(userId: string): Promise<PasskeySummary[]> {
    return this.prisma.passkey.findMany({
      where: { userId },
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
  }

  async beginRegistration(userId: string): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
    challengeId: string;
  }> {
    const user = await this.identity.findById(userId);
    const existing = await this.prisma.passkey.findMany({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName: 'NDY HUB',
      rpID: this.rpID,
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
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return { options, challengeId };
  }

  async verifyRegistration(
    userId: string,
    dto: PasskeyRegisterVerifyDto,
  ): Promise<PasskeySummary> {
    const challenge = await this.consumeChallenge(
      dto.challengeId,
      'REGISTRATION',
      userId,
    );

    const result = await verifyRegistrationResponse({
      response: dto.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });
    if (!result.verified || !result.registrationInfo) {
      throw new UnauthorizedException(
        'Could not verify this passkey — try again.',
      );
    }

    const { credential } = result.registrationInfo;
    try {
      return await this.prisma.passkey.create({
        data: {
          userId,
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
    } catch {
      // Unique constraint on credentialId — this exact authenticator/key
      // pair is already registered (to this account or another one).
      throw new ConflictException('This passkey is already registered.');
    }
  }

  async beginAuthentication(): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }> {
    // No allowCredentials — usernameless/discoverable. The browser prompts
    // with whatever passkeys it has saved for this site before the server
    // knows who's signing in; the credential the user picks is what
    // resolves to an account in verifyAuthentication below.
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'preferred',
    });

    const { id: challengeId } = await this.prisma.webauthnChallenge.create({
      data: {
        challenge: options.challenge,
        type: 'AUTHENTICATION',
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return { options, challengeId };
  }

  async verifyAuthentication(
    dto: PasskeyLoginVerifyDto,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    const challenge = await this.consumeChallenge(
      dto.challengeId,
      'AUTHENTICATION',
      null,
    );

    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: dto.response.id },
    });
    // Same message either way (unrecognized credential vs. failed
    // cryptographic verification) — no reason to hand back an oracle for
    // which one it was.
    const genericFailure = () =>
      new UnauthorizedException('Could not sign in with this passkey.');
    if (!passkey) throw genericFailure();

    const result = await verifyAuthenticationResponse({
      response: dto.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
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

    return this.sessions.issueSession(user.id, user.ndyId, meta);
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
   * on the delete still closes. */
  private async consumeChallenge(
    challengeId: string,
    type: 'REGISTRATION' | 'AUTHENTICATION',
    userId: string | null,
  ): Promise<{ challenge: string }> {
    const row = await this.prisma.webauthnChallenge.findUnique({
      where: { id: challengeId },
    });
    const expired = new UnauthorizedException(
      'This attempt has expired — try again.',
    );
    if (
      !row ||
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
