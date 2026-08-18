import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Gates server-to-server internal endpoints (currently just
 * POST /internal/backup-alert, called by deploy/backup.sh running as a
 * root cron job on the same droplet — not a logged-in user, so
 * JwtAuthGuard doesn't apply). A shared secret in the x-internal-secret
 * header, checked with a constant-time-ish length+equality check (timing
 * attacks on a single-server internal endpoint are a low real-world risk,
 * but there's no cost to being careful). Fails closed: no
 * INTERNAL_ALERT_SECRET configured means the route refuses every request,
 * same discipline as every other guard in this codebase.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_ALERT_SECRET');
    if (!expected) {
      throw new ForbiddenException('Internal alerting is not configured.');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-internal-secret'];
    if (typeof provided !== 'string' || provided !== expected) {
      throw new UnauthorizedException('Invalid internal secret.');
    }

    return true;
  }
}
