import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { NdyspaceOverviewService } from './ndyspace-overview.service';

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/overview')
export class NdyspaceOverviewController {
  constructor(private readonly overview: NdyspaceOverviewService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.overview.getOverview(user.sub);
  }

  @Get('mini-calendar')
  getMiniCalendar(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.overview.getMonthEventDates(user.sub, year, month);
  }
}
