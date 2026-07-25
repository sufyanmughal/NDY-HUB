import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Access tokens are short-lived signed JWTs (stateless, verified in the
 * guard without a database round trip). Refresh tokens are opaque random
 * strings — only their SHA-256 hash is ever stored, so a leaked database
 * row can't be replayed as a credential.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async issueSession(
    userId: string,
    ndyId: string,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    const refreshToken = randomBytes(48).toString('base64url');
    // Created before the JWT is signed so the access token can carry the
    // session's own id (sid) — that's what lets the Security page say
    // "this is the device you're looking at right now" instead of just
    // listing sessions with no way to tell yours apart.
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, ndyId, sid: session.id },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL };
  }

  /**
   * Rotates a refresh token: the old one is revoked the instant a new pair
   * is issued, so a stolen-and-reused refresh token only ever works once.
   */
  async rotateSession(
    refreshToken: string,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(session.userId, session.user.ndyId, meta);
  }

  async revokeSession(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
