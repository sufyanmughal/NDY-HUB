import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { NdyspaceNotificationsService } from './ndyspace-notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/notifications')
export class NdyspaceNotificationsController {
  constructor(private readonly notifications: NdyspaceNotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.notifications.list(user.sub);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.notifications
      .unreadCount(user.sub)
      .then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.notifications.markRead(user.sub, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.notifications.markAllRead(user.sub);
  }
}
