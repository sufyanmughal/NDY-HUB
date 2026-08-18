import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequestUser } from '../../auth/guards/jwt-auth.guard';
import { WORKSPACE_ROLE_KEY } from '../decorators/require-workspace-role.decorator';
import type { WorkspaceRole } from '@prisma/client';

/**
 * Same pattern as common/guards/permission.guard.ts, one axis over: checks
 * WorkspaceMembership.role for the workspace named in the route instead of
 * the platform-wide Role on User. Always chained after JwtAuthGuard.
 *
 * Fails closed exactly like PermissionGuard does: a route guarded by
 * WorkspaceGuard with no @RequireWorkspaceRole() is a wiring mistake, not
 * "open to any member." Re-queries membership per request rather than
 * trusting anything cached, for the same reason PermissionGuard re-queries
 * role — a removed member's already-issued access token should stop
 * working immediately.
 *
 * Resolves the target workspace from `req.params.workspaceId` by default.
 * Routes that carry the id somewhere else (body, a differently-named
 * param) aren't supported yet — none exist as of Phase 1; extend this
 * resolution when one does, rather than special-casing it speculatively.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      WorkspaceRole[] | undefined
    >(WORKSPACE_ROLE_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) {
      throw new ForbiddenException(
        'No workspace role configured for this route.',
      );
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedRequestUser }>();
    if (!request.user) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const workspaceIdParam = request.params?.workspaceId;
    // Express types a route param as string | string[] (repeated URL
    // segments) even though a single :workspaceId segment always yields a
    // plain string in practice — narrow explicitly rather than trusting that.
    const workspaceId = Array.isArray(workspaceIdParam)
      ? workspaceIdParam[0]
      : workspaceIdParam;
    if (!workspaceId) {
      throw new ForbiddenException('No workspaceId in the route.');
    }

    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: request.user.sub } },
    });

    if (!membership || !required.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires workspace role ${required.join(' or ')} in this workspace.`,
      );
    }

    return true;
  }
}
