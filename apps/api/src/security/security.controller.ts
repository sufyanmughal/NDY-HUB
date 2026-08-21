import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SecurityService } from './security.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('security/sessions')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.security.listActiveSessions(user.sub, user.sid);
  }

  @Delete(':id')
  revoke(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.security.revokeSession(user.sub, id);
  }

  @Post('revoke-all')
  revokeAll(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.security.revokeAllSessions(user.sub);
  }
}

/**
 * Central, ecosystem-wide device management — Phase D of
 * identity-architecture-hardening-plan.md. Deliberately its own
 * controller/route prefix (not folded into /security/sessions above)
 * since a Device is a distinct, longer-lived concept from a single
 * Session — one device accumulates many sessions/OAuth grants over time,
 * and revoking it kills all of them across every connected NDY product,
 * not one row.
 */
@UseGuards(JwtAuthGuard)
@Controller('security/devices')
export class SecurityDevicesController {
  constructor(private readonly security: SecurityService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.security.listDevices(user.sub);
  }

  @Delete(':id')
  revoke(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.security.revokeDevice(user.sub, id);
  }
}
