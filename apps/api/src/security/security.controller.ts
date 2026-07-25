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
