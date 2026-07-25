import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupportService } from './support.service';
import { ReplySupportTicketDto } from './dto/reply-support-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/support-tickets')
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list() {
    return this.support.adminListTickets();
  }

  @Post(':id/reply')
  reply(
    @Param('id') id: string,
    @Body() dto: ReplySupportTicketDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.support.replyToTicket(
      { id: user.sub, ndyId: user.ndyId, ip: req.ip },
      id,
      dto,
    );
  }
}
