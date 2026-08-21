import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RewardEngineService } from '../ndybits/reward-engine.service';
import { isRegisteredEventType } from './event-catalog';

export interface ReportEcosystemEventInput {
  eventType: string;
  userId: string;
  sourceEventId: string;
  reportedByClientId?: string;
  payload?: Record<string, unknown>;
}

/**
 * The general Ecosystem Event Contract — Phase B of
 * identity-architecture-hardening-plan.md, per the client's explicit
 * request for a reusable event architecture so future NDY products don't
 * each need a bespoke sync mechanism. Deliberately a log, not a data
 * warehouse: per the client's own scoping principle, this records that
 * "a booking was created," it does not become NDYSTAYS' booking table.
 *
 * RewardEngineService remains the sole authority on NDYBITS crediting —
 * this service is a *front door* that also forwards reward-eligible
 * event types to it (using the same eventType as RewardRule.eventKey by
 * convention), not a replacement for it. An event type with no matching
 * RewardRule just gets logged, which is the expected, unremarkable case
 * for most ecosystem events (identity.updated has no reward attached).
 */
@Injectable()
export class EcosystemEventService {
  private readonly logger = new Logger(EcosystemEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardEngine: RewardEngineService,
  ) {}

  async report(input: ReportEcosystemEventInput) {
    if (!isRegisteredEventType(input.eventType)) {
      throw new BadRequestException(
        `Unknown event type "${input.eventType}" — see event-catalog.ts for the registered list.`,
      );
    }

    let event: Prisma.PromiseReturnType<
      typeof this.prisma.ecosystemEvent.create
    >;
    try {
      event = await this.prisma.ecosystemEvent.create({
        data: {
          eventType: input.eventType,
          userId: input.userId,
          reportedByClientId: input.reportedByClientId,
          payload: input.payload as Prisma.InputJsonValue | undefined,
          sourceEventId: input.sourceEventId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Idempotent — a retried report of the same event returns the
        // original row instead of being logged twice, same contract as
        // every other sourceEventId field in this schema.
        return this.prisma.ecosystemEvent.findUniqueOrThrow({
          where: { sourceEventId: input.sourceEventId },
        });
      }
      throw err;
    }

    // Best-effort forward to the Reward Engine — never lets a reward
    // decision (or its absence) fail the event report itself. Uses a
    // distinct, prefixed sourceEventId so this event log's uniqueness key
    // and RewardEngineService's own NdyEconomyEventLog key stay
    // independent, same pattern RewardEngineService itself already uses
    // for NdybitsService.creditNdybits.
    try {
      await this.rewardEngine.handleVerifiedEvent({
        eventKey: input.eventType,
        userId: input.userId,
        sourceEventId: `ecosystem-event:${input.sourceEventId}`,
        reportedByClientId: input.reportedByClientId,
      });
    } catch (err) {
      this.logger.warn(
        `Reward Engine forward failed for ecosystem event ${event.id} (non-fatal): ${err}`,
      );
    }

    return event;
  }

  async listForUser(userId: string, take = 50) {
    return this.prisma.ecosystemEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
