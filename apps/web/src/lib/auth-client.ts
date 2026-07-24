const STORAGE_KEY = "ndyhub.session";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  ndyId: string;
  exp: number;
}

// Dev-only storage: real session tokens have no business sitting in
// localStorage long-term (a stray XSS bug turns into a stolen session
// instead of a stolen cookie a script can't read). This is a placeholder
// for the httpOnly-cookie session the proposal's security section commits
// to — swap it out before this goes anywhere near production traffic.
export function storeSession(session: StoredSession): void {
  const toStore: StoredSession = { accessToken: session.accessToken, refreshToken: session.refreshToken };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Decodes the access token payload for display purposes only — this is
 * NOT verification. The server is the only party that trusts this token;
 * the client just reads its own claims back to know who's logged in. */
export function decodeAccessToken(accessToken: string): AccessTokenPayload | null {
  try {
    const [, payload] = accessToken.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function isExpired(payload: AccessTokenPayload): boolean {
  return payload.exp * 1000 < Date.now();
}
