import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AI_AGENT_SCOPES, ContextBrokerService } from './context-broker.service';
import { GrantAiAgentConsentDto } from './dto/grant-consent.dto';

/**
 * The user-facing half of the Context Broker — the consent screen's backend.
 * A user manages which AI agents may act on their behalf, and within which
 * scopes. Structurally an OAuth consent screen because it is one: the agent is
 * an OAuthClient, and revoking here takes effect on the next action the agent
 * attempts.
 */
@UseGuards(JwtAuthGuard)
@Controller('context-broker')
export class ContextBrokerController {
  constructor(private readonly broker: ContextBrokerService) {}

  /** The scopes a user can grant, for rendering the consent screen. */
  @Get('scopes')
  scopes() {
    return { scopes: AI_AGENT_SCOPES };
  }

  @Get('grants')
  listGrants(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.broker.listGrants(user.sub);
  }

  @Post('grants')
  grant(
    @Body() dto: GrantAiAgentConsentDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.broker.grant(user.sub, dto.oauthClientId, dto.scopes);
  }

  @Delete('grants/:oauthClientId')
  revoke(
    @Param('oauthClientId') oauthClientId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.broker.revoke(user.sub, oauthClientId);
  }
}
