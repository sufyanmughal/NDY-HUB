import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { EcosystemEventService } from './ecosystem-event.service';
import { EcosystemEventClientGuard } from './guards/ecosystem-event-client.guard';
import { RequireEcosystemEventScope } from './decorators/require-ecosystem-event-scope.decorator';
import { ReportEcosystemEventDto } from './dto/report-ecosystem-event.dto';
import type { EcosystemEventClientContext } from './guards/ecosystem-event-client.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

/**
 * Server-to-server only — the general Ecosystem Event Contract's intake
 * endpoint (Phase B of identity-architecture-hardening-plan.md). Never
 * reachable by an end user's own session; only a registered OAuthClient
 * with the ecosystem:report-event scope can call it. See
 * ndy-economy-events.controller.ts for the sibling this generalizes.
 */
@UseGuards(EcosystemEventClientGuard)
@Controller('ecosystem/events')
export class EcosystemEventsController {
  constructor(private readonly ecosystemEvents: EcosystemEventService) {}

  @Post('report')
  @RequireEcosystemEventScope('ecosystem:report-event')
  report(
    @Body() dto: ReportEcosystemEventDto,
    @Req()
    req: Request & { ecosystemEventClient?: EcosystemEventClientContext },
  ) {
    return this.ecosystemEvents.report({
      eventType: dto.eventType,
      userId: dto.userId,
      sourceEventId: dto.sourceEventId,
      payload: dto.payload,
      reportedByClientId: req.ecosystemEventClient?.clientId,
    });
  }

  /**
   * Server-to-server feed for consumers that process the whole event
   * log rather than one user's activity — NDYCORE's ingestion layer is
   * the first caller. Deliberately a separate scope
   * (ecosystem:read-events) from report-event: a client that's allowed
   * to log events isn't automatically allowed to read every user's
   * event history back out.
   */
  @Get()
  @RequireEcosystemEventScope('ecosystem:read-events')
  list(
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.ecosystemEvents.listSince({
      cursor,
      take: take ? Number(take) : undefined,
      eventType,
    });
  }
}

/** The user-facing side — a signed-in user reading their own ecosystem
 * activity feed, separate from the server-to-server report() above. */
@UseGuards(JwtAuthGuard)
@Controller('ecosystem/events')
export class EcosystemEventsMeController {
  constructor(private readonly ecosystemEvents: EcosystemEventService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.ecosystemEvents.listForUser(user.sub);
  }
}
