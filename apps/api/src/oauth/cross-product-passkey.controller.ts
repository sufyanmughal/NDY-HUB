import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { OAuthClientService } from './oauth-client.service';
import { OAuthTokenService, scopesGrantClaims } from './oauth-token.service';
import { IdentityService } from '../identity/identity.service';
import { AuthService } from '../auth/auth.service';
import { PasskeyService, RelyingPartyKey } from '../auth/passkey.service';
import {
  BeginCrossProductPasskeyRegistrationDto,
  VerifyCrossProductPasskeyRegistrationDto,
  BeginCrossProductPasskeyLoginDto,
  VerifyCrossProductPasskeyLoginDto,
} from './dto/passkey-cross-product.dto';

// Face ID / Touch ID / Passkey for non-NDYHUB products (NDYMAIL, future
// others). WebAuthn credentials are bound to a single origin by the spec
// itself (see PasskeyService's RELYING_PARTIES doc comment) — a passkey
// made for ndyhub.com cannot authenticate ndymail.com, so each product
// needing its own biometric login needs its own real ceremony against
// its own origin, not a redirect or a token relay the way the password
// grant works. Server-to-server only, same client_id/client_secret
// authentication as TokenController — the browser never talks to these
// routes directly, NDYMAIL's own backend proxies the WebAuthn options/
// verify round trip.
//
// Which client_id maps to which relying party is a real allow-list, not
// something a caller specifies freely — a caller passing an arbitrary
// rpKey string would let it claim to be any origin's ceremony, defeating
// the entire phishing-resistance property passkeys exist for. Same "one
// deliberate exception, not an open door" reasoning as
// PASSWORD_GRANT_ALLOWED_CLIENT_IDS.
const CROSS_PRODUCT_PASSKEY_CLIENTS: Record<string, RelyingPartyKey> =
  Object.fromEntries(
    (process.env.OAUTH_PASSKEY_CLIENT_MAP ?? '')
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => pair.split(':').map((s) => s.trim())),
  ) as Record<string, RelyingPartyKey>;

@Controller('oauth/passkeys')
export class CrossProductPasskeyController {
  constructor(
    private readonly clients: OAuthClientService,
    private readonly identity: IdentityService,
    private readonly auth: AuthService,
    private readonly passkeys: PasskeyService,
    private readonly tokens: OAuthTokenService,
  ) {}

  private async authenticateClient(
    clientId: string,
    clientSecret: string,
  ): Promise<{ client: { id: string; clientId: string }; rpKey: RelyingPartyKey }> {
    const client = await this.clients
      .findByClientId(clientId)
      .catch(() => null);
    if (!client || !this.clients.verifySecret(client, clientSecret)) {
      throw new UnauthorizedException('Invalid client credentials.');
    }
    const rpKey = CROSS_PRODUCT_PASSKEY_CLIENTS[clientId];
    if (!rpKey) {
      throw new ForbiddenException(
        'This client is not authorized for cross-product passkeys.',
      );
    }
    return { client, rpKey };
  }

  // Requires re-confirming the account's password — there's no NDYHUB
  // session to prove identity here (NDYMAIL never has one), and the
  // OAuth refresh_token NDYMAIL already holds isn't reused for this on
  // purpose (see PasskeyService's doc comments): a fresh password check
  // is the standard, well-understood way to gate enrolling a new
  // security credential.
  @Post('register/options')
  async beginRegistration(
    @Body() dto: BeginCrossProductPasskeyRegistrationDto,
  ) {
    const { rpKey } = await this.authenticateClient(
      dto.client_id,
      dto.client_secret,
    );
    const { id: userId } =
      await this.auth.validateCredentialsForPasswordGrant(
        dto.username,
        dto.password,
      );
    return this.passkeys.beginRegistration(userId, rpKey);
  }

  @Post('register/verify')
  async verifyRegistration(
    @Body() dto: VerifyCrossProductPasskeyRegistrationDto,
  ) {
    const { rpKey } = await this.authenticateClient(
      dto.client_id,
      dto.client_secret,
    );
    // The challenge row itself carries the userId (see
    // PasskeyService.beginRegistration) and consumeChallenge checks it —
    // but verifyRegistration's signature takes userId explicitly rather
    // than trusting the challenge alone, so it has to be resolved here
    // too. Re-deriving it from the challenge row directly (not asking the
    // client to send it back) avoids trusting an unauthenticated caller's
    // own claim of which account this is for.
    const userId = await this.resolveChallengeUserId(dto.challengeId);
    return this.passkeys.verifyRegistration(userId, dto, rpKey);
  }

  // Public per client, not per user — same "usernameless/discoverable,
  // no account context yet" reasoning as NDYHUB's own passkey login.
  @Post('login/options')
  async beginLogin(@Body() dto: BeginCrossProductPasskeyLoginDto) {
    const { rpKey } = await this.authenticateClient(
      dto.client_id,
      dto.client_secret,
    );
    return this.passkeys.beginAuthentication(rpKey);
  }

  @Post('login/verify')
  async verifyLogin(
    @Body() dto: VerifyCrossProductPasskeyLoginDto,
    @Headers('x-device-id') deviceId: string | undefined,
    @Req() req: Request,
  ) {
    const { client, rpKey } = await this.authenticateClient(
      dto.client_id,
      dto.client_secret,
    );
    const user = await this.passkeys.verifyAuthenticationForRelyingParty(
      dto,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
      rpKey,
    );
    const fullUser = await this.identity.findById(user.id);
    const registeredClient = await this.clients.findByClientId(
      client.clientId,
    );
    const scope = registeredClient.allowedScopes.includes('openid')
      ? registeredClient.allowedScopes.join(' ')
      : ['openid', ...registeredClient.allowedScopes].join(' ');

    return this.tokens.issueTokenSet({
      userId: fullUser.id,
      ndyId: fullUser.ndyId,
      clientDbId: client.id,
      clientId: client.clientId,
      scope,
      claims: scopesGrantClaims(scope, fullUser),
      deviceId,
    });
  }

  /** register/verify's dto has no userId field by design (an
   * unauthenticated caller shouldn't get to assert whose account this is)
   * — the real answer lives on the WebauthnChallenge row created by
   * beginRegistration, read back via PasskeyService.challengeUserId. */
  private async resolveChallengeUserId(challengeId: string): Promise<string> {
    const userId = await this.passkeys.challengeUserId(challengeId);
    if (!userId) {
      throw new UnauthorizedException(
        'This attempt has expired — try again.',
      );
    }
    return userId;
  }
}
