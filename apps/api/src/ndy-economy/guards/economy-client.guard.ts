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
import { ECONOMY_SCOPE_KEY } from '../decorators/require-economy-scope.decorator';

export interface EconomyClientContext {
  clientId: string;
}

/**
 * Server-to-server auth for the NDY Economy API — an ecosystem app (e.g.
 * NDYQUIZ) reporting a verified event, never a logged-in user's own
 * session (that's JwtAuthGuard's job elsewhere). Reuses OAuthClientService
 * — the same registered-client concept already trusted for OAuth — rather
 * than a second client registry. Client authenticates via HTTP Basic auth
 * (clientId as username, clientSecret as password), the standard shape
 * for a client-credentials-style call, distinct from the Bearer-token
 * shape user-delegated OAuthAccessTokenGuard checks.
 *
 * Per the client's explicit "apps send verified events, NDYHUB's Reward
 * Engine decides the reward amount, apps must never independently create
 * balances" requirement — this guard is what makes "reported by a
 * registered client" a real, checkable fact rather than an unenforced
 * convention.
 */
@Injectable()
export class EconomyClientGuard implements CanActivate {
  constructor(
    private readonly oauthClients: OAuthClientService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScope = this.reflector.getAllAndOverride<string | undefined>(
      ECONOMY_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredScope) {
      throw new ForbiddenException(
        'No economy scope configured for this route.',
      );
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { economyClient?: EconomyClientContext }>();

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

    // findByClientId throws NotFoundException for an unknown/inactive
    // client rather than returning null — caught here and normalized to
    // 401, since a caller with the wrong client_id shouldn't get a
    // different response shape than one with the wrong secret (that
    // distinction would let an attacker enumerate valid client ids).
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

    request.economyClient = { clientId: client.clientId };
    return true;
  }
}
