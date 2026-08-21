import { SetMetadata } from '@nestjs/common';

export const ECOSYSTEM_EVENT_SCOPE_KEY = 'requiredEcosystemEventScope';

/**
 * Pairs with EcosystemEventClientGuard — same shape as
 * ndy-economy/decorators/require-economy-scope.decorator.ts, one module
 * over. New scope strings follow oauth/scopes.ts's own "add scopes as
 * real clients need them, not speculatively" convention.
 */
export const RequireEcosystemEventScope = (scope: string) =>
  SetMetadata(ECOSYSTEM_EVENT_SCOPE_KEY, scope);
