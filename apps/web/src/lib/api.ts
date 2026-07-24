export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type LoginRequestStatus = "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";

export interface LoginRequest {
  token: string;
  method: "QR" | "DEEP_LINK";
  status: LoginRequestStatus;
  expiresAt: string;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createLoginRequest(): Promise<LoginRequest> {
  return apiFetch<LoginRequest>("/auth/login-request", {
    method: "POST",
    body: JSON.stringify({
      method: "QR",
      browser: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    }),
  });
}

export function getLoginRequestStatus(token: string): Promise<LoginRequest> {
  return apiFetch<LoginRequest>(`/auth/login-request/${token}`);
}

export function exchangeLoginRequest(token: string): Promise<IssuedSession> {
  return apiFetch<IssuedSession>(`/auth/login-request/${token}/exchange`, {
    method: "POST",
  });
}

/**
 * What the QR code actually encodes — a deep link NDYAPPS registers itself
 * to open. The web-only fallback query param lets a browser that scans this
 * by accident land somewhere sane instead of a dead `ndyapps://` link.
 */
export function buildLoginDeepLink(token: string): string {
  const webFallback = encodeURIComponent(`${API_BASE_URL}/auth/login-request/${token}`);
  return `ndyapps://login?token=${token}&fallback=${webFallback}`;
}
