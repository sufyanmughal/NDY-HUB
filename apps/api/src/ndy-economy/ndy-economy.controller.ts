import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { BridgeRequestService } from './bridge-request.service';
import { BridgeEligibilityService } from './bridge-eligibility.service';
import { CreateBridgeRequestDto } from './dto/create-bridge-request.dto';
import { CheckEligibilityDto } from './dto/check-eligibility.dto';

/**
 * The user-facing half of the NDY Economy API (client's spec §26) — the
 * other half is EconomyEventsController's server-to-server event intake.
 * "check bridge eligibility" and "create bridge request" from the
 * client's own list are both here; both stop at ELIGIBLE/INELIGIBLE per
 * BridgeRequestService's own scope note — no EXECUTED path exists yet.
 */
@UseGuards(JwtAuthGuard)
@Controller('ndy-economy')
export class NdyEconomyController {
  constructor(
    private readonly bridgeRequests: BridgeRequestService,
    private readonly eligibility: BridgeEligibilityService,
  ) {}

  @Post('bridge/check-eligibility')
  checkEligibility(
    @Body() dto: CheckEligibilityDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.eligibility.checkEligibility(
      user.sub,
      dto.direction,
      dto.sourceAmount,
    );
  }

  @Post('bridge/requests')
  createBridgeRequest(
    @Body() dto: CreateBridgeRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.bridgeRequests.create(
      user.sub,
      dto.direction,
      dto.sourceAmount,
    );
  }

  @Get('bridge/requests')
  listBridgeRequests(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.bridgeRequests.listForUser(user.sub);
  }

  @Get('bridge/requests/:id')
  getBridgeRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.bridgeRequests.getOne(user.sub, id);
  }
}
