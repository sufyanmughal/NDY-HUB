import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_CODE_TTL_MS = 60_000; // 60 seconds — codes are exchanged immediately, server-to-server
const generateCode = customAlphabet(
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  40,
);

@Injectable()
export class AuthorizationCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(params: {
    userId: string;
    clientId: string;
    redirectUri: string;
    scope: string;
  }) {
    const code = generateCode();
    await this.prisma.oAuthAuthorizationCode.create({
      data: {
        code,
        userId: params.userId,
        clientId: params.clientId,
        redirectUri: params.redirectUri,
        scope: params.scope,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      },
    });
    return code;
  }

  /**
   * Redeems a code exactly once — same updateMany-then-check-count pattern
   * used for login-request approval and CRYNDY webhook idempotency
   * throughout this codebase. A replayed code (already used, or expired)
   * is rejected outright rather than silently re-issuing tokens for it.
   */
  async redeem(code: string, clientId: string, redirectUri: string) {
    const record = await this.prisma.oAuthAuthorizationCode.findUnique({
      where: { code },
    });
    if (!record) {
      throw new BadRequestException('Unknown authorization code.');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Authorization code has expired.');
    }
    if (record.clientId !== clientId) {
      throw new BadRequestException(
        'Authorization code was not issued to this client.',
      );
    }
    if (record.redirectUri !== redirectUri) {
      throw new BadRequestException(
        'redirect_uri does not match the one used to obtain this code.',
      );
    }

    const result = await this.prisma.oAuthAuthorizationCode.updateMany({
      where: { code, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException('This authorization code was already used.');
    }

    return record;
  }
}
