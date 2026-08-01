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
  role: UserRole;
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

// --- Social login (Google / Apple) ---
// This app acting as an OAuth *client* against Google/Apple — distinct
// from the OAuthClient/consent endpoints above, which are the opposite
// direction (NDY HUB as an OIDC *provider* for third-party sites).
// start/callback are real browser navigations the API redirects through,
// not fetch calls — buildOAuthStartUrl just builds the link href, it
// doesn't call the API itself.

export function getOAuthProviders(): Promise<{ google: boolean; apple: boolean }> {
  return apiFetch("/auth/oauth/providers");
}

export function buildOAuthStartUrl(provider: "google" | "apple", next: string): string {
  const params = new URLSearchParams({ next });
  return `${API_BASE_URL}/auth/oauth/${provider}/start?${params.toString()}`;
}

export function exchangeOAuthCode(code: string): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// --- Connected accounts (Settings > linking Google/Apple to an existing,
// already-signed-in account) ---

export interface ConnectedAccount {
  id: string;
  provider: "GOOGLE" | "APPLE";
  email: string | null;
  createdAt: string;
}

export function getConnectedAccounts(accessToken: string): Promise<ConnectedAccount[]> {
  return authedFetch<ConnectedAccount[]>("/auth/connected-accounts", accessToken);
}

export function unlinkConnectedAccount(accessToken: string, id: string): Promise<void> {
  return authedFetch<void>(`/auth/connected-accounts/${id}`, accessToken, { method: "DELETE" });
}

/** Unlike buildOAuthStartUrl, this needs the bearer token to know which
 * account to link to, so it's a real authed fetch (returning the authorize
 * URL as JSON) rather than a plain <a href> — the caller navigates the
 * browser there itself once this resolves. */
