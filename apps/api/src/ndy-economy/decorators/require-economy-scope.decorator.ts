import { SetMetadata } from '@nestjs/common';

export const ECONOMY_SCOPE_KEY = 'requiredEconomyScope';

/**
 * Pairs with EconomyClientGuard — `@UseGuards(EconomyClientGuard)` plus
 * `@RequireEconomyScope('ndybits:report-event')`. Same shape as
 * common/decorators/require-permission.decorator.ts, one axis over: an
 * OAuthClient's allowedScopes instead of a user's Role. New scope strings
 * follow oauth/scopes.ts's own "add scopes as real clients need them, not
 * speculatively" convention — this file doesn't pre-register a catalog.
 */
export const RequireEconomyScope = (scope: string) =>
  SetMetadata(ECONOMY_SCOPE_KEY, scope);
