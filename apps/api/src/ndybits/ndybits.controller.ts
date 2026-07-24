import { Controller, Get, UseGuards } from '@nestjs/common';
import { NdybitsService } from './ndybits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@Controller('ndybits')
export class NdybitsController {
  constructor(private readonly ndybits: NdybitsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMySummary(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.ndybits.getUserSummary(user.sub);
  }
}