export async function beginConnectOAuthProvider(
  accessToken: string,
  provider: "google" | "apple",
): Promise<string> {
  const { url } = await authedFetch<{ url: string }>(
    `/auth/oauth/${provider}/connect?next=${encodeURIComponent("/settings")}`,
    accessToken,
    { method: "POST" },
  );
  return url;
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

// --- Support ---

export type SupportTicketStatus = "OPEN" | "RESOLVED";

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export function getMySupportTickets(accessToken: string): Promise<SupportTicket[]> {
  return authedFetch<SupportTicket[]>("/support/tickets", accessToken);
}

export function createSupportTicket(
  accessToken: string,
  subject: string,
  message: string,
): Promise<SupportTicket> {
  return authedFetch<SupportTicket>("/support/tickets", accessToken, {
    method: "POST",
    body: JSON.stringify({ subject, message }),
  });
}

// --- Admin: support tickets ---

export interface AdminSupportTicket extends SupportTicket {
  userId: string;
  user: { ndyId: string; email: string };
}

export function adminListSupportTickets(accessToken: string): Promise<AdminSupportTicket[]> {
  return authedFetch<AdminSupportTicket[]>("/admin/support-tickets", accessToken);
}

export function adminReplySupportTicket(
  accessToken: string,
  ticketId: string,
  reply: string,
): Promise<AdminSupportTicket> {
  return authedFetch<AdminSupportTicket>(`/admin/support-tickets/${ticketId}/reply`, accessToken, {
    method: "POST",
    body: JSON.stringify({ reply }),
  });
}

// --- Admin (M6) ---
// Every function here hits an endpoint guarded by JwtAuthGuard + AdminGuard
// on the server — a non-admin gets a real 403 from Nest, not just a hidden
// UI element. The frontend has no separate "am I admin" check; it just
// calls these and handles the 403 (see AdminGate).

export type UserRole =
  | "USER"
  | "FOUNDER"
  | "SUPER_ADMIN"
  | "DEVELOPER"
  | "FINANCE"
  | "SUPPORT"
  | "CONTENT"
  | "PARTNERS"
  | "AUDITOR";

/** Only roles a Super Admin (or anyone else with MANAGE_ROLES but not
 * FOUNDER) may assign — mirrors the backend's ASSIGNABLE_BY_SUPER_ADMIN in
 * common/permissions.ts. FOUNDER and SUPER_ADMIN are deliberately excluded:
 * only an existing Founder can hand those out, enforced server-side
 * regardless of what this list says — this is just what the picker offers. */
export const ASSIGNABLE_ROLES: UserRole[] = [
  "USER",
  "DEVELOPER",
  "FINANCE",
  "SUPPORT",
  "CONTENT",
  "PARTNERS",
  "AUDITOR",
];

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

// --- Role changes: dual-approval, not instant. Creating a request doesn't
// change anyone's role — a *different* admin has to approve it first (see
// RoleChangeRequestPanel). Kept alongside the rest of the admin bindings.

export type RoleChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface RoleChangeRequest {
  id: string;
  targetUserId: string;
  targetNdyId: string;
  requestedRole: UserRole;
  previousRole: UserRole;
  requestedByUserId: string;
  requestedByNdyId: string;
  requestReason: string | null;
  status: RoleChangeRequestStatus;
  reviewedByUserId: string | null;
  reviewedByNdyId: string | null;
  reviewReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function createRoleChangeRequest(
  accessToken: string,
  targetUserId: string,
  role: UserRole,
  reason?: string,
): Promise<RoleChangeRequest> {
  return authedFetch("/admin/role-requests", accessToken, {
    method: "POST",
    body: JSON.stringify({ targetUserId, role, reason }),
  });
}

export function listRoleChangeRequests(
  accessToken: string,
  status?: RoleChangeRequestStatus,
): Promise<RoleChangeRequest[]> {
  const query = status ? `?status=${status}` : "";
  return authedFetch(`/admin/role-requests${query}`, accessToken);
}

export function approveRoleChangeRequest(
  accessToken: string,
  requestId: string,
  reason?: string,
): Promise<RoleChangeRequest> {
  return authedFetch(`/admin/role-requests/${requestId}/approve`, accessToken, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function rejectRoleChangeRequest(
  accessToken: string,
  requestId: string,
  reason?: string,
): Promise<RoleChangeRequest> {
  return authedFetch(`/admin/role-requests/${requestId}/reject`, accessToken, {
    method: "POST",
    body: JSON.stringify({ reason }),
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

// --- Admin: OAuth client management (registering NDJOYIT sites as SSO
// relying parties) ---

export interface AdminOAuthClient {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  isActive: boolean;
  createdAt: string;
}

export function getOAuthScopeCatalog(accessToken: string): Promise<{ scopes: Record<string, string>; all: string[] }> {
  return authedFetch("/admin/oauth-clients/scopes", accessToken);
}

export function listAdminOAuthClients(accessToken: string): Promise<AdminOAuthClient[]> {
  return authedFetch("/admin/oauth-clients", accessToken);
}

/** The response includes clientSecret in plaintext — the one and only time
 * it's ever visible. The caller must show it once and never fetch it again. */
export function createAdminOAuthClient(
  accessToken: string,
  params: { name: string; redirectUris: string[]; allowedScopes: string[] },
): Promise<AdminOAuthClient & { clientSecret: string }> {
  return authedFetch("/admin/oauth-clients", accessToken, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function setAdminOAuthClientActive(
  accessToken: string,
  id: string,
  active: boolean,
): Promise<AdminOAuthClient> {
  return authedFetch(`/admin/oauth-clients/${id}/${active ? "activate" : "deactivate"}`, accessToken, {
    method: "PATCH",
  });
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

// --- Founder Mission Control: FOUNDER-role-only, calls /founder/* and
// handles a 403 the same way AdminGate handles admin's (see FounderGate).

export interface FounderEcosystemOverview {
  users: {
    total: number;
    newToday: number;
    newThisMonth: number;
    newVerificationsToday: number;
    activeSessions: number;
  };
  memberships: { newToday: number; active: number };
  revenue: {
    todayCents: number;
    membershipTodayCentsEstimated: number;
    cryndyTodayCents: number;
    note: string;
  };
  cryndy: {
    salesToday: { count: number; amountCents: number };
    salesAllTime: { count: number; amountCents: number };
  };
  ndybits: { issuedToday: number; issuedAllTime: number };
  systemStatus: { database: "ok" | "down" };
  generatedAt: string;
}

export function getFounderEcosystemOverview(accessToken: string): Promise<FounderEcosystemOverview> {
  return authedFetch("/founder/overview", accessToken);
}

export interface FinancialSummary {
  revenue: FounderEcosystemOverview["revenue"];
  cryndy: FounderEcosystemOverview["cryndy"];
  ndybits: FounderEcosystemOverview["ndybits"];
  generatedAt: string;
}

/** FINANCE-role-accessible subset of the founder overview — same data, no
 * user/session/system-health fields a finance user has no reason to see. */
export function getFinancialSummary(accessToken: string): Promise<FinancialSummary> {
  return authedFetch("/founder/financials", accessToken);
}

// --- Ecosystem overview: real, non-sensitive aggregate stats shown on both
// the public landing page and the authenticated dashboard home. Fully
// public endpoint — no token needed, since the landing page needs it
// before anyone has signed in.

export interface EcosystemOverview {
  totalUsers: number;
  newUsersToday: number;
  connectedPlatforms: number;
  transactions24h: number;
  ndybitsIssued: number;
  cryndy: { totalSold: number; dailySeries: number[] };
  bitcoin: { priceUsd: number; change24hPct: number; sparkline7d: number[] } | null;
  systemStatus: "ok" | "down";
  generatedAt: string;
}

export function getEcosystemOverview(): Promise<EcosystemOverview> {
  return apiFetch("/ecosystem/overview");
}
