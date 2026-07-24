import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CryndyPurchase, CryndyPurchaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generatePurchaseReference } from '../common/cryndy-reference.util';
import { CryndyPurchaseWebhookDto } from './dto/cryndy-purchase-webhook.dto';

const MAX_REFERENCE_ATTEMPTS = 5;

// Statuses that represent CRYNDY the user can actually act on. Everything
// else (pending, under review, allocated-but-locked, cancelled, refunded) is
// owned but not spendable — the whole point of exposing a status breakdown
// instead of one number is so the UI never has to guess which bucket is safe
// to call "available".
const SPENDABLE_STATUSES: readonly CryndyPurchaseStatus[] = [
  CryndyPurchaseStatus.AVAILABLE,
  CryndyPurchaseStatus.DISTRIBUTED_ON_CHAIN,
];

export interface CryndyStatusBucket {
  count: number;
  cryndyAmount: number;
}

@Injectable()
export class CryndyService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserSummary(userId: string) {
    const purchases = await this.prisma.cryndyPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const breakdown = Object.fromEntries(
      Object.values(CryndyPurchaseStatus).map((status) => [
        status,
        { count: 0, cryndyAmount: 0 } satisfies CryndyStatusBucket,
      ]),
    ) as Record<CryndyPurchaseStatus, CryndyStatusBucket>;

    let availableBalance = 0;
    for (const purchase of purchases) {
      const total =
        Number(purchase.cryndyAmount) + Number(purchase.bonusAmount);
      breakdown[purchase.status].count += 1;
      breakdown[purchase.status].cryndyAmount += total;
      if (SPENDABLE_STATUSES.includes(purchase.status)) {
        availableBalance += total;
      }
    }

    return {
      availableBalance,
      breakdown,
      purchases: purchases.map(serializePurchase),
    };
  }

  /**
   * Intake for the presale site's purchase webhook. Idempotent on
   * `providerTransactionId`: a fresh id creates a new purchase (and — since
   * this is a brand-new row, never a replay — walks it forward through
   * markVerified/allocate to match whatever stage the presale itself
   * reports having reached). A repeated id hits the unique constraint and is
   * treated as a successful no-op, which is what a retrying webhook sender
   * needs to see instead of an error.
   */
  async handlePurchaseWebhook(dto: CryndyPurchaseWebhookDto) {
    const user = await this.prisma.user.findUnique({
      where: { ndyId: dto.ndyId },
    });
    if (!user) {
      throw new BadRequestException(`Unknown NDY ID: ${dto.ndyId}`);
    }

    const purchase = await this.createPurchase(user.id, dto);
    if (!purchase.created) {
      return {
        received: true,
        duplicate: true,
        purchaseId: purchase.record.id,
      };
    }

    let record = purchase.record;
    if (
      dto.status === CryndyPurchaseStatus.VERIFIED ||
      dto.status === CryndyPurchaseStatus.ALLOCATED
    ) {
      record = await this.markVerified(record.id);
    }
    if (dto.status === CryndyPurchaseStatus.ALLOCATED) {
      record = await this.allocate(record.id);
    }

    return { received: true, duplicate: false, purchaseId: record.id };
  }

  /**
   * Internal transition, not exposed as an endpoint yet. Only moves a
   * purchase forward from a pre-verification state, and only ever changes a
   * row that's still in that state — the updateMany-then-check-count guard
   * is the same race-safe pattern auth.service.ts uses for login requests.
   */
  async markVerified(purchaseId: string): Promise<CryndyPurchase> {
    const result = await this.prisma.cryndyPurchase.updateMany({
      where: {
        id: purchaseId,
        status: {
          in: [
            CryndyPurchaseStatus.PAYMENT_CONFIRMED,
            CryndyPurchaseStatus.UNDER_REVIEW,
          ],
        },
      },
      data: { status: CryndyPurchaseStatus.VERIFIED, verifiedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'Purchase is not in a state that can be verified.',
      );
    }
    return this.prisma.cryndyPurchase.findUniqueOrThrow({
      where: { id: purchaseId },
    });
  }

  /** Same race-safe pattern as markVerified — only a VERIFIED purchase can be allocated. */
  async allocate(purchaseId: string): Promise<CryndyPurchase> {
    const result = await this.prisma.cryndyPurchase.updateMany({
      where: { id: purchaseId, status: CryndyPurchaseStatus.VERIFIED },
      data: { status: CryndyPurchaseStatus.ALLOCATED, allocatedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'Purchase is not in a state that can be allocated.',
      );
    }
    return this.prisma.cryndyPurchase.findUniqueOrThrow({
      where: { id: purchaseId },
    });
  }

  private async createPurchase(
    userId: string,
    dto: CryndyPurchaseWebhookDto,
  ): Promise<
    | { created: true; record: CryndyPurchase }
    | { created: false; record: CryndyPurchase }
  > {
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      try {
        const record = await this.prisma.cryndyPurchase.create({
          data: {
            reference: generatePurchaseReference(),
            userId,
            providerTransactionId: dto.providerTransactionId,
            amountPaid: dto.amountPaid,
            currency: dto.currency,
            cryndyAmount: dto.cryndyAmount,
            bonusAmount: dto.bonusAmount ?? 0,
            packageName: dto.packageName,
            paymentMethod: dto.paymentMethod,
            status: CryndyPurchaseStatus.PAYMENT_CONFIRMED,
          },
        });
        return { created: true, record };
      } catch (err: unknown) {
        if (
          isUniqueConstraintError(err, 'reference') &&
          attempt < MAX_REFERENCE_ATTEMPTS - 1
        ) {
          continue;
        }
        if (isUniqueConstraintError(err, 'providerTransactionId')) {
          const existing = await this.prisma.cryndyPurchase.findUniqueOrThrow({
            where: { providerTransactionId: dto.providerTransactionId },
          });
          return { created: false, record: existing };
        }
        throw err;
      }
    }
    throw new ConflictException(
      'Could not allocate a unique purchase reference, please retry.',
    );
  }
}

function serializePurchase(purchase: CryndyPurchase) {
  return {
    id: purchase.id,
    reference: purchase.reference,
    amountPaid: Number(purchase.amountPaid),
    currency: purchase.currency,
    cryndyAmount: Number(purchase.cryndyAmount),
    bonusAmount: Number(purchase.bonusAmount),
    packageName: purchase.packageName,
    paymentMethod: purchase.paymentMethod,
    status: purchase.status,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
    verifiedAt: purchase.verifiedAt,
    allocatedAt: purchase.allocatedAt,
  };
}

function isUniqueConstraintError(err: unknown, field: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes(field)
  );
}
