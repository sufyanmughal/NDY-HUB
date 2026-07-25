import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parseScope } from './scopes';

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
 * session. Signed with the same app-wide JWT secret as everything else
 * here (see the comment on issueTokenSet for why that's a documented
 * phase-1 simplification, not a long-term design).
 */
@Injectable()
export class OAuthTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * id_token is signed with NDY HUB's own app-wide secret rather than each
   * client's individual client_secret (the spec-correct approach for
   * confidential clients using HS256). That would need the client secret
   * stored reversibly instead of hashed — a real tradeoff, not done here.
   * Until this moves to RS256 + a JWKS endpoint (the real fix, works for
   * public clients too), a relying party should treat the id_token as
   * opaque and confirm identity via GET /oauth/userinfo rather than
   * verifying the signature itself.
   */
  async issueTokenSet(params: {
    userId: string;
    ndyId: string;
    clientDbId: string;
    clientId: string;
    scope: string;
    claims: Record<string, unknown>;
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

    const idToken = await this.jwt.signAsync(
      {
        iss: issuer,
        sub: params.userId,
        aud: params.clientId,
        token_use: 'id_token',
        ...params.claims,
      },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: params.userId,
        clientId: params.clientDbId,
        scope: params.scope,
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

  async rotateRefreshToken(refreshToken: string, clientDbId: string) {
    const record = await this.prisma.oAuthRefreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (
      !record ||
      record.revokedAt ||
      record.expiresAt < new Date() ||
      record.clientId !== clientDbId
    ) {
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
