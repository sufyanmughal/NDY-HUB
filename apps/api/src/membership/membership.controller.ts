import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('memberships')
export class MembershipController {
  constructor(private readonly membership: MembershipService) {}

  // Pricing is public — no reason to require login just to see what a tier costs.
  @Get('tiers')
  getTiers() {
    return this.membership.getTierCatalogue();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMine(@CurrentUser() user: { sub: string }) {
    return this.membership.getCurrentAndHistory(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: { sub: string }) {
    return this.membership.subscribe(user.sub, dto.tier, dto.billingCycle);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.membership.cancel(user.sub, id);
  }
}
