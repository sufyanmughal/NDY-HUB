import { Controller, Get, UseGuards } from '@nestjs/common';
import { SecurityEventService } from '../auth/security-event.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('security/events')
export class SecurityEventsController {
  constructor(private readonly securityEvents: SecurityEventService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.securityEvents.listForUser(user.sub);
  }
}
