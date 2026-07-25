import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  OAuthTokenService,
  type OAuthAccessTokenPayload,
} from '../oauth-token.service';

/**
 * Verifies a token issued by OAuthTokenService.issueTokenSet, not the
 * internal dashboard session token JwtAuthGuard checks — the two are
 * shaped differently (this one carries client_id + scope, has no sid) and
 * are never interchangeable, even though both happen to be signed with the
 * same underlying secret today.
 */
@Injectable()
export class OAuthAccessTokenGuard implements CanActivate {
  constructor(private readonly tokens: OAuthTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { oauthUser?: OAuthAccessTokenPayload }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    request.oauthUser = await this.tokens.verifyAccessToken(
      header.slice('Bearer '.length),
    );
    return true;
  }
}
