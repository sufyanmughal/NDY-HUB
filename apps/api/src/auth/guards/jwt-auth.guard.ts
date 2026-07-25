import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedRequestUser {
  sub: string; // User.id
  ndyId: string;
  sid: string; // Session.id this access token was issued alongside
}

/**
 * Verifies the Bearer access token issued by SessionService and attaches
 * the decoded { sub, ndyId } as req.user. This is the guard the proposal
 * calls out as the thing standing between "anyone can approve a login as
 * anyone" and "only an already-logged-in NDYAPPS session can approve" —
 * it's what /login-request/:token/approve and /deny require now.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload =
        await this.jwt.verifyAsync<AuthenticatedRequestUser>(token);
      (request as Request & { user: AuthenticatedRequestUser }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}
