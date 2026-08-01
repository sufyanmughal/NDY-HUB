import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequestUser } from '../../auth/guards/jwt-auth.guard';

/**
 * Stricter than AdminGuard — FOUNDER only, no ADMIN fallback. Founder
 * Mission Control's own endpoints (ecosystem overview, revenue, etc.) are
 * meant to be exclusive to the founder role per the client's spec; an
 * ordinary admin uses the regular /admin endpoints instead (still reachable
 * from within Founder Mission Control's User Management screen, which is
 * why AdminGuard itself accepts FOUNDER — this guard is the other
 * direction: ADMIN does not get FOUNDER's screens).
 */
@Injectable()
export class FounderGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    if (!user || user.role !== Role.FOUNDER) {
      throw new ForbiddenException('Founder access required.');
    }

    return true;
  }
}
