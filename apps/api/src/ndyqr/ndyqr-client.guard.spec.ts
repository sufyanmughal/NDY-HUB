import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NdyQrClientGuard } from './guards/ndyqr-client.guard';
import { OAuthClientService } from '../oauth/oauth-client.service';

function makeContext(headers: Record<string, string>) {
  const request: { headers: Record<string, string>; ndyqrClient?: unknown } = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request };
}

function basic(clientId: string, secret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`;
}

function makeGuard(opts: {
  noScope?: boolean;
  client?: unknown;
  findByClientIdThrows?: boolean;
  secretValid?: boolean;
}) {
  const oauthClients = {
    findByClientId: opts.findByClientIdThrows
      ? jest.fn().mockRejectedValue(new Error('not found'))
      : jest.fn().mockResolvedValue(opts.client),
    verifySecret: jest.fn().mockReturnValue(opts.secretValid ?? true),
  };
  const reflector = {
    getAllAndOverride: jest
      .fn()
      .mockReturnValue(opts.noScope ? undefined : 'ndyqr:create'),
  };
  const guard = new NdyQrClientGuard(
    oauthClients as unknown as OAuthClientService,
    reflector as unknown as Reflector,
  );
  return { guard, oauthClients };
}

const CLIENT = { clientId: 'cl_quiz', allowedScopes: ['ndyqr:create'] };

describe('NdyQrClientGuard', () => {
  it('fails closed when the route declares no scope', async () => {
    const { guard } = makeGuard({ noScope: true });
    const { context } = makeContext({ authorization: basic('cl_quiz', 's') });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a request with no credentials', async () => {
    const { guard } = makeGuard({});
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a non-Basic authorization header', async () => {
    const { guard } = makeGuard({});
    const { context } = makeContext({ authorization: 'Bearer abc' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown client with the same 401 as a bad secret', async () => {
    const { guard } = makeGuard({ findByClientIdThrows: true });
    const { context } = makeContext({ authorization: basic('cl_x', 's') });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a wrong secret', async () => {
    const { guard } = makeGuard({ client: CLIENT, secretValid: false });
    const { context } = makeContext({ authorization: basic('cl_quiz', 'bad') });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a valid client that lacks the required scope', async () => {
    const { guard } = makeGuard({
      client: { clientId: 'cl_other', allowedScopes: ['profile:read'] },
    });
    const { context } = makeContext({ authorization: basic('cl_other', 's') });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('accepts a client holding the scope and attaches the client id', async () => {
    const { guard } = makeGuard({ client: CLIENT });
    const { context, request } = makeContext({
      authorization: basic('cl_quiz', 's'),
    });
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.ndyqrClient).toEqual({ clientId: 'cl_quiz' });
  });
});
