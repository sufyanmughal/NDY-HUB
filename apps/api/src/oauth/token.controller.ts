import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuthClientType } from '@prisma/client';
import { OAuthClientService } from './oauth-client.service';
import {
  AuthorizationCodeService,
  verifyPkceChallenge,
} from './authorization-code.service';
import { OAuthTokenService, scopesGrantClaims } from './oauth-token.service';
import { TokenDto } from './dto/token.dto';
import { IdentityService } from '../identity/identity.service';
import { AuthService } from '../auth/auth.service';

// Resource Owner Password Credentials (RFC 6749 §4.3) is deprecated by
// OAuth 2.1 and normally shouldn't exist on a real OIDC provider — it
// means the relying party's own UI collects the user's NDYHUB password
// directly, instead of the user typing it only on ndyhub.com. NDYMAIL's
// login page does this deliberately, by explicit product decision (2026-08-29,
// approved after the security tradeoff was explained), because its login
// screen needs to render its own email/password fields rather than
// redirect to NDYHUB's page. Restricted to an explicit allow-list, not
// opened to every CONFIDENTIAL client, so this stays a one-off exception
// rather than quietly becoming the default way any future NDJOYIT
// product integrates. Adding another client_id here is itself a decision
// worth flagging, not a routine config change.
const PASSWORD_GRANT_ALLOWED_CLIENT_IDS = new Set(
  (process.env.OAUTH_PASSWORD_GRANT_CLIENT_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);

// Server-to-server only — the relying party's backend calls this directly,
// never the browser. Every response shape below matches the standard OIDC
// token endpoint response so an off-the-shelf OIDC client library can talk
// to this without NDY HUB-specific handling.
@Controller('oauth')
export class TokenController {
  constructor(
    private readonly clients: OAuthClientService,
    private readonly codes: AuthorizationCodeService,
    private readonly tokens: OAuthTokenService,
    private readonly identity: IdentityService,
    private readonly auth: AuthService,
  ) {}

  @Post('token')
  async token(
    @Body() dto: TokenDto,
    // Same client-generated device identifier as auth.controller.ts's
    // sessionMeta() — see Device's schema doc comment. A header here too,
    // for the same "applies uniformly without touching the DTO" reason.
    @Headers('x-device-id') deviceId?: string,
  ) {
    const client = await this.clients
      .findByClientId(dto.client_id)
      .catch(() => null);
    if (!client || !this.clients.verifySecret(client, dto.client_secret)) {
      throw new UnauthorizedException('Invalid client credentials.');
    }

    if (dto.grant_type === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(dto, client, deviceId);
    }
    if (dto.grant_type === 'password') {
      return this.handlePasswordGrant(dto, client, deviceId);
    }
    return this.handleRefreshTokenGrant(dto, client, deviceId);
  }

  // See PASSWORD_GRANT_ALLOWED_CLIENT_IDS's doc comment above — this whole
  // grant type is a deliberate, narrow exception, not the normal path.
  private async handlePasswordGrant(
    dto: TokenDto,
    client: { id: string; clientId: string },
    deviceId?: string,
  ) {
    if (!PASSWORD_GRANT_ALLOWED_CLIENT_IDS.has(client.clientId)) {
      throw new ForbiddenException(
        'This client is not authorized to use the password grant.',
      );
    }
    if (!dto.username || !dto.password) {
      throw new BadRequestException(
        'username and password are required for this grant_type.',
      );
    }
    const { id: userId } = await this.auth.validateCredentialsForPasswordGrant(
      dto.username,
      dto.password,
    );
    const user = await this.identity.findById(userId);
    const registeredClient = await this.clients.findByClientId(
      client.clientId,
    );
    // openid is always implicit — same default every other grant type gets
    // via the consent screen's scope list; password grant has no consent
    // screen to derive it from, so it's fixed here to whatever the client
    // asks for, filtered to what NDYMAIL's registered allowedScopes
    // actually permits, same enforcement every other grant is subject to.
    const requestedScopes = (dto.scope ?? 'openid profile email')
      .split(' ')
      .filter(Boolean);
    const grantedScopes = requestedScopes.filter((s) =>
      registeredClient.allowedScopes.includes(s),
    );
    const scope = grantedScopes.includes('openid')
      ? grantedScopes.join(' ')
      : ['openid', ...grantedScopes].join(' ');

    return this.tokens.issueTokenSet({
      userId: user.id,
      ndyId: user.ndyId,
      clientDbId: client.id,
      clientId: client.clientId,
      scope,
      claims: scopesGrantClaims(scope, user),
      deviceId,
    });
  }

  private async handleAuthorizationCodeGrant(
    dto: TokenDto,
    client: { id: string; clientId: string; clientType: OAuthClientType },
    deviceId?: string,
  ) {
    if (!dto.code || !dto.redirect_uri) {
      throw new BadRequestException(
        'code and redirect_uri are required for this grant_type.',
      );
    }
    const authCode = await this.codes.redeem(
      dto.code,
      client.id,
      dto.redirect_uri,
    );

    // PUBLIC clients have no client_secret at all (see
    // OAuthClientService.verifySecret) — PKCE is the *only* thing proving
    // this token request came from whoever obtained the code, so it can't
    // be optional for them the way it is for CONFIDENTIAL clients (who
    // already authenticated with a real secret above, in token()).
    if (
      client.clientType === OAuthClientType.PUBLIC &&
      !authCode.codeChallenge
    ) {
      throw new BadRequestException(
        'PKCE (code_challenge) is required for public clients.',
      );
    }

    if (authCode.codeChallenge) {
      if (!dto.code_verifier) {
        throw new BadRequestException(
          'code_verifier is required — this authorization request used PKCE.',
        );
      }
      if (!verifyPkceChallenge(dto.code_verifier, authCode.codeChallenge)) {
        throw new BadRequestException(
          'code_verifier does not match code_challenge.',
        );
      }
    }

    const user = await this.identity.findById(authCode.userId);

    return this.tokens.issueTokenSet({
      userId: user.id,
      ndyId: user.ndyId,
      clientDbId: client.id,
      clientId: client.clientId,
      scope: authCode.scope,
      claims: scopesGrantClaims(authCode.scope, user),
      deviceId,
    });
  }

  private async handleRefreshTokenGrant(
    dto: TokenDto,
    client: { id: string; clientId: string },
    deviceId?: string,
  ) {
    if (!dto.refresh_token) {
      throw new BadRequestException(
        'refresh_token is required for this grant_type.',
      );
    }
    const { userId, ndyId, scope, familyId } =
      await this.tokens.rotateRefreshToken(dto.refresh_token, client.id);
    const user = await this.identity.findById(userId);

    return this.tokens.issueTokenSet({
      userId,
      ndyId,
      clientDbId: client.id,
      clientId: client.clientId,
      scope,
      claims: scopesGrantClaims(scope, user),
      // Carries the same family forward — see rotateRefreshToken's doc
      // comment. Without this, reuse detection would never trigger: every
      // rotation would silently start a fresh, unrelated family instead
      // of extending the chain it's actually part of.
      familyId,
      // Not necessarily the same deviceId the original grant carried
      // (whoever sends the header this time might omit it, or the token
      // could be rotated from a background job on the same device) —
      // deliberately re-resolved on each rotation rather than pinned to
      // whatever the very first grant saw, same "always trust the current
      // request's own signal" reasoning as SessionService.rotateSession.
      deviceId,
    });
  }
}
