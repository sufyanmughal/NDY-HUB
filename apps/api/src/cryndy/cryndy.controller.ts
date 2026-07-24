import { Controller, Get, UseGuards } from '@nestjs/common';
import { CryndyService } from './cryndy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@Controller('cryndy')
export class CryndyController {
  constructor(private readonly cryndy: CryndyService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMySummary(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.cryndy.getUserSummary(user.sub);
  }
}
