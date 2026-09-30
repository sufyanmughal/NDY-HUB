// A small, explicit allow-list of apps that want the email-verification
// link to deep-link straight back into them instead of opening the NDY
// HUB website. Deliberately NOT a free-form redirect URI the caller
// supplies (that would be an open-redirect / token-leak vector — the
// token is a one-time bearer credential, so where it gets sent is not
// something an unauthenticated /auth/register caller should control).
// Add an entry here only once a real app has a registered, verified
// scheme — same "add scopes as real clients need them" discipline as
// apps/api/src/oauth/scopes.ts.
const VERIFICATION_REDIRECT_SCHEMES: Record<string, string> = {
  ndjoyit: 'ndjoyit://verify-email',
};

export function resolveVerificationLink(
  webAppUrl: string,
  token: string,
  clientId: string | undefined,
): string {
  const scheme = clientId
    ? VERIFICATION_REDIRECT_SCHEMES[clientId]
    : undefined;
  if (scheme) {
    return `${scheme}?token=${token}`;
  }
  return `${webAppUrl}/verify-email?token=${token}`;
}
