import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RewardEngineService } from '../ndybits/reward-engine.service';
import { EconomyClientGuard } from './guards/economy-client.guard';
import { RequireEconomyScope } from './decorators/require-economy-scope.decorator';
import { ReportEventDto } from './dto/report-event.dto';
import type { EconomyClientContext } from './guards/economy-client.guard';

/**
 * Server-to-server only — the client's explicit "NDYQUIZ sends
 * QUIZ_COMPLETED, NDYHUB's Reward Engine determines the reward, apps
 * must never independently create balances" requirement, made real.
 * Never reachable by an end user's own session (JwtAuthGuard is not
 * used here at all) — only a registered OAuthClient with the
 * ndybits:report-event scope can call this.
 */
@UseGuards(EconomyClientGuard)
@Controller('ndy-economy/events')
export class NdyEconomyEventsController {
  constructor(private readonly rewardEngine: RewardEngineService) {}

  @Post('report')
  @RequireEconomyScope('ndybits:report-event')
  report(
    @Body() dto: ReportEventDto,
    @Req() req: Request & { economyClient?: EconomyClientContext },
  ) {
    return this.rewardEngine.handleVerifiedEvent({
      eventKey: dto.eventKey,
      userId: dto.userId,
      sourceEventId: dto.sourceEventId,
      reportedByClientId: req.economyClient?.clientId,
    });
  }
}
