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
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(Permission.MANAGE_SUPPORT_TICKETS)
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
