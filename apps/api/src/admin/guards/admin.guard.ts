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
 * Always chained after JwtAuthGuard (`@UseGuards(JwtAuthGuard, AdminGuard)`),
 * which is what sets req.user. Deliberately re-checks the role against the
 * database on every request instead of trusting a role claim baked into the
 * JWT — a demoted admin's already-issued access token should stop working
 * immediately, not linger for up to 15 minutes the way session revocation
 * does for ordinary logout. Admin actions are rare enough that the extra
 * query is worth it.
 */
@Injectable()
export class AdminGuard implements CanActivate {
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

    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException('Admin access required.');
    }

    return true;
  }
}
