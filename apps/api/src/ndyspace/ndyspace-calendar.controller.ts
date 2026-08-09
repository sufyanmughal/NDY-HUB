import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { NdyspaceCalendarService } from './ndyspace-calendar.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from './dto/calendar.dto';

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/calendar')
export class NdyspaceCalendarController {
  constructor(private readonly calendar: NdyspaceCalendarService) {}

  @Post('events')
  create(
    @Body() dto: CreateCalendarEventDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.calendar.create(user.sub, dto);
  }

  // Month-view grid — `from`/`to` are ISO date strings for the visible
  // range (usually the full weeks spanning the month, not just the 1st-31st).
  @Get('events')
  list(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.calendar.listInRange(user.sub, new Date(from), new Date(to));
  }

  @Get('events/upcoming')
  upcoming(
    @Query('take') take: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.calendar.listUpcoming(user.sub, take ? Number(take) : 5);
  }

  @Get('events/:id')
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.calendar.getOne(user.sub, id);
  }

  @Patch('events/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.calendar.update(user.sub, id, dto);
  }

  @Delete('events/:id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.calendar.remove(user.sub, id);
  }
}
