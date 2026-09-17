import { SetMetadata } from '@nestjs/common';

export const NDYQR_SCOPE_KEY = 'requiredNdyQrScope';

/**
 * Pairs with NdyQrClientGuard — `@UseGuards(NdyQrClientGuard)` plus
 * `@RequireNdyQrScope('ndyqr:create')`. Same shape as
 * ndy-economy's RequireEconomyScope, one resource over: an OAuthClient's
 * allowedScopes instead of a user's Role. Scope strings follow oauth/scopes.ts's
 * "add scopes as real clients need them" convention — no pre-registered catalog.
 */
export const RequireNdyQrScope = (scope: string) =>
  SetMetadata(NDYQR_SCOPE_KEY, scope);
