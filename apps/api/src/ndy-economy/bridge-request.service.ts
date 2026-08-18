import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { BridgeRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BridgeEligibilityService } from './bridge-eligibility.service';

const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // same excludes-ambiguous-chars alphabet as ndy-id.util.ts

function generateBridgeRef(): string {
  const year = new Date().getFullYear();
  const bytes = randomBytes(6);
  let suffix = '';
  for (const b of bytes) suffix += REF_ALPHABET[b % REF_ALPHABET.length];
  return `NBR-${year}-${suffix}`;
}

/**
 * Creates and evaluates bridge requests — per the client's explicit spec,
 * this stops at ELIGIBLE/INELIGIBLE. No EXECUTED path is implemented
 * anywhere in this service, deliberately: real conversion execution
 * (moving NDYBITS/CRYNDY/NDYX balances, on-chain settlement for Bridge 2)
 * is out of scope until tokenomics, security architecture, treasury rules
 * and legal/compliance review are complete, per the client's own explicit
 * instruction. The status enum already includes EXECUTED so that future
 * work is additive (implement the transition), not a schema change.
 */
@Injectable()
export class BridgeRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: BridgeEligibilityService,
  ) {}

  async create(userId: string, direction: string, sourceAmount: string) {
    const amount = new Prisma.Decimal(sourceAmount);

    const policy = await this.prisma.conversionPolicy.findUnique({
      where: { direction },
    });
    const quotedRate = policy?.rate ?? new Prisma.Decimal(0);

    const result = await this.eligibility.checkEligibility(
      userId,
      direction,
      amount,
    );

    let ref = generateBridgeRef();
    // Vanishingly unlikely collision at this alphabet/length, but retry
    // rather than trust probability — same discipline as
    // ndy-id.util.ts/generateCoreId's callers.
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await this.prisma.bridgeRequest.findUnique({
        where: { bridgeTransactionRef: ref },
      });
      if (!clash) break;
      ref = generateBridgeRef();
    }

    return this.prisma.bridgeRequest.create({
      data: {
        userId,
        direction,
        sourceAmount: amount,
        quotedRate,
        status: result.eligible
          ? BridgeRequestStatus.ELIGIBLE
          : BridgeRequestStatus.INELIGIBLE,
        eligibilityNote: result.reason,
        coolingOffUntil: result.coolingOffUntil,
        bridgeTransactionRef: ref,
        resolvedAt: new Date(),
      },
    });
  }

  async getOne(userId: string, id: string) {
    const request = await this.prisma.bridgeRequest.findUnique({
      where: { id },
    });
    if (!request || request.userId !== userId) {
      throw new NotFoundException('No bridge request with that id.');
    }
    return request;
  }

  async listForUser(userId: string) {
    return this.prisma.bridgeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
