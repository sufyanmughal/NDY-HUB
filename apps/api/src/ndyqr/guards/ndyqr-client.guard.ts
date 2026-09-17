import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { OAuthClientService } from '../../oauth/oauth-client.service';
import { NDYQR_SCOPE_KEY } from '../decorators/require-ndyqr-scope.decorator';

export interface NdyQrClientContext {
  clientId: string;
}

/**
 * Server-to-server auth for the NDYQR service endpoints — another NDY product's
 * backend creating codes on its own behalf, never a logged-in user's session
 * (that's JwtAuthGuard on the member route). Mirrors EconomyClientGuard exactly:
 * the same registered-OAuthClient registry NDY HUB already trusts, Basic auth
 * (clientId as username, clientSecret as password), and a required scope from
 * `@RequireNdyQrScope`.
 *
 * This is what makes "One NDYQR Core → many NDY products" enforceable rather
 * than aspirational: a product must be a registered client with the
 * ndyqr:create scope, and every code it makes is attributed to it by clientId.
 */
@Injectable()
export class NdyQrClientGuard implements CanActivate {
  constructor(
    private readonly oauthClients: OAuthClientService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScope = this.reflector.getAllAndOverride<string | undefined>(
      NDYQR_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredScope) {
      // Fail closed — same discipline as PermissionGuard.
      throw new ForbiddenException('No NDYQR scope configured for this route.');
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { ndyqrClient?: NdyQrClientContext }>();

    const header = request.headers.authorization;
    if (!header?.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing client credentials.');
    }

    const decoded = Buffer.from(
      header.slice('Basic '.length),
      'base64',
    ).toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Malformed client credentials.');
    }
    const clientId = decoded.slice(0, separatorIndex);
    const clientSecret = decoded.slice(separatorIndex + 1);

    // An unknown/inactive client and a wrong secret both return the same 401 —
    // otherwise the difference would let a caller enumerate valid client ids.
    let client: Awaited<ReturnType<OAuthClientService['findByClientId']>>;
    try {
      client = await this.oauthClients.findByClientId(clientId);
    } catch {
      throw new UnauthorizedException('Invalid client credentials.');
    }
    if (!this.oauthClients.verifySecret(client, clientSecret)) {
      throw new UnauthorizedException('Invalid client credentials.');
    }

    if (!client.allowedScopes.includes(requiredScope)) {
      throw new ForbiddenException(
        `Client is not authorized for the "${requiredScope}" scope.`,
      );
    }

    request.ndyqrClient = { clientId: client.clientId };
    return true;
  }
}
