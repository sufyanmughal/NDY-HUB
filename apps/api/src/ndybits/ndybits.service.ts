import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_ENTRIES_LIMIT = 20;

@Injectable()
export class NdybitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Balance is derived by summing the ledger on every read rather than kept
   * as a running counter on User. Picked this over a cached balance because
   * it's correct by construction — there's no separate write path that can
   * drift out of sync with the ledger, no transaction to get wrong, and
   * nothing to reconcile later. NDYBITS reads aren't hot enough yet for the
   * aggregate query to matter; if that changes, a maintained running balance
   * (updated in the same transaction as each ledger insert) is the next step.
   */
  async getUserSummary(userId: string) {
    const [balance, entries] = await Promise.all([
      this.prisma.ndybitsLedgerEntry.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      this.prisma.ndybitsLedgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ENTRIES_LIMIT,
      }),
    ]);

    return {
      balance: balance._sum.amount ?? 0,
      recentEntries: entries,
    };
  }

  /**
   * Not called from anywhere yet (no daily-login job, no referral trigger),
   * but sound to call from other modules once one exists: just appends a
   * signed ledger entry, which is all a "credit" needs to be in a sum-on-
   * read balance model.
   */
  async creditNdybits(userId: string, amount: number, reason: string) {
    if (amount === 0) {
      throw new BadRequestException('NDYBITS ledger entries must be non-zero.');
    }
    return this.prisma.ndybitsLedgerEntry.create({
      data: { userId, amount, reason },
    });
  }
}
