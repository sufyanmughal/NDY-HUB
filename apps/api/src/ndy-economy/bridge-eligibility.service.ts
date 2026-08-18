import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EligibilityCheckResult {
  eligible: boolean;
  reason?: string;
  coolingOffUntil?: Date;
}

/**
 * The Bridge Engine's decision logic, per the client's explicit spec:
 * "NDYHUB determines whether a conversion is permitted" — checking
 * ConversionPolicy.enabled (the hard architecture-ready-not-activated
 * gate), balance, and daily caps. Real, testable logic — it just never
 * reaches "execute a conversion" because ConversionPolicy.enabled stays
 * false until a deliberate, reviewed, post-legal-review operational
 * change (never something this codebase sets on its own).
 */
@Injectable()
export class BridgeEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async checkEligibility(
    userId: string,
    direction: string,
    sourceAmount: Prisma.Decimal | number | string,
  ): Promise<EligibilityCheckResult> {
    const policy = await this.prisma.conversionPolicy.findUnique({
      where: { direction },
    });

    if (!policy) {
      return {
        eligible: false,
        reason: `No conversion policy exists for "${direction}".`,
      };
    }
    if (!policy.enabled) {
      return {
        eligible: false,
        reason:
          'This bridge is not currently active — architecture is ready, pending legal/compliance review before activation.',
      };
    }

    const amount = new Prisma.Decimal(sourceAmount);

    if (policy.minBridgeAmount && amount.lessThan(policy.minBridgeAmount)) {
      return {
        eligible: false,
        reason: `Minimum bridge amount is ${policy.minBridgeAmount.toString()}.`,
      };
    }

    if (policy.dailyCapPerUser) {
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await this.prisma.bridgeRequest.findMany({
        where: {
          userId,
          direction,
          createdAt: { gte: windowStart },
          status: { in: ['ELIGIBLE', 'APPROVED', 'EXECUTED'] },
        },
        select: { sourceAmount: true },
      });
      const usedToday = recent.reduce(
        (sum, r) => sum.plus(r.sourceAmount),
        new Prisma.Decimal(0),
      );
      if (usedToday.plus(amount).greaterThan(policy.dailyCapPerUser)) {
        return {
          eligible: false,
          reason: `This request would exceed your daily bridge limit of ${policy.dailyCapPerUser.toString()}.`,
        };
      }
    }

    if (
      policy.reserveBalance.lessThan(
        this.impliedTargetAmount(amount, policy.rate),
      )
    ) {
      return {
        eligible: false,
        reason: 'Bridge reserve is currently insufficient for this conversion.',
      };
    }

    return { eligible: true };
  }

  private impliedTargetAmount(
    sourceAmount: Prisma.Decimal,
    rate: Prisma.Decimal,
  ) {
    // rate is "units of source per 1 unit of target" per ConversionPolicy's
    // own schema comment — dividing gives the target amount this request
    // would draw from the reserve.
    return sourceAmount.dividedBy(rate);
  }
}
