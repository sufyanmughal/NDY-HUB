import { Controller, Get, UseGuards } from '@nestjs/common';
import { CryndyPurchaseStatus, MembershipStatus } from '@prisma/client';
import { OAuthAccessTokenGuard } from './guards/oauth-access-token.guard';
import { CurrentOAuthUser } from './decorators/current-oauth-user.decorator';
import type { OAuthAccessTokenPayload } from './oauth-token.service';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG } from '../membership/tier-config';
import { parseScope } from './scopes';

const SPENDABLE_STATUSES: readonly CryndyPurchaseStatus[] = [
  CryndyPurchaseStatus.AVAILABLE,
  CryndyPurchaseStatus.DISTRIBUTED_ON_CHAIN,
];

@UseGuards(OAuthAccessTokenGuard)
@Controller('oauth')
export class UserInfoController {
  constructor(
    private readonly identity: IdentityService,
    private readonly prisma: PrismaService,
  ) {}

  /** Standard OIDC userinfo endpoint — claims are filtered to exactly what
   * the token's scope covers, not everything NDY HUB knows about the user.
   * A client that only asked for `openid profile` never sees an email
   * address back from this call, regardless of what it could theoretically
   * fetch elsewhere. Queries Membership/CryndyPurchase directly rather than
   * through MembershipService/CryndyService — same "cross-cutting read
   * doesn't need to go through the owning module's guarded service" call
   * as TransactionsService and DocumentsService already make. */
  @Get('userinfo')
  async userinfo(@CurrentOAuthUser() oauthUser: OAuthAccessTokenPayload) {
    const user = await this.identity.findById(oauthUser.sub);
    const scopes = parseScope(oauthUser.scope);

    const claims: Record<string, unknown> = {
      sub: user.id,
      ndy_id: user.ndyId,
    };
    if (scopes.includes('profile')) claims.name = user.fullName;
    if (scopes.includes('email')) claims.email = user.email;

    if (scopes.includes('membership')) {
      const membership = await this.prisma.membership.findFirst({
        where: { userId: user.id, status: MembershipStatus.ACTIVE },
      });
      claims.membership = membership
        ? TIER_CONFIG[membership.tier].label
        : null;
    }

    if (scopes.includes('cryndy')) {
      const purchases = await this.prisma.cryndyPurchase.findMany({
        where: { userId: user.id, status: { in: [...SPENDABLE_STATUSES] } },
      });
      claims.cryndy_available_balance = purchases.reduce(
        (sum, p) => sum + Number(p.cryndyAmount) + Number(p.bonusAmount),
        0,
      );
    }

    return claims;
  }
}
