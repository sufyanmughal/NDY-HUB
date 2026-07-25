import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { OAuthClientService } from './oauth-client.service';
import { AuthorizationCodeService } from './authorization-code.service';
import { GrantService } from './grant.service';
import { ConsentDto } from './dto/consent.dto';
import { OIDC_SCOPES, isSubsetScope, parseScope } from './scopes';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@Controller('oauth')
export class AuthorizeController {
  constructor(
    private readonly clients: OAuthClientService,
    private readonly codes: AuthorizationCodeService,
    private readonly grants: GrantService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The entry point a relying party's browser redirect lands on. Never
   * redirects anywhere on a bad client_id or redirect_uri — that's exactly
   * the open-redirect shape phishing depends on — it renders a plain error
   * instead. A valid request hands off to the web app's /oauth/consent
   * page, which is what actually knows whether this browser is logged into
   * NDY HUB (this API-only redirect has no access to that — see the
   * frontend consent page for why).
   */
  @Get('authorize')
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('scope') scope: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (responseType !== 'code') {
      throw new BadRequestException('Only response_type=code is supported.');
    }
    const client = await this.clients
      .findByClientId(clientId)
      .catch(() => null);
    if (!client) {
      throw new BadRequestException('Unknown client_id.');
    }
    if (!client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException(
        'redirect_uri is not registered for this client.',
      );
    }

    const requestedScope = parseScope(scope ?? 'openid');
    if (!isSubsetScope(requestedScope, client.allowedScopes)) {
      throw new BadRequestException(
        'One or more requested scopes are not allowed for this client.',
      );
    }

    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    const consentUrl = new URL('/oauth/consent', webAppUrl);
    consentUrl.searchParams.set('client_id', clientId);
    consentUrl.searchParams.set('redirect_uri', redirectUri);
    consentUrl.searchParams.set('scope', requestedScope.join(' '));
    if (state) consentUrl.searchParams.set('state', state);

    res.redirect(consentUrl.toString());
  }

  /** Called by the consent page once it knows who's logged in — tells it
   * whether to show the approve/deny screen at all, or skip straight
   * through because this user already granted everything being asked for. */
  @UseGuards(JwtAuthGuard)
  @Get('authorize/status')
  async status(
    @Query('client_id') clientId: string,
    @Query('scope') scope: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const client = await this.clients.findByClientId(clientId);
    const publicInfo = await this.clients.getPublicInfo(clientId);
    const existingGrant = await this.grants.findExistingCoveringGrant(
      user.sub,
      client.id,
      scope,
    );

    return {
      client: publicInfo,
      scopeDescriptions: parseScope(scope).map((s) => ({
        scope: s,
        description: OIDC_SCOPES[s] ?? s,
      })),
      alreadyGranted: existingGrant !== null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('authorize/consent')
  async consent(
    @Body() dto: ConsentDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const client = await this.clients.findByClientId(dto.clientId);
    if (!client.redirectUris.includes(dto.redirectUri)) {
      throw new BadRequestException(
        'redirect_uri is not registered for this client.',
      );
    }
    const requestedScope = parseScope(dto.scope);
    if (!isSubsetScope(requestedScope, client.allowedScopes)) {
      throw new BadRequestException(
        'One or more requested scopes are not allowed for this client.',
      );
    }

    const redirectUrl = new URL(dto.redirectUri);

    if (!dto.approve) {
      redirectUrl.searchParams.set('error', 'access_denied');
      if (dto.state) redirectUrl.searchParams.set('state', dto.state);
      return { redirectUrl: redirectUrl.toString() };
    }

    await this.grants.upsertGrant(user.sub, client.id, dto.scope);
    const code = await this.codes.issue({
      userId: user.sub,
      clientId: client.id,
      redirectUri: dto.redirectUri,
      scope: dto.scope,
    });

    redirectUrl.searchParams.set('code', code);
    if (dto.state) redirectUrl.searchParams.set('state', dto.state);
    return { redirectUrl: redirectUrl.toString() };
  }
}
