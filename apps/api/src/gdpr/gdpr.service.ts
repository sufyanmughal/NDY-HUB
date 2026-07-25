import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Injectable()
export class GdprService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything the spec's "data export" commitment covers: the profile, the
   * account-security surface (sessions, connected websites), and every
   * financial/loyalty record tied to this user. Token hashes and other
   * internal-only fields are deliberately left out — a hash isn't "your
   * data" in the GDPR sense, and exporting it (even hashed) is unnecessary
   * exposure with no benefit to the user reading the export.
   */
  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [sessions, memberships, cryndyPurchases, ndybitsLedger, grants] =
      await Promise.all([
        this.prisma.session.findMany({
          where: { userId },
          select: {
            userAgent: true,
            ip: true,
            createdAt: true,
            expiresAt: true,
            revokedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.membership.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.cryndyPurchase.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.ndybitsLedgerEntry.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.oAuthGrant.findMany({
          where: { userId, revokedAt: null },
          include: { client: { select: { name: true, clientId: true } } },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        ndyId: user.ndyId,
        email: user.email,
        fullName: user.fullName,
        profilePhotoUrl: user.profilePhotoUrl,
        verificationLevel: user.verificationLevel,
        ndyappsConnected: user.ndyappsConnected,
        createdAt: user.createdAt,
      },
      sessions,
      memberships,
      cryndyPurchases,
      ndybitsLedger,
      connectedWebsites: grants.map((g) => ({
        clientName: g.client.name,
        clientId: g.client.clientId,
        scope: g.scope,
        connectedAt: g.createdAt,
      })),
    };
  }

  /**
   * Self-service "right to erasure" — anonymizes the account rather than
   * hard-deleting the User row. CryndyPurchase and Membership carry a
   * required, cascading FK to User; a hard delete would take the financial
   * ledger and purchase history down with it, which GDPR Article 17(3)(b)
   * doesn't actually require erasing (legal/tax retention obligations are
   * one of the standard exceptions to the right to erasure) — and this
   * codebase already made that exact call once, for AuditLogEntry. Session,
   * OAuthGrant, and OAuthRefreshToken are the parts that actually identify
   * "this browser/site is you" going forward, so those get fully revoked.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account has no password set — it was created through NDYAPPS/Google/Apple. Contact support to delete it.',
      );
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const anonymizedEmail = `deleted-${randomUUID()}@ndyhub.invalid`;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          fullName: null,
          profilePhotoUrl: null,
          passwordHash: null,
          suspended: true,
          deletedAt: new Date(),
        },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.oAuthGrant.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.oAuthRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
