import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
   *
   * sourceEventId is what makes a future caller (e.g. "credit NDYBITS when
   * a CRYNDY purchase allocates") idempotent: pass a stable id derived from
   * the triggering event (e.g. `cryndy_purchase:${purchaseId}`) and a retry
   * of the same trigger returns the original entry instead of posting a
   * second credit. Omit it only for genuinely one-off manual/admin credits
   * that have no external event to key off of.
   */
  async creditNdybits(
    userId: string,
    amount: number,
    reason: string,
    sourceEventId?: string,
  ) {
    if (amount === 0) {
      throw new BadRequestException('NDYBITS ledger entries must be non-zero.');
    }
    try {
      return await this.prisma.ndybitsLedgerEntry.create({
        data: { userId, amount, reason, sourceEventId },
      });
    } catch (err) {
      if (
        sourceEventId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return this.prisma.ndybitsLedgerEntry.findUniqueOrThrow({
          where: { sourceEventId },
        });
      }
      throw err;
    }
  }
}
