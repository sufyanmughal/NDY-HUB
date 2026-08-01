import type { Request } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  readSessionCookie,
  sessionCookieOptions,
} from './session-cookie.util';

describe('sessionCookieOptions', () => {
  const originalVercel = process.env.VERCEL;

  afterEach(() => {
    process.env.VERCEL = originalVercel;
  });

  it('is not Secure locally (process.env.VERCEL unset) — a Secure cookie is dropped over plain http://localhost', () => {
    delete process.env.VERCEL;
    const options = sessionCookieOptions(1000);
    expect(options.secure).toBe(false);
  });

  it('is Secure when deployed on Vercel (always HTTPS there)', () => {
    process.env.VERCEL = '1';
    const options = sessionCookieOptions(1000);
    expect(options.secure).toBe(true);
  });

  it('is always httpOnly, SameSite=Lax, and scoped to the whole app', () => {
    const options = sessionCookieOptions(1000);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
  });

  it('carries through the requested max age', () => {
    expect(sessionCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE_MS).maxAge).toBe(
      ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
    );
    expect(sessionCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE_MS).maxAge).toBe(
      REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    );
  });
});

describe('readSessionCookie', () => {
  it('reads the named cookie when present', () => {
    const req = {
      cookies: { [ACCESS_TOKEN_COOKIE]: 'abc123' },
    } as unknown as Request;
    expect(readSessionCookie(req, ACCESS_TOKEN_COOKIE)).toBe('abc123');
  });

  it('returns undefined when the cookie is absent', () => {
    const req = { cookies: {} } as unknown as Request;
    expect(readSessionCookie(req, REFRESH_TOKEN_COOKIE)).toBeUndefined();
  });

  it('returns undefined when req.cookies itself is undefined (cookie-parser not applied)', () => {
    const req = {} as unknown as Request;
    expect(readSessionCookie(req, ACCESS_TOKEN_COOKIE)).toBeUndefined();
  });
});
