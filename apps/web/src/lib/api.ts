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

/** Carries the real HTTP status alongside the server's message — callers
 * that need to branch on "was this specifically a 403" (AdminGate) shouldn't
 * have to string-match error messages to do it. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? `Request failed with status ${res.status}`, res.status);
  }
  // A `void`-returning endpoint (logout, disable-2fa, remove-passkey...)
  // sends a 200/201 with an empty body — res.json() throws on that ("Unexpected
  // end of JSON input"), so callers typed Promise<void> need this to resolve
  // cleanly instead of rejecting on their own success path.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
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

// --- Email + password auth ---
// Same two calls back the real password login/register form on /login and
// the "skip NDYAPPS" dev shortcut on the QR card — approving a login
// request for real always requires NDYAPPS's own bearer token (JwtAuthGuard
// on the server enforces that); the dev shortcut just gets one the same way
// NDYAPPS would, without a phone in the loop, for local testing.

export type LoginResult = IssuedSession | { requires2fa: true; challengeToken: string };

export function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function registerWithPassword(
  email: string,
  password: string,
  fullName: string,
): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });
}

export function forgotPassword(email: string): Promise<void> {
  return apiFetch<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return apiFetch<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
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

// --- Security ---

export interface SecuritySession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function getMySessions(accessToken: string): Promise<SecuritySession[]> {
  return authedFetch<SecuritySession[]>("/security/sessions", accessToken);
}

export function revokeSessionById(accessToken: string, sessionId: string): Promise<void> {
  return authedFetch<void>(`/security/sessions/${sessionId}`, accessToken, { method: "DELETE" });
}

export function revokeAllSessions(accessToken: string): Promise<{ revokedCount: number }> {
  return authedFetch<{ revokedCount: number }>("/security/sessions/revoke-all", accessToken, {
    method: "POST",
  });
}

// --- Settings ---

export interface MeProfile {
  ndyId: string;
  email: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  verificationLevel: string;
  ndyappsConnected: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export function getMe(accessToken: string): Promise<MeProfile> {
  return authedFetch<MeProfile>("/auth/me", accessToken);
}

export function updateProfile(
  accessToken: string,
  updates: { fullName?: string; profilePhotoUrl?: string },
): Promise<Pick<MeProfile, "ndyId" | "email" | "fullName" | "profilePhotoUrl">> {
  return authedFetch("/auth/me", accessToken, { method: "PATCH", body: JSON.stringify(updates) });
}

/** Multipart upload, not JSON — can't use authedFetch (it always sets
 * Content-Type: application/json). Letting fetch set the multipart
 * boundary itself means never setting Content-Type explicitly here. */
