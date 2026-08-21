// The supported scope list — deliberately small. Real OIDC has a much
// richer claim set (per §15 of the proposal: business status, verification
// status, transaction access…), but each new scope is a new thing every
// client's consent screen has to explain honestly. Add scopes as real
// clients need them, not speculatively.
export const OIDC_SCOPES: Record<string, string> = {
  openid: 'Confirm who you are (required for every connection)',
  profile: 'Your name and NDY ID',
  email: 'Your email address',
  membership: 'Your current membership tier and status',
  cryndy: 'Your available CRYNDY balance',
  // Not an OIDC consent scope in the usual sense (no user ever sees or
  // approves this on a consent screen) — it's a server-to-server
  // capability grant for the NDY Economy event-intake endpoint, reusing
  // OAuthClient.allowedScopes' existing validated-scope-list mechanism
  // rather than a second scope vocabulary. See EconomyClientGuard.
  'ndybits:report-event':
    'Report verified ecosystem events for NDYBITS reward crediting',
  // Phase B (identity-architecture-hardening-plan.md) — same
  // server-to-server capability-grant shape as ndybits:report-event
  // above, for the general Ecosystem Event Contract's intake endpoint.
  // See EcosystemEventClientGuard.
  'ecosystem:report-event':
    'Report ecosystem-relevant events (identity/profile/membership/activity changes)',

  // Phase C (identity-architecture-hardening-plan.md) — granular
  // resource:action scopes, additive alongside the coarse ones above
  // (profile/membership/cryndy stay valid indefinitely; nothing below
  // replaces them). No :write scopes yet — every current OAuth-issued
  // flow is read-only from a relying party's perspective; a :write scope
  // implies a real mutation endpoint behind it, and none exists yet for
  // any of these. Add one alongside whatever endpoint actually needs it,
  // not speculatively.
  'profile:read': 'Read your Passport/profile fields',
  'membership:read': 'Read your current membership tier and status',
  'wallet:read': 'Read your NDYBITS and CRYNDY balances',
  'activity:read': 'Read your ecosystem activity feed',
  'connections:read': 'See which other NDY products/apps you have connected',
};

export const ALL_SCOPES = Object.keys(OIDC_SCOPES);

export function parseScope(scope: string): string[] {
  return scope.split(' ').filter(Boolean);
}

export function normalizeScope(scopes: string[]): string {
  return Array.from(new Set(scopes)).sort().join(' ');
}

export function isSubsetScope(requested: string[], allowed: string[]): boolean {
  return requested.every((s) => allowed.includes(s));
}
