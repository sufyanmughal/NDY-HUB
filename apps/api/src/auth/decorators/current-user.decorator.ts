import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequestUser } from '../guards/jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedRequestUser }>();
    return request.user;
  },
);