export async function uploadProfilePhoto(
  accessToken: string,
  file: File,
): Promise<{ profilePhotoUrl: string }> {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await fetch(`${API_BASE_URL}/auth/me/photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? `Upload failed with status ${res.status}`, res.status);
  }
  return res.json();
}

export function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return authedFetch<void>("/auth/change-password", accessToken, {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// --- Two-factor authentication (TOTP) ---

export function verify2fa(challengeToken: string, code: string): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function begin2faSetup(accessToken: string): Promise<{ secret: string; otpauthUri: string }> {
  return authedFetch("/auth/2fa/setup", accessToken, { method: "POST" });
}

export function confirm2faSetup(accessToken: string, code: string): Promise<{ backupCodes: string[] }> {
  return authedFetch("/auth/2fa/enable", accessToken, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function disable2fa(accessToken: string, currentPassword: string, code: string): Promise<void> {
  return authedFetch<void>("/auth/2fa/disable", accessToken, {
    method: "POST",
    body: JSON.stringify({ currentPassword, code }),
  });
}

// --- Passkeys (WebAuthn) ---
// Two round trips each, mirroring @simplewebauthn/server's own two-step
// shape: an "options" call that also stashes a server-side challenge (
// returned here as challengeId, since the actual challenge value never
// needs to leave the server), then a "verify" call carrying whatever
// navigator.credentials produced plus that challengeId. The passkey.ts
// helper functions below wrap the @simplewebauthn/browser calls in
// between so callers don't touch the WebAuthn types directly.

export interface PasskeySummary {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function getMyPasskeys(accessToken: string): Promise<PasskeySummary[]> {
  return authedFetch<PasskeySummary[]>("/auth/passkeys", accessToken);
}

export function removeMyPasskey(accessToken: string, id: string): Promise<void> {
  return authedFetch<void>(`/auth/passkeys/${id}`, accessToken, { method: "DELETE" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- WebAuthn options/response JSON, typed precisely in passkey.ts
export function beginPasskeyRegistration(accessToken: string): Promise<{ options: any; challengeId: string }> {
  return authedFetch("/auth/passkeys/register/options", accessToken, { method: "POST" });
}

export function verifyPasskeyRegistration(
  accessToken: string,
  challengeId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
  deviceLabel?: string,
): Promise<PasskeySummary> {
  return authedFetch("/auth/passkeys/register/verify", accessToken, {
    method: "POST",
    body: JSON.stringify({ challengeId, response, deviceLabel }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function beginPasskeyLogin(): Promise<{ options: any; challengeId: string }> {
  return apiFetch("/auth/passkeys/login/options", { method: "POST" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyPasskeyLogin(challengeId: string, response: any): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/passkeys/login/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, response }),
  });
}

// --- Email verification ---

export function confirmEmailVerification(token: string): Promise<{ verificationLevel: string }> {
  return apiFetch<{ verificationLevel: string }>("/auth/verify-email/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendEmailVerification(accessToken: string): Promise<void> {
  return authedFetch<void>("/auth/verify-email/resend", accessToken, { method: "POST" });
}

// --- GDPR: data export + account deletion ---

/** Fetches the export as an authenticated request (same reasoning as
 * downloadDocument — a plain <a href> can't send a bearer token), then
 * hands the browser a blob: URL so it saves like a normal download. */
export async function downloadDataExport(accessToken: string, ndyId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/gdpr/export`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ndyhub-data-export-${ndyId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function deleteAccount(accessToken: string, currentPassword: string): Promise<void> {
  return authedFetch<void>("/gdpr/delete-account", accessToken, {
    method: "POST",
    body: JSON.stringify({ currentPassword, confirm: "DELETE" }),
  });
}

// --- Transactions ---

export interface Transaction {
  id: string;
  type: "membership" | "cryndy";
  label: string;
  detail: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
}

export function getMyTransactions(accessToken: string): Promise<Transaction[]> {
  return authedFetch<Transaction[]>("/transactions/me", accessToken);
}

// --- Documents ---

export interface DocumentStub {
  id: string;
  type: "MEMBERSHIP_CONFIRMATION" | "CRYNDY_CERTIFICATE";
  title: string;
  date: string;
}

export function getMyDocuments(accessToken: string): Promise<DocumentStub[]> {
  return authedFetch<DocumentStub[]>("/documents/me", accessToken);
}

/** A plain <a href> can't send an Authorization header, and the guard
 * shouldn't be weakened to accept tokens via query string just for this —
 * so fetch it as an authenticated request, then hand the browser a
 * blob: URL to actually save. Once real object storage exists, this
 * becomes a signed short-lived S3 URL instead and this function goes away. */
export async function downloadDocument(accessToken: string, documentId: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Admin (M6) ---
// Every function here hits an endpoint guarded by JwtAuthGuard + AdminGuard
// on the server — a non-admin gets a real 403 from Nest, not just a hidden
// UI element. The frontend has no separate "am I admin" check; it just
// calls these and handles the 403 (see AdminGate).

export type UserRole = "USER" | "ADMIN";

export interface AdminUserSummary {
  id: string;
  ndyId: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  suspended: boolean;
  verificationLevel: string;
  ndyappsConnected: boolean;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  membership: { tierLabel: string; status: string } | null;
  cryndyAvailableBalance: number;
  cryndyPurchaseCount: number;
  ndybitsBalance: number;
  activeSessionCount: number;
}

export function searchAdminUsers(
  accessToken: string,
  q?: string,
): Promise<{ users: AdminUserSummary[]; total: number }> {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return authedFetch(`/admin/users${query}`, accessToken);
}

export function getAdminUserDetail(accessToken: string, userId: string): Promise<AdminUserDetail> {
  return authedFetch(`/admin/users/${userId}`, accessToken);
}

export function adminUpdateRole(
  accessToken: string,
  userId: string,
  role: UserRole,
  reason?: string,
): Promise<{ id: string; ndyId: string; role: UserRole }> {
  return authedFetch(`/admin/users/${userId}/role`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ role, reason }),
  });
}

export function adminSetSuspended(
  accessToken: string,
  userId: string,
  suspended: boolean,
  reason?: string,
): Promise<{ id: string; ndyId: string; suspended: boolean }> {
  return authedFetch(`/admin/users/${userId}/${suspended ? "suspend" : "unsuspend"}`, accessToken, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export interface AuditLogEntry {
  id: string;
  adminNdyId: string;
  action: string;
  targetNdyId: string | null;
  previousValue: unknown;
  newValue: unknown;
  reason: string | null;
  createdAt: string;
}

export function getAdminAuditLog(accessToken: string): Promise<{ entries: AuditLogEntry[]; total: number }> {
  return authedFetch("/admin/audit-log?take=25", accessToken);
}

// --- OAuth / OIDC consent (SSO for third-party NDJOYIT sites) ---

export interface OAuthClientPublicInfo {
  clientId: string;
  name: string;
  allowedScopes: string[];
}

export interface OAuthScopeDescription {
  scope: string;
  description: string;
}

export interface OAuthAuthorizeStatus {
  client: OAuthClientPublicInfo;
  scopeDescriptions: OAuthScopeDescription[];
  alreadyGranted: boolean;
}

export function getOAuthAuthorizeStatus(
  accessToken: string,
  clientId: string,
  scope: string,
): Promise<OAuthAuthorizeStatus> {
  const params = new URLSearchParams({ client_id: clientId, scope });
  return authedFetch<OAuthAuthorizeStatus>(`/oauth/authorize/status?${params.toString()}`, accessToken);
}

export interface OAuthConsentResult {
  redirectUrl: string;
}

export function submitOAuthConsent(
  accessToken: string,
  params: {
    clientId: string;
    redirectUri: string;
    scope: string;
    state?: string;
    approve: boolean;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  },
): Promise<OAuthConsentResult> {
  return authedFetch<OAuthConsentResult>("/oauth/authorize/consent", accessToken, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface ConnectedSite {
  id: string;
  clientName: string;
  clientId: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

export function getConnectedSites(accessToken: string): Promise<ConnectedSite[]> {
  return authedFetch<ConnectedSite[]>("/oauth/grants", accessToken);
}

export function revokeConnectedSite(accessToken: string, grantId: string): Promise<void> {
  return authedFetch<void>(`/oauth/grants/${grantId}`, accessToken, { method: "DELETE" });
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
