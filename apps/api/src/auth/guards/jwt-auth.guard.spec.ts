import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ACCESS_TOKEN_COOKIE } from '../session-cookie.util';

function makeContext(request: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let jwt: { verifyAsync: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(jwt as unknown as JwtService);
  });

  it('rejects a request with no cookie and no Authorization header', async () => {
    const context = makeContext({ headers: {}, cookies: {} });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('accepts a token from the httpOnly cookie and attaches req.user', async () => {
    const payload = { sub: 'user-1', ndyId: 'NDY-1', sid: 'session-1' };
    jwt.verifyAsync.mockResolvedValue(payload);
    const request: Partial<Request> & { user?: unknown } = {
      headers: {},
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-token' },
    };
    const context = makeContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('cookie-token');
    expect(request.user).toEqual(payload);
  });

  it('accepts a Bearer header when there is no cookie (NDYAPPS/API clients)', async () => {
    const payload = { sub: 'user-2', ndyId: 'NDY-2', sid: 'session-2' };
    jwt.verifyAsync.mockResolvedValue(payload);
    const request: Partial<Request> & { user?: unknown } = {
      headers: { authorization: 'Bearer header-token' },
      cookies: {},
    };
    const context = makeContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('header-token');
  });

  it('prefers the cookie over a Bearer header when both are present', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u', ndyId: 'n', sid: 's' });
    const request: Partial<Request> = {
      headers: { authorization: 'Bearer header-token' },
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-token' },
    };
    const context = makeContext(request);

    await guard.canActivate(context);

    expect(jwt.verifyAsync).toHaveBeenCalledWith('cookie-token');
  });

  it('rejects an Authorization header that is not a Bearer token', async () => {
    const context = makeContext({
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
      cookies: {},
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when jwt verification throws (expired/invalid/tampered token)', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = makeContext({
      headers: {},
      cookies: { [ACCESS_TOKEN_COOKIE]: 'bad-token' },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
