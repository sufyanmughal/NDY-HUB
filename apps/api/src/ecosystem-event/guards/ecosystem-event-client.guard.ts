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
import { ECOSYSTEM_EVENT_SCOPE_KEY } from '../decorators/require-ecosystem-event-scope.decorator';

export interface EcosystemEventClientContext {
  clientId: string;
}

/**
 * Server-to-server auth for the general Ecosystem Event Contract (Phase B
 * of identity-architecture-hardening-plan.md) — structurally identical to
 * ndy-economy/guards/economy-client.guard.ts (same OAuthClientService
 * registered-client check, same Basic-auth shape), kept as its own guard
 * rather than importing the economy one so this module doesn't take on an
 * economy-domain dependency for what's meant to be the general-purpose
 * event intake every NDY product uses, not an economy extension.
 */
@Injectable()
export class EcosystemEventClientGuard implements CanActivate {
  constructor(
    private readonly oauthClients: OAuthClientService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScope = this.reflector.getAllAndOverride<string | undefined>(
      ECOSYSTEM_EVENT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredScope) {
      throw new ForbiddenException(
        'No ecosystem event scope configured for this route.',
      );
    }

    const request = context
      .switchToHttp()
      .getRequest<
        Request & { ecosystemEventClient?: EcosystemEventClientContext }
      >();

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

    // Same "unknown client and wrong secret get the same error" reasoning
    // as EconomyClientGuard — a different response shape for an unknown
    // client_id would let an attacker enumerate valid ones.
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

    request.ecosystemEventClient = { clientId: client.clientId };
    return true;
  }
}
