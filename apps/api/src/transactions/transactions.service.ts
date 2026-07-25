import { Injectable } from '@nestjs/common';
import { BillingCycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG } from '../membership/tier-config';

export type TransactionType = 'membership' | 'cryndy';

export interface Transaction {
  id: string;
  type: TransactionType;
  label: string;
  detail: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
}

/**
 * Reads across Membership and CryndyPurchase directly rather than going
 * through MembershipService/CryndyService — a unified transaction history
 * is inherently a cross-cutting, read-only view, not really "owned" by
 * either module the way their own guarded endpoints are.
 */
@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyTransactions(userId: string): Promise<Transaction[]> {
    const [memberships, cryndyPurchases] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cryndyPurchase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const membershipTxns: Transaction[] = memberships.map((m) => ({
      id: `membership-${m.id}`,
      type: 'membership',
      label: `${TIER_CONFIG[m.tier].label} membership`,
      detail:
        m.billingCycle === BillingCycle.ANNUAL
          ? 'Annual billing'
          : 'Monthly billing',
      amount:
        (m.billingCycle === BillingCycle.ANNUAL
          ? TIER_CONFIG[m.tier].annualPriceCents
          : TIER_CONFIG[m.tier].monthlyPriceCents) / 100,
      currency: 'USD',
      status: m.status,
      date: m.createdAt.toISOString(),
    }));

    const cryndyTxns: Transaction[] = cryndyPurchases.map((p) => ({
      id: `cryndy-${p.id}`,
      type: 'cryndy',
      label: `CRYNDY purchase — ${p.reference}`,
      detail: `${Number(p.cryndyAmount).toLocaleString()} CRYNDY${
        Number(p.bonusAmount) > 0
          ? ` + ${Number(p.bonusAmount).toLocaleString()} bonus`
          : ''
      }`,
      amount: Number(p.amountPaid),
      currency: p.currency,
      status: p.status,
      date: p.createdAt.toISOString(),
    }));

    return [...membershipTxns, ...cryndyTxns].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }
}
