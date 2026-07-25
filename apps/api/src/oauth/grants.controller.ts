import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { GrantService } from './grant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

/**
 * "Connected websites" on the Security page — the user-facing read/revoke
 * side of GrantService. Separate from OAuthClientAdminController, which
 * manages the client *registry*, not what a given user has authorized.
 * Guarded by the internal dashboard JwtAuthGuard, not OAuthAccessTokenGuard
 * — this is NDY HUB's own UI acting on the user's behalf, not a relying
 * party calling in.
 */
@UseGuards(JwtAuthGuard)
@Controller('oauth/grants')
export class GrantsController {
  constructor(private readonly grants: GrantService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedRequestUser) {
    const grants = await this.grants.listForUser(user.sub);
    return grants.map((grant) => ({
      id: grant.id,
      clientName: grant.client.name,
      clientId: grant.client.clientId,
      scope: grant.scope,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
    }));
  }

  @Delete(':id')
  revoke(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.grants.revoke(user.sub, id);
  }
}
