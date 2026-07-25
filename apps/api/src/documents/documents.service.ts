import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingCycle, CryndyPurchaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG } from '../membership/tier-config';

// A CRYNDY purchase only gets a certificate once it's been verified —
// matches the proposal's "a receipt or certificate becomes available"
// happening after verification, not at the moment of payment.
const CERTIFICATE_ELIGIBLE_STATUSES: readonly CryndyPurchaseStatus[] = [
  CryndyPurchaseStatus.VERIFIED,
  CryndyPurchaseStatus.ALLOCATED,
  CryndyPurchaseStatus.LOCKED,
  CryndyPurchaseStatus.AVAILABLE,
  CryndyPurchaseStatus.DISTRIBUTED_ON_CHAIN,
];

export interface DocumentStub {
  id: string;
  type: 'MEMBERSHIP_CONFIRMATION' | 'CRYNDY_CERTIFICATE';
  title: string;
  date: string;
}

/**
 * Documents are generated on demand from Membership/CryndyPurchase rows
 * rather than persisted files in a bucket — there's no real object storage
 * configured in this environment, and fabricating one would mean pretending
 * files exist that don't. This is the same "build the real logic, be
 * explicit about the missing infra" call as Stripe: a real S3 export would
 * replace the generateX methods below without changing the list/lookup
 * shape at all.
 */
@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyDocuments(userId: string): Promise<DocumentStub[]> {
    const [memberships, cryndyPurchases] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cryndyPurchase.findMany({
        where: { userId, status: { in: [...CERTIFICATE_ELIGIBLE_STATUSES] } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const membershipDocs: DocumentStub[] = memberships.map((m) => ({
      id: `membership-${m.id}`,
      type: 'MEMBERSHIP_CONFIRMATION',
      title: `${TIER_CONFIG[m.tier].label} membership confirmation`,
      date: m.createdAt.toISOString(),
    }));

    const cryndyDocs: DocumentStub[] = cryndyPurchases.map((p) => ({
      id: `cryndy-${p.id}`,
      type: 'CRYNDY_CERTIFICATE',
      title: `CRYNDY certificate — ${p.reference}`,
      date: p.createdAt.toISOString(),
    }));

    return [...membershipDocs, ...cryndyDocs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  async renderDocument(
    userId: string,
    documentId: string,
  ): Promise<{ filename: string; content: string }> {
    const [kind, recordId] = splitDocumentId(documentId);

    if (kind === 'membership') {
      const membership = await this.prisma.membership.findUnique({
        where: { id: recordId },
      });
      if (!membership) throw new NotFoundException('Document not found.');
      if (membership.userId !== userId)
        throw new ForbiddenException('Not your document.');
      return {
        filename: `ndy-hub-membership-${membership.id}.txt`,
        content: renderMembershipConfirmation(membership),
      };
    }

    const purchase = await this.prisma.cryndyPurchase.findUnique({
      where: { id: recordId },
    });
    if (!purchase) throw new NotFoundException('Document not found.');
    if (purchase.userId !== userId)
      throw new ForbiddenException('Not your document.');
    if (!CERTIFICATE_ELIGIBLE_STATUSES.includes(purchase.status)) {
      throw new NotFoundException('This purchase has no certificate yet.');
    }
    return {
      filename: `ndy-hub-cryndy-certificate-${purchase.reference}.txt`,
      content: renderCryndyCertificate(purchase),
    };
  }
}

function splitDocumentId(
  documentId: string,
): ['membership' | 'cryndy', string] {
  if (documentId.startsWith('membership-')) {
    return ['membership', documentId.slice('membership-'.length)];
  }
  if (documentId.startsWith('cryndy-')) {
    return ['cryndy', documentId.slice('cryndy-'.length)];
  }
  throw new NotFoundException('Document not found.');
}

function renderMembershipConfirmation(membership: {
  id: string;
  tier: keyof typeof TIER_CONFIG;
  billingCycle: BillingCycle;
  status: string;
  startedAt: Date;
  currentPeriodEnd: Date;
}): string {
  const tier = TIER_CONFIG[membership.tier];
  const price =
    membership.billingCycle === BillingCycle.ANNUAL
      ? tier.annualPriceCents
      : tier.monthlyPriceCents;
  return [
    'NDY HUB — Membership Confirmation',
    '==================================',
    '',
    `Membership ID: ${membership.id}`,
    `Plan: ${tier.label}`,
    `Billing: ${membership.billingCycle === BillingCycle.ANNUAL ? 'Annual' : 'Monthly'}`,
    `Price: $${(price / 100).toFixed(2)} ${membership.billingCycle === BillingCycle.ANNUAL ? '/yr' : '/mo'}`,
    `Status: ${membership.status}`,
    `Started: ${membership.startedAt.toISOString()}`,
    `Current period ends: ${membership.currentPeriodEnd.toISOString()}`,
    '',
    'This is a system-generated confirmation, not a tax invoice.',
  ].join('\n');
}

function renderCryndyCertificate(purchase: {
  reference: string;
  cryndyAmount: unknown;
  bonusAmount: unknown;
  amountPaid: unknown;
  currency: string;
  status: string;
  createdAt: Date;
}): string {
  return [
    'NDY HUB — CRYNDY Purchase Certificate',
    '======================================',
    '',
    `Reference: ${purchase.reference}`,
    `CRYNDY: ${Number(purchase.cryndyAmount).toLocaleString()}`,
    `Bonus: ${Number(purchase.bonusAmount).toLocaleString()}`,
    `Paid: ${Number(purchase.amountPaid).toLocaleString()} ${purchase.currency}`,
    `Status: ${purchase.status}`,
    `Purchased: ${purchase.createdAt.toISOString()}`,
    '',
    'This certificate confirms the purchase above. It is not proof of',
    'on-chain custody until status reaches DISTRIBUTED_ON_CHAIN.',
  ].join('\n');
}
