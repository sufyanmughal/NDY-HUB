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
