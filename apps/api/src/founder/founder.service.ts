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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

@Injectable()
export class FounderService {
  private readonly logger = new Logger(FounderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEcosystemOverview() {
    const now = new Date();
    const startOfToday = startOfDay(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisMonth,
      newVerificationsToday,
      activeSessions,
      newMembershipsToday,
      activeMemberships,
      financials,
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
      this.prisma.membership.count({
        where: { status: MembershipStatus.ACTIVE },
      }),
      this.computeFinancials(now, startOfToday),
      this.checkDatabaseHealth(),
    ]);

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
      ...financials,
      systemStatus: {
        database: databaseOk ? 'ok' : 'down',
      },
      generatedAt: now,
    };
  }

  /**
   * The subset of getEcosystemOverview() that's genuinely financial
   * (revenue, CRYNDY sales, ndybits issuance) — split out so FINANCE can
   * see the money without also getting user counts, session data, or
   * system health, which are founder/ops concerns, not finance ones.
   */
  async getFinancialSummary() {
    const now = new Date();
    const financials = await this.computeFinancials(now, startOfDay(now));
    return { ...financials, generatedAt: now };
  }

  private async computeFinancials(now: Date, startOfToday: Date) {
    const [
      membershipsCreatedToday,
      cryndySalesToday,
      cryndySalesAllTime,
      ndybitsIssuedToday,
      ndybitsIssuedAllTime,
    ] = await Promise.all([
      this.prisma.membership.findMany({
        where: { createdAt: { gte: startOfToday } },
        select: { tier: true, billingCycle: true },
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
