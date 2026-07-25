import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  create(
    @Body() dto: CreateSupportTicketDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.support.createTicket(user.sub, dto);
  }

  @Get('tickets')
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.support.listMyTickets(user.sub);
  }
}
