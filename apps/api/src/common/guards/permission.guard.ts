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
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { roleHasPermission, type Permission } from '../permissions';

/**
 * Replaces the old AdminGuard/FounderGuard pair — one guard, driven by
 * whatever @RequirePermission() the route declares, checked against
 * common/permissions.ts's role->permission map instead of a hardcoded role
 * list. Always chained after JwtAuthGuard (`@UseGuards(JwtAuthGuard,
 * PermissionGuard)`), which is what sets req.user.
 *
 * Deliberately re-checks the role against the database on every request
 * instead of trusting a role claim baked into the JWT — a demoted admin's
 * already-issued access token should stop working immediately, not linger
 * for up to 15 minutes the way session revocation does for ordinary
 * logout. Admin actions are rare enough that the extra query is worth it.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      // A route guarded by PermissionGuard with no @RequirePermission() is
      // a wiring mistake, not "open to everyone" — fail closed.
      throw new ForbiddenException('No permission configured for this route.');
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedRequestUser }>();
    if (!request.user) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { role: true },
    });

    if (!user || !roleHasPermission(user.role, required)) {
      throw new ForbiddenException(`Missing required permission: ${required}.`);
    }

    return true;
  }
}
