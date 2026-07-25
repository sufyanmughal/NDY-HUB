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

/** Same as apiFetch, but for the guarded endpoints — every real dashboard
 * fetch (memberships, and soon CRYNDY/NDYBITS) needs the caller's session
 * attached, not just a JSON body. */
function authedFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers },
  });
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

export function refreshSession(refreshToken: string): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export function logoutSession(refreshToken: string): Promise<void> {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export interface PublicPassport {
  ndyId: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  verificationLevel: string;
  ndyappsConnected: boolean;
  memberSince: string;
}

export function getPublicPassport(ndyId: string): Promise<PublicPassport> {
  return apiFetch<PublicPassport>(`/passport/${ndyId}`);
}

// --- Dev-only helpers, used by the "skip NDYAPPS" shortcut on /login ---
// Real approval always requires NDYAPPS's own bearer token (JwtAuthGuard on
// the server enforces that); these just get one the same way NDYAPPS would,
// without a phone in the loop, for local testing before NDYAPPS exists.

export function devLogin(email: string, password: string): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function devRegister(email: string, password: string, fullName: string): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });
}

export async function approveLoginRequestAs(token: string, accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/login-request/${token}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Approve failed with status ${res.status}`);
  }
}

// --- Membership (M4) ---

export type MembershipTier = "RISE" | "FLOW" | "PULSE" | "VAULT" | "MODE" | "LEGACY";
export type BillingCycle = "MONTHLY" | "ANNUAL";
export type MembershipStatus = "ACTIVE" | "CANCELLED" | "EXPIRED";

export interface TierInfo {
  label: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  benefits: string[];
}

export interface Membership {
  id: string;
  tier: MembershipTier;
  tierLabel: string;
  billingCycle: BillingCycle;
  status: MembershipStatus;
  startedAt: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
}

export interface MembershipSummary {
  current: Membership | null;
  history: Membership[];
}

export type SubscribeResult =
  | { mode: "checkout"; checkoutUrl: string }
  | { mode: "dev-activated"; membershipId: string };

export function getMembershipTiers(): Promise<Record<MembershipTier, TierInfo>> {
  return apiFetch<Record<MembershipTier, TierInfo>>("/memberships/tiers");
}

export function getMyMembership(accessToken: string): Promise<MembershipSummary> {
  return authedFetch<MembershipSummary>("/memberships/me", accessToken);
}

export function subscribeToTier(
  accessToken: string,
  tier: MembershipTier,
  billingCycle: BillingCycle,
): Promise<SubscribeResult> {
  return authedFetch<SubscribeResult>("/memberships/subscribe", accessToken, {
    method: "POST",
    body: JSON.stringify({ tier, billingCycle }),
  });
}

export function cancelMembership(accessToken: string, membershipId: string): Promise<void> {
  return authedFetch<void>(`/memberships/${membershipId}/cancel`, accessToken, { method: "POST" });
}

// --- CRYNDY (M5) ---

export type CryndyPurchaseStatus =
  | "PAYMENT_PENDING"
  | "PAYMENT_CONFIRMED"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "ALLOCATED"
  | "LOCKED"
  | "AVAILABLE"
  | "DISTRIBUTED_ON_CHAIN"
  | "CANCELLED"
  | "REFUNDED";

export interface CryndyPurchase {
  id: string;
  reference: string;
  amountPaid: number;
  currency: string;
  cryndyAmount: number;
  bonusAmount: number;
  packageName: string | null;
  paymentMethod: string;
  status: CryndyPurchaseStatus;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  allocatedAt: string | null;
}

export interface CryndySummary {
  availableBalance: number;
  breakdown: Record<CryndyPurchaseStatus, { count: number; cryndyAmount: number }>;
  purchases: CryndyPurchase[];
}

export function getMyCryndy(accessToken: string): Promise<CryndySummary> {
  return authedFetch<CryndySummary>("/cryndy/me", accessToken);
}

// --- NDYBITS (M5) ---

export interface NdybitsLedgerEntry {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface NdybitsSummary {
  balance: number;
  recentEntries: NdybitsLedgerEntry[];
}

export function getMyNdybits(accessToken: string): Promise<NdybitsSummary> {
  return authedFetch<NdybitsSummary>("/ndybits/me", accessToken);
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
