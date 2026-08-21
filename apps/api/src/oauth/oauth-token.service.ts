import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { sign as signJwt } from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { NotificationCategory, NotificationChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseScope } from './scopes';
import { OidcKeysService } from './oidc-keys.service';
import { SecurityEventService } from '../auth/security-event.service';
import { NotificationService } from '../notifications/notification.service';

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches Session's own refresh TTL

export interface OAuthTokenSet {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export interface OAuthAccessTokenPayload {
  sub: string; // User.id
  ndy_id: string;
  client_id: string;
  scope: string;
  token_use: 'oauth_access';
}

/**
 * Issues tokens scoped to a specific third-party client — deliberately
 * separate from SessionService, which issues NDY HUB's own dashboard
 * session. access_token stays HS256 with the app-wide secret (it's a
 * bearer credential NDY HUB itself verifies via OAuthAccessTokenGuard,
 * never something a relying party needs to check the signature of
 * independently). id_token is RS256, signed with OidcKeysService's
 * private key and verifiable by any relying party via GET
 * /.well-known/jwks.json — see issueTokenSet for why that split exists.
 */
@Injectable()
export class OAuthTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly keys: OidcKeysService,
    private readonly securityEvents: SecurityEventService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * id_token is RS256-signed with NDY HUB's own keypair (OidcKeysService)
   * rather than HS256 with either the app-wide secret or a per-client
   * secret. HS256 with a per-client secret was the original spec-correct
   * idea for confidential clients, but that needs the client secret stored
   * reversibly instead of hashed — a real tradeoff this schema doesn't
   * take. RS256 sidesteps the whole question: the private key never
   * leaves this server, and any relying party (confidential or public)
   * can verify the signature itself using the public key published at
   * GET /.well-known/jwks.json, instead of having to trust the token
   * blindly or fall back to GET /oauth/userinfo the way this comment used
   * to recommend.
   */
  async issueTokenSet(params: {
    userId: string;
    ndyId: string;
    clientDbId: string;
    clientId: string;
    scope: string;
    claims: Record<string, unknown>;
    // Present only when this token set is a *rotation* of an existing
    // refresh token (see rotateRefreshToken below) — the new refresh
    // token carries the same familyId forward so reuse detection can
    // still recognize it as part of the same chain. Omitted on a fresh
    // login (authorization_code grant), which starts a brand new family.
    familyId?: string;
  }): Promise<OAuthTokenSet> {
    const issuer = this.config.getOrThrow<string>('WEB_APP_URL');

    const accessToken = await this.jwt.signAsync(
      {
        sub: params.userId,
        ndy_id: params.ndyId,
        client_id: params.clientId,
        scope: params.scope,
        token_use: 'oauth_access',
      },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const idToken = signJwt(
      {
        iss: issuer,
        sub: params.userId,
        aud: params.clientId,
        token_use: 'id_token',
        ...params.claims,
      },
      this.keys.privateKey,
      {
        algorithm: 'RS256',
        keyid: this.keys.keyId,
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: params.userId,
        clientId: params.clientDbId,
        scope: params.scope,
        familyId: params.familyId ?? randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      access_token: accessToken,
      id_token: idToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: params.scope,
    };
  }

  /**
   * Refresh Token Rotation + Reuse Detection (Phase A of
   * identity-architecture-hardening-plan.md, per the client's explicit
   * "refresh token security must be extremely strong from the beginning"
   * requirement). Every refresh token is single-use: rotating consumes it
   * and issues a new one carrying the same familyId. Presenting a token
   * that's already been rotated (revokedAt already set) is the standard
   * signal it was stolen — the legitimate client already moved on to a
   * newer token, so whoever just presented this one is someone else. The
   * response is to kill the *entire family*, not just the token
   * presented: the legitimate holder's current token dies too, which is
   * an intentional trade-off (same as every major OAuth provider's
   * behavior on detected reuse) — better a forced re-login than leaving a
   * compromised chain alive.
   */
  async rotateRefreshToken(refreshToken: string, clientDbId: string) {
    const record = await this.prisma.oAuthRefreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!record || record.clientId !== clientDbId) {
      throw new UnauthorizedException(
        'Refresh token is invalid, expired, or revoked.',
      );
    }

    if (record.revokedAt) {
      // Reuse detected — this exact token was already exchanged once
      // before. Kill every token in the family, log it, and alert the
      // user, then fail this request the same way any other invalid
      // token would (no different response shape — an attacker probing
      // for a "reuse detected" signal shouldn't get one).
      await this.prisma.oAuthRefreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.securityEvents.record(
        record.userId,
        'OAUTH_TOKEN_REUSE_DETECTED',
      );
      await this.notifications.notify({
        userId: record.userId,
        category: NotificationCategory.SECURITY,
        channel: NotificationChannel.EMAIL,
        title: 'Suspicious activity on your NDY HUB connected apps',
        body: "A login token for one of your connected apps was used more than once, which usually means it was copied or intercepted. We've signed that connection out as a precaution — you may need to reconnect the app.",
        sourceEventId: `oauth-reuse-detected:${record.familyId}`,
      });
      throw new UnauthorizedException(
        'Refresh token is invalid, expired, or revoked.',
      );
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Refresh token is invalid, expired, or revoked.',
      );
    }

    await this.prisma.oAuthRefreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return {
      userId: record.userId,
      ndyId: record.user.ndyId,
      scope: record.scope,
      familyId: record.familyId,
    };
  }

  async verifyAccessToken(token: string): Promise<OAuthAccessTokenPayload> {
    try {
      const payload =
        await this.jwt.verifyAsync<OAuthAccessTokenPayload>(token);
      if (payload.token_use !== 'oauth_access') {
        throw new UnauthorizedException('Not an OAuth access token.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}

export function scopesGrantClaims(
  scope: string,
  user: { ndyId: string; fullName: string | null; email: string },
): Record<string, unknown> {
  const scopes = parseScope(scope);
  const claims: Record<string, unknown> = { ndy_id: user.ndyId };
  if (scopes.includes('profile')) claims.name = user.fullName;
  if (scopes.includes('email')) claims.email = user.email;
  return claims;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
