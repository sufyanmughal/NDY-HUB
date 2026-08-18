import { Injectable, Logger } from '@nestjs/common';
import { NdybitsRiskFlag, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NdybitsService } from './ndybits.service';

const DEFAULT_VELOCITY_WINDOW_HOURS = 24;

export interface VerifiedEventInput {
  eventKey: string;
  userId: string;
  sourceEventId: string;
  reportedByClientId?: string;
}

export type VerifiedEventResult =
  | { status: 'credited'; amount: number; ledgerEntryId: string }
  | { status: 'denied'; reason: string }
  | { status: 'already_processed'; eventLogId: string };

/**
 * The client's explicit requirement made real: "apps send verified events,
 * NDYHUB's Reward Engine decides the reward amount, apps must never
 * independently create balances." The amount is never accepted from the
 * caller — only eventKey + userId + a proof of idempotency. Everything
 * else (whether the rule exists, whether it's enabled, whether this user
 * has hit today's cap) is decided here.
 *
 * Extends the ndybits module rather than living elsewhere, since its only
 * real job is deciding *when and how much* to call the already-correct,
 * already-idempotent NdybitsService.creditNdybits() — this is additive,
 * not a rewrite of that ledger-write path.
 */
@Injectable()
export class RewardEngineService {
  private readonly logger = new Logger(RewardEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ndybits: NdybitsService,
  ) {}

  async handleVerifiedEvent(
    input: VerifiedEventInput,
  ): Promise<VerifiedEventResult> {
    // Idempotency check first — same contract as every other event-driven
    // write in this codebase (NdybitsLedgerEntry.sourceEventId,
    // ActionLogEntry.idempotencyKey): a retried report of the same event
    // returns the original outcome instead of being evaluated twice.
    const existingLog = await this.prisma.ndyEconomyEventLog.findUnique({
      where: { sourceEventId: input.sourceEventId },
    });
    if (existingLog) {
      return { status: 'already_processed', eventLogId: existingLog.id };
    }

    const rule = await this.prisma.rewardRule.findUnique({
      where: { eventKey: input.eventKey },
    });

    if (!rule || !rule.enabled) {
      const reason = rule
        ? `Reward rule "${input.eventKey}" is not currently enabled.`
        : `No reward rule registered for event "${input.eventKey}".`;
      await this.logEvent(input, { denied: true, denyReason: reason });
      return { status: 'denied', reason };
    }

    if (rule.maxPerUserPerDay != null) {
      const windowStart = new Date(
        Date.now() - DEFAULT_VELOCITY_WINDOW_HOURS * 60 * 60 * 1000,
      );
      const recentCount = await this.prisma.ndyEconomyEventLog.count({
        where: {
          userId: input.userId,
          eventKey: input.eventKey,
          denied: false,
          createdAt: { gte: windowStart },
        },
      });
      if (recentCount >= rule.maxPerUserPerDay) {
        const reason = `Daily limit (${rule.maxPerUserPerDay}) reached for "${input.eventKey}".`;
        await this.logEvent(input, {
          denied: true,
          denyReason: reason,
          riskFlag: NdybitsRiskFlag.FLAGGED_VELOCITY,
        });
        return { status: 'denied', reason };
      }
    }

    // Credit via the existing, already-correct, already-idempotent path —
    // this is additive to NdybitsService, not a reimplementation of it.
    // A distinct sourceEventId (prefixed, not reused verbatim) keeps this
    // event log's own idempotency key and the ledger's independent, so a
    // future manual re-credit for the same event (rare, admin-only) isn't
    // silently blocked by this layer's own uniqueness constraint.
    const entry = await this.ndybits.creditNdybits(
      input.userId,
      rule.amount,
      rule.label,
      `economy-event:${input.sourceEventId}`,
    );

    await this.logEvent(input, { denied: false, ledgerEntryId: entry.id });

    this.logger.log(
      `Credited ${rule.amount} NDYBITS to user ${input.userId} for event "${input.eventKey}".`,
    );

    return { status: 'credited', amount: rule.amount, ledgerEntryId: entry.id };
  }

  private async logEvent(
    input: VerifiedEventInput,
    extra: {
      denied: boolean;
      denyReason?: string;
      ledgerEntryId?: string;
      riskFlag?: NdybitsRiskFlag;
    },
  ) {
    try {
      await this.prisma.ndyEconomyEventLog.create({
        data: {
          eventKey: input.eventKey,
          userId: input.userId,
          reportedByClientId: input.reportedByClientId,
          sourceEventId: input.sourceEventId,
          denied: extra.denied,
          denyReason: extra.denyReason,
          ledgerEntryId: extra.ledgerEntryId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Lost a race against a concurrent duplicate report — fine, the
        // other write already recorded this event.
        return;
      }
      throw err;
    }
  }
}
