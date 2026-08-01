import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  sessionCookieOptions,
} from './session-cookie.util';

/**
 * AuthController has seven different routes that can end in a freshly
 * issued session (register, login, refresh, the QR-login exchange, 2FA
 * verify, passkey login, OAuth exchange) — rather than repeating
 * `res.cookie(...)` in each handler, this catches any response shaped
 * like an IssuedSession and sets the cookies as a side effect. The
 * response body is left untouched: NDYAPPS and other API clients still
 * get the tokens directly, since they have no browser cookie jar to rely
 * on — this only adds the cookie, it doesn't replace the body.
 */
@Injectable()
export class SessionCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((body: unknown) => {
        if (isIssuedSession(body)) {
          response.cookie(
            ACCESS_TOKEN_COOKIE,
            body.accessToken,
            sessionCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE_MS),
          );
          response.cookie(
            REFRESH_TOKEN_COOKIE,
            body.refreshToken,
            sessionCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE_MS),
          );
        }
        return body;
      }),
    );
  }
}

function isIssuedSession(
  body: unknown,
): body is { accessToken: string; refreshToken: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>).accessToken === 'string' &&
    typeof (body as Record<string, unknown>).refreshToken === 'string'
  );
}
