import { Injectable, Logger } from '@nestjs/common';
import { CryndyPurchaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitcoinPriceService } from './bitcoin-price.service';

// Same "confirmed sale" definition as founder.service.ts's ecosystem
// overview — duplicated rather than imported to keep these two read-only
// reporting modules independent of each other.
const CONFIRMED_SALE_STATUSES: readonly CryndyPurchaseStatus[] = [
  CryndyPurchaseStatus.PAYMENT_CONFIRMED,
  CryndyPurchaseStatus.UNDER_REVIEW,
  CryndyPurchaseStatus.VERIFIED,
  CryndyPurchaseStatus.ALLOCATED,
  CryndyPurchaseStatus.LOCKED,
  CryndyPurchaseStatus.AVAILABLE,
  CryndyPurchaseStatus.DISTRIBUTED_ON_CHAIN,
];

const CRYNDY_TREND_DAYS = 14;

@Injectable()
export class EcosystemService {
  private readonly logger = new Logger(EcosystemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bitcoinPrice: BitcoinPriceService,
  ) {}

  /**
   * Homepage stats — deliberately only real, currently-tracked numbers.
   * The design mockup this backs shows 5 tiles (Total Members, Connected
   * Platforms, System Uptime, Countries, Transactions 24h) plus a live
   * CRYNDY price ticker; neither the uptime % nor CRYNDY's price is a
   * real tracked metric (CRYNDY has no market yet, and there's no
   * historical uptime-tracking table), so both are backed by the closest
   * honest equivalent instead of a fabricated number: uptime reflects the
   * current DB health check rather than a real historical percentage
   * (100% healthy / 0% down — no history table exists to compute a true
   * rolling percentage yet), and the CRYNDY card (built elsewhere, see
   * `cryndy` below) shows a purchase-activity trend instead of a price.
   */
  async getOverview() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const saleStatusFilter = { in: [...CONFIRMED_SALE_STATUSES] };

    const [
      totalMembers,
      connectedPlatforms,
      countryRows,
      membershipTx24h,
      cryndyTx24h,
      cryndySoldAgg,
      cryndyDailySeries,
      databaseOk,
      bitcoin,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.oAuthClient.count({ where: { isActive: true } }),
      this.prisma.user.findMany({
        where: { deletedAt: null, country: { not: null } },
        select: { country: true },
        distinct: ['country'],
      }),
      this.prisma.membership.count({ where: { createdAt: { gte: last24h } } }),
      this.prisma.cryndyPurchase.count({
        where: { status: saleStatusFilter, createdAt: { gte: last24h } },
      }),
      this.prisma.cryndyPurchase.aggregate({
        where: { status: saleStatusFilter },
        _sum: { cryndyAmount: true, bonusAmount: true },
      }),
      this.getCryndyDailySeries(),
      this.checkDatabaseHealth(),
      this.bitcoinPrice.getPrice(),
    ]);

    return {
      totalMembers,
      connectedPlatforms,
      systemUptimePct: databaseOk ? 100 : 0,
      countries: countryRows.length,
      transactions24h: membershipTx24h + cryndyTx24h,
      cryndy: {
        totalSold:
          Number(cryndySoldAgg._sum?.cryndyAmount ?? 0) +
          Number(cryndySoldAgg._sum?.bonusAmount ?? 0),
        dailySeries: cryndyDailySeries,
      },
      bitcoin,
      systemStatus: databaseOk ? 'ok' : 'down',
      generatedAt: now,
    };
  }

  private async getCryndyDailySeries(): Promise<number[]> {
    const since = new Date(
      Date.now() - CRYNDY_TREND_DAYS * 24 * 60 * 60 * 1000,
    );
    const purchases = await this.prisma.cryndyPurchase.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const counts = new Array<number>(CRYNDY_TREND_DAYS).fill(0);
    const now = Date.now();
    for (const p of purchases) {
      const daysAgo = Math.floor(
        (now - p.createdAt.getTime()) / (24 * 60 * 60 * 1000),
      );
      const index = CRYNDY_TREND_DAYS - 1 - daysAgo;
      if (index >= 0 && index < CRYNDY_TREND_DAYS) counts[index] += 1;
    }
    return counts;
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
