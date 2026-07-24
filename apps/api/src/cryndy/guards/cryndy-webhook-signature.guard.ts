import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

const SIGNATURE_HEADER = 'x-cryndy-signature';

/**
 * The presale site is a separate, unauthenticated caller (no NDY session),
 * so instead of JwtAuthGuard this checks an HMAC-SHA256 signature over the
 * exact raw request body, using a secret only NDY HUB and the presale site
 * know. Requires `rawBody: true` on the Nest app (see main.ts) — verifying
 * against the re-serialized JSON body would break the moment key order or
 * whitespace differs from what the sender signed.
 */
@Injectable()
export class CryndyWebhookSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const signature = request.headers[SIGNATURE_HEADER];
    const rawBody = request.rawBody;

    if (typeof signature !== 'string' || !rawBody) {
      throw new UnauthorizedException('Missing webhook signature.');
    }

    const secret = this.config.getOrThrow<string>('CRYNDY_WEBHOOK_SECRET');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const provided = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (
      provided.length !== expectedBuf.length ||
      !timingSafeEqual(provided, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    return true;
  }
}
