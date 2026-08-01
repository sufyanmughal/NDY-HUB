import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PermissionGuard } from './permission.guard';
import { Permission } from '../permissions';
import { PrismaService } from '../../prisma/prisma.service';

function makeContext(user: { sub: string } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: PermissionGuard;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionGuard(
      prisma as unknown as PrismaService,
      reflector as unknown as Reflector,
    );
  });

  it('fails closed when the route has no @RequirePermission() at all', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = makeContext({ sub: 'user-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when JwtAuthGuard has not run (no req.user)', async () => {
    reflector.getAllAndOverride.mockReturnValue(Permission.MANAGE_USERS);
    const context = makeContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rejects when the user's current role lacks the required permission", async () => {
    reflector.getAllAndOverride.mockReturnValue(Permission.MANAGE_USERS);
    prisma.user.findUnique.mockResolvedValue({ role: Role.SUPPORT });
    const context = makeContext({ sub: 'user-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects when the user no longer exists (e.g. deleted after the token was issued)', async () => {
    reflector.getAllAndOverride.mockReturnValue(Permission.MANAGE_USERS);
    prisma.user.findUnique.mockResolvedValue(null);
    const context = makeContext({ sub: 'deleted-user' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows the request when the user's current role grants the required permission", async () => {
    reflector.getAllAndOverride.mockReturnValue(Permission.MANAGE_USERS);
    prisma.user.findUnique.mockResolvedValue({ role: Role.SUPER_ADMIN });
    const context = makeContext({ sub: 'user-1' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('re-checks the role from the database rather than trusting a stale JWT claim', async () => {
    // A demoted admin's already-issued access token still carries { sub },
    // but the DB now says USER — this is the whole point of the guard
    // querying fresh instead of trusting anything baked into the token.
    reflector.getAllAndOverride.mockReturnValue(Permission.MANAGE_ROLES);
    prisma.user.findUnique.mockResolvedValue({ role: Role.USER });
    const context = makeContext({ sub: 'demoted-admin' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'demoted-admin' },
      select: { role: true },
    });
  });
});
