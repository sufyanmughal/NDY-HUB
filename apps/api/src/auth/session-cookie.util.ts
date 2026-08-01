import type { CookieOptions, Request } from 'express';

export const ACCESS_TOKEN_COOKIE = 'ndyhub_access_token';
export const REFRESH_TOKEN_COOKIE = 'ndyhub_refresh_token';

// Mirrors SessionService's own TTLs — the cookie shouldn't outlive the
// token it carries.
export const ACCESS_TOKEN_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * `secure` needs to be false for local http://localhost dev (a `Secure`
 * cookie is silently dropped over plain HTTP) and true everywhere real —
 * Vercel always serves over HTTPS, hence the env check rather than
 * NODE_ENV, which can say "production" for a local production build too.
 *
 * `sameSite: 'lax'` relies on the web app proxying /api/* through its own
 * origin (see next.config.ts) so this cookie is same-site from the
 * browser's perspective — without that proxy, the frontend and API sit on
 * different vercel.app registrable domains and a cross-site cookie would
 * need SameSite=None, which Safari/Firefox increasingly block or
 * partition for third-party cookies.
 */
export function sessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: !!process.env.VERCEL,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

// cookie-parser types req.cookies as Record<string, any> — this is the one
// place that reads it, so every other call site gets a properly narrowed
// string | undefined instead of repeating the same unsafe indexing.
export function readSessionCookie(
  req: Request,
  name: typeof ACCESS_TOKEN_COOKIE | typeof REFRESH_TOKEN_COOKIE,
): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[name];
}
