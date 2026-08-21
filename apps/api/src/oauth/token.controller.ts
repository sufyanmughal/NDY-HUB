import {
  BadRequestException,
  Body,
  Controller,
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
    return this.handleRefreshTokenGrant(dto, client, deviceId);
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
