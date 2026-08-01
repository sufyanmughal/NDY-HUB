import { Injectable, Logger } from '@nestjs/common';
import { CryndyPurchaseStatus, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG } from '../membership/tier-config';

// Excludes purchases that never actually became a sale (still pending
// payment) or that were unwound (cancelled/refunded) — everything else,
// including in-review/verified/allocated/locked/available/on-chain, counts
// as a confirmed sale for revenue-reporting purposes.
const CONFIRMED_SALE_STATUSES: readonly CryndyPurchaseStatus[] = [
  CryndyPurchaseStatus.PAYMENT_CONFIRMED,
  CryndyPurchaseStatus.UNDER_REVIEW,
  CryndyPurchaseStatus.VERIFIED,
  CryndyPurchaseStatus.ALLOCATED,
  CryndyPurchaseStatus.LOCKED,
  CryndyPurchaseStatus.AVAILABLE,
  CryndyPurchaseStatus.DISTRIBUTED_ON_CHAIN,
];

@Injectable()
export class FounderService {
  private readonly logger = new Logger(FounderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEcosystemOverview() {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisMonth,
      newVerificationsToday,
      activeSessions,
      newMembershipsToday,
      membershipsCreatedToday,
      activeMemberships,
      cryndySalesToday,
      cryndySalesAllTime,
      ndybitsIssuedToday,
      ndybitsIssuedAllTime,
      databaseOk,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfToday } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.user.count({
        where: { emailVerifiedAt: { gte: startOfToday } },
      }),
      this.prisma.session.count({
        where: { revokedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.membership.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.membership.findMany({
        where: { createdAt: { gte: startOfToday } },
        select: { tier: true, billingCycle: true },
      }),
      this.prisma.membership.count({
        where: { status: MembershipStatus.ACTIVE },
      }),
      this.prisma.cryndyPurchase.aggregate({
        where: {
          status: { in: [...CONFIRMED_SALE_STATUSES] },
          createdAt: { gte: startOfToday },
        },
        _count: true,
        _sum: { amountPaid: true },
      }),
      this.prisma.cryndyPurchase.aggregate({
        where: { status: { in: [...CONFIRMED_SALE_STATUSES] } },
        _count: true,
        _sum: { amountPaid: true },
      }),
      this.prisma.ndybitsLedgerEntry.aggregate({
        where: { amount: { gt: 0 }, createdAt: { gte: startOfToday } },
        _sum: { amount: true },
      }),
      this.prisma.ndybitsLedgerEntry.aggregate({
        where: { amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      this.checkDatabaseHealth(),
    ]);

    // Membership pricing is still placeholder (see tier-config.ts) — this
    // is an estimate for dashboard purposes, not a reconciled revenue
    // figure. CRYNDY amounts are real, paid amounts.
    const membershipRevenueTodayCents = membershipsCreatedToday.reduce(
      (sum, m) => {
        const config = TIER_CONFIG[m.tier];
        return (
          sum +
          (m.billingCycle === 'ANNUAL'
            ? config.annualPriceCents
            : config.monthlyPriceCents)
        );
      },
      0,
    );
    const cryndyRevenueTodayCents = Math.round(
      Number(cryndySalesToday._sum?.amountPaid ?? 0) * 100,
    );

    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisMonth: newUsersThisMonth,
        newVerificationsToday,
        activeSessions,
      },
      memberships: {
        newToday: newMembershipsToday,
        active: activeMemberships,
      },
      revenue: {
        todayCents: membershipRevenueTodayCents + cryndyRevenueTodayCents,
        membershipTodayCentsEstimated: membershipRevenueTodayCents,
        cryndyTodayCents: cryndyRevenueTodayCents,
        note: 'Membership figures use placeholder tier pricing (see tier-config.ts) until real pricing is confirmed. CRYNDY figures are real paid amounts.',
      },
      cryndy: {
        salesToday: {
          count: cryndySalesToday._count,
          amountCents: cryndyRevenueTodayCents,
        },
        salesAllTime: {
          count: cryndySalesAllTime._count,
          amountCents: Math.round(
            Number(cryndySalesAllTime._sum?.amountPaid ?? 0) * 100,
          ),
        },
      },
      ndybits: {
        issuedToday: ndybitsIssuedToday._sum.amount ?? 0,
        issuedAllTime: ndybitsIssuedAllTime._sum.amount ?? 0,
      },
      systemStatus: {
        database: databaseOk ? 'ok' : 'down',
        // Redis is provisioned (docker-compose) but not yet used by any API
        // code path — nothing to health-check here honestly until that
        // changes.
      },
      generatedAt: now,
    };
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      this.logger.error('Database health check failed', err);
      return false;
    }
  }
}
