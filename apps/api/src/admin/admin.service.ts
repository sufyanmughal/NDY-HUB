import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG } from '../membership/tier-config';

export interface AdminActor {
  id: string;
  ndyId: string;
  ip?: string;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(query: string | undefined, take: number, skip: number) {
    const where = query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' as const } },
            { ndyId: { contains: query, mode: 'insensitive' as const } },
            { fullName: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          ndyId: true,
          email: true,
          fullName: true,
          role: true,
          suspended: true,
          verificationLevel: true,
          ndyappsConnected: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('No user with that id.');

    const [currentMembership, cryndyPurchases, ndybitsAgg, activeSessionCount] =
      await Promise.all([
        this.prisma.membership.findFirst({
          where: { userId: id, status: 'ACTIVE' },
        }),
        this.prisma.cryndyPurchase.findMany({ where: { userId: id } }),
        this.prisma.ndybitsLedgerEntry.aggregate({
          where: { userId: id },
          _sum: { amount: true },
        }),
        this.prisma.session.count({
          where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
        }),
      ]);

    const cryndyAvailable = cryndyPurchases
      .filter(
        (p) => p.status === 'AVAILABLE' || p.status === 'DISTRIBUTED_ON_CHAIN',
      )
      .reduce(
        (sum, p) => sum + Number(p.cryndyAmount) + Number(p.bonusAmount),
        0,
      );

    return {
      id: user.id,
      ndyId: user.ndyId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      suspended: user.suspended,
      verificationLevel: user.verificationLevel,
      ndyappsConnected: user.ndyappsConnected,
      createdAt: user.createdAt,
      membership: currentMembership
        ? {
            tierLabel: TIER_CONFIG[currentMembership.tier].label,
            status: currentMembership.status,
          }
        : null,
      cryndyAvailableBalance: cryndyAvailable,
      cryndyPurchaseCount: cryndyPurchases.length,
      ndybitsBalance: ndybitsAgg._sum.amount ?? 0,
      activeSessionCount,
    };
  }

  // Role changes are no longer instant — see RoleChangeRequestService.
  // Dual-approval is the client's explicit requirement for this "critical
  // action": one admin proposes, a *different* admin approves.

  async setSuspended(
    actor: AdminActor,
    targetUserId: string,
    suspended: boolean,
    reason?: string,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('No user with that id.');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { suspended, suspendedAt: suspended ? new Date() : null },
    });

    // Suspension without consequence is just a label — kill every active
    // session so it actually locks the account out, not just future logins
    // (which AuthService.login also checks suspended for).
    if (suspended) {
      await this.prisma.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.writeAuditLog(actor, {
      action: suspended ? 'user.suspend' : 'user.unsuspend',
      target,
      previousValue: { suspended: target.suspended },
      newValue: { suspended: updated.suspended },
      reason,
    });

    return {
      id: updated.id,
      ndyId: updated.ndyId,
      suspended: updated.suspended,
    };
  }

  async getAuditLog(take: number, skip: number) {
    const [entries, total] = await Promise.all([
      this.prisma.auditLogEntry.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLogEntry.count(),
    ]);
    return { entries, total };
  }

  private async writeAuditLog(
    actor: AdminActor,
    params: {
      action: string;
      target: { id: string; ndyId: string };
      previousValue?: unknown;
      newValue?: unknown;
      reason?: string;
    },
  ) {
    await this.prisma.auditLogEntry.create({
      data: {
        adminUserId: actor.id,
        adminNdyId: actor.ndyId,
        action: params.action,
        targetUserId: params.target.id,
        targetNdyId: params.target.ndyId,
        previousValue: toJson(params.previousValue),
        newValue: toJson(params.newValue),
        reason: params.reason,
        ip: actor.ip,
      },
    });
  }
}

function toJson(value: unknown) {
  return value === undefined
    ? undefined
    : (JSON.parse(JSON.stringify(value)) as object);
}
