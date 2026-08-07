import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService } from '../auth/security-event.service';
import { normalizeScope, parseScope } from './scopes';

@Injectable()
export class GrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  /** A returning user whose existing grant already covers everything the
   * client is asking for this time skips the consent screen — that's the
   * actual "one login, not one login per visit" promise for SSO. */
  async findExistingCoveringGrant(
    userId: string,
    clientDbId: string,
    requestedScope: string,
  ) {
    const grant = await this.prisma.oAuthGrant.findUnique({
      where: { userId_clientId: { userId, clientId: clientDbId } },
    });
    if (!grant || grant.revokedAt) return null;

    const granted = parseScope(grant.scope);
    const requested = parseScope(requestedScope);
    const covers = requested.every((s) => granted.includes(s));
    return covers ? grant : null;
  }

  async upsertGrant(userId: string, clientDbId: string, scope: string) {
    const existing = await this.prisma.oAuthGrant.findUnique({
      where: { userId_clientId: { userId, clientId: clientDbId } },
    });
    const mergedScope = existing
      ? normalizeScope([...parseScope(existing.scope), ...parseScope(scope)])
      : normalizeScope(parseScope(scope));

    const grant = await this.prisma.oAuthGrant.upsert({
      where: { userId_clientId: { userId, clientId: clientDbId } },
      create: { userId, clientId: clientDbId, scope: mergedScope },
      update: { scope: mergedScope, revokedAt: null },
    });
    // Only a brand-new grant counts as "connected" — re-consenting to a
    // wider scope on an existing connection isn't a new event worth
    // surfacing in the security timeline.
    if (!existing) {
      void this.securityEvents.record(userId, 'OAUTH_APP_CONNECTED');
    }
    return grant;
  }

  async listForUser(userId: string) {
    return this.prisma.oAuthGrant.findMany({
      where: { userId, revokedAt: null },
      include: { client: { select: { name: true, clientId: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Revoking a connection also kills any refresh tokens that client holds
   * for this user — "Revoke a website connection" needs to actually cut
   * access, not just hide the tile. */
  async revoke(userId: string, grantId: string) {
    const grant = await this.prisma.oAuthGrant.findUnique({
      where: { id: grantId },
    });
    if (!grant || grant.userId !== userId) {
      return; // nothing to revoke, or not this user's — same result either way
    }
    await this.prisma.$transaction([
      this.prisma.oAuthGrant.update({
        where: { id: grantId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.oAuthRefreshToken.updateMany({
        where: { userId, clientId: grant.clientId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    void this.securityEvents.record(userId, 'OAUTH_APP_REVOKED');
  }
}
