import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { OAuthAccessTokenPayload } from '../oauth-token.service';

export const CurrentOAuthUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): OAuthAccessTokenPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { oauthUser: OAuthAccessTokenPayload }>();
    return request.oauthUser;
  },
);
