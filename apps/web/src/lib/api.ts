// The real API origin — used only for links that must be absolute and
// externally reachable regardless of which origin the browser is on right
// now: the QR/deep-link fallback URL (opened by whatever device scans it),
// the WebSocket connection (no cookie involved, token-based instead), the
// OAuth provider start redirect, and the public passport share link.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Every actual fetch() in this file goes through this same-origin path
// instead, which apps/web/next.config.ts rewrites/proxies to API_BASE_URL
// server-side. The browser only ever talks to its own origin, which is
// what lets the API's httpOnly session cookies be SameSite=Lax instead of
// SameSite=None — the frontend and API sit on different vercel.app
// subdomains, which browsers treat as genuinely different *sites*, and
// SameSite=None cookies are exactly what Safari/Firefox's cross-site
// tracking protections are increasingly aggressive about dropping.
const PROXIED_API_PATH = "/api";

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
  const res = await fetch(`${PROXIED_API_PATH}${path}`, {
    ...init,
    // Sends the httpOnly session cookies on every call, same-origin or
    // not — without this, fetch() drops cookies by default and every
    // authenticated request would silently look logged-out.
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.message ?? `Request failed with status ${res.status}`,
      res.status,
    );
  }
  // A `void`-returning endpoint (logout, disable-2fa, remove-passkey...)
  // sends a 200/201 with an empty body — res.json() throws on that ("Unexpected
  // end of JSON input"), so callers typed Promise<void> need this to resolve
  // cleanly instead of rejecting on their own success path.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// De-duplicates concurrent refresh attempts: a page that fires several
// authedFetch calls in parallel right as the 15-minute access token goes
// stale would otherwise each independently race to refresh, and since
// refreshing rotates (and revokes) the refresh token, only the first of
// several concurrent attempts can actually succeed — the rest would fail
// having read the now-already-revoked cookie value. Sharing one in-flight
// promise means every caller waits on and benefits from the same refresh.
let refreshInFlight: Promise<void> | null = null;

function refreshOnce(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession()
      .then(() => undefined)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Same as apiFetch, plus one reactive refresh-and-retry on a 401 — the
 * access token cookie is httpOnly, so unlike the old localStorage design,
 * the client can't check its own expiry and refresh proactively before it
 * goes stale. This is what makes an expired-but-refreshable session
 * recover transparently mid-visit instead of forcing a re-login every 15
 * minutes. */
async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await refreshOnce();
      return apiFetch<T>(path, init);
    }
    throw err;
  }
}

export function createLoginRequest(): Promise<LoginRequest> {
  return apiFetch<LoginRequest>("/auth/login-request", {
    method: "POST",
    body: JSON.stringify({
      method: "QR",
      browser:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
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

function refreshSession(): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/refresh", { method: "POST" });
}

export function logoutSession(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export interface PublicPassportSocials {
  linkedin: string | null;
  instagram: string | null;
  x: string | null;
}

export interface PublicPassportBusiness {
  name: string | null;
  role: string | null;
}

export interface PublicPassport {
  ndyId: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  verificationLevel: string;
  // Founder/Super Admin accounts read as verified regardless of their own
  // (self-serve) verificationLevel — computed server-side by
  // isPassportVerified so this never has to duplicate that role logic
  // (or the role itself, which isn't exposed publicly) here.
  isVerified: boolean;
  ndyappsConnected: boolean;
  memberSince: string;
  // Each null either because the owner never set it, or chose to keep it
  // private (getPublicPassport on the API applies the *IsPublic flags
  // before this ever reaches the client — there's no way to tell the two
  // cases apart from here, by design).
  bio: string | null;
  country: string | null;
  website: string | null;
  phone: string | null;
  socials: PublicPassportSocials | null;
  business: PublicPassportBusiness | null;
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

export type TwoFactorMethod = "TOTP" | "SMS";

export type LoginResult =
  | IssuedSession
  | { requires2fa: true; challengeToken: string; methods: TwoFactorMethod[] }
  | { requiresEmailVerification: true; email: string };

export function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginResult> {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Same passport fields as UpdateProfileInput (see below) — registration
// collects them up front now instead of deferring to a later step, so the
// two shapes need to stay in sync. profilePhotoUrl is excluded: there's no
// file to upload yet at the point the registration form submits.
export type RegisterPassportFields = Omit<UpdateProfileInput, "fullName" | "profilePhotoUrl">;

// No session is issued at registration anymore — the account only
// becomes usable once its email is confirmed, so this always resolves to
// the "go check your inbox" shape rather than real tokens.
// expiresInSeconds drives the countdown on the "check your email" screen.
export type RegisterResult = {
  requiresEmailVerification: true;
  email: string;
  expiresInSeconds: number;
};

export function registerWithPassword(
  email: string,
  password: string,
  fullName: string,
  passportFields?: RegisterPassportFields,
): Promise<RegisterResult> {
  return apiFetch<RegisterResult>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName, ...passportFields }),
  });
}

export function forgotPassword(
  email: string,
): Promise<{ expiresInSeconds: number }> {
  return apiFetch<{ expiresInSeconds: number }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resendPasswordResetCode(
  email: string,
): Promise<{ expiresInSeconds: number }> {
  return apiFetch<{ expiresInSeconds: number }>("/auth/reset-password/resend", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// Typed-in 6-digit code, not a link token — see ResetPasswordDto server-side.
export function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  return apiFetch<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, code, newPassword }),
  });
}

// Deliberately bearer-based, not cookie-based: this simulates NDYAPPS
// approving on behalf of whichever test account just logged in via the
// dev shortcut, which has nothing to do with — and shouldn't touch — the
// current browser's own (probably logged-out) session cookie.
export async function approveLoginRequestAs(
  token: string,
  bearerToken: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/auth/login-request/${token}/approve`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Approve failed with status ${res.status}`);
  }
}

// --- Membership (M4) ---

export type MembershipTier =
  "RISE" | "FLOW" | "PULSE" | "VAULT" | "MODE" | "LEGACY";
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

export function getMembershipTiers(): Promise<
  Record<MembershipTier, TierInfo>
> {
  return apiFetch<Record<MembershipTier, TierInfo>>("/memberships/tiers");
}

export function getMyMembership(): Promise<MembershipSummary> {
  return authedFetch<MembershipSummary>("/memberships/me");
}

export function subscribeToTier(
  tier: MembershipTier,
  billingCycle: BillingCycle,
): Promise<SubscribeResult> {
  return authedFetch<SubscribeResult>("/memberships/subscribe", {
    method: "POST",
    body: JSON.stringify({ tier, billingCycle }),
  });
}

export function cancelMembership(membershipId: string): Promise<void> {
  return authedFetch<void>(`/memberships/${membershipId}/cancel`, {
    method: "POST",
  });
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
  breakdown: Record<
    CryndyPurchaseStatus,
    { count: number; cryndyAmount: number }
  >;
  purchases: CryndyPurchase[];
}

export function getMyCryndy(): Promise<CryndySummary> {
  return authedFetch<CryndySummary>("/cryndy/me");
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

export function getMyNdybits(): Promise<NdybitsSummary> {
  return authedFetch<NdybitsSummary>("/ndybits/me");
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

export function getMySessions(): Promise<SecuritySession[]> {
  return authedFetch<SecuritySession[]>("/security/sessions");
}

export function revokeSessionById(sessionId: string): Promise<void> {
  return authedFetch<void>(`/security/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function revokeAllSessions(): Promise<{ revokedCount: number }> {
  return authedFetch<{ revokedCount: number }>(
    "/security/sessions/revoke-all",
    {
      method: "POST",
    },
  );
}

export type SecurityEventType =
  | "LOGIN_SUCCESS"
  | "NEW_DEVICE"
  | "PASSWORD_CHANGED"
  | "PASSKEY_ADDED"
  | "PASSKEY_REMOVED"
  | "TOTP_ENABLED"
  | "TOTP_DISABLED"
  | "SMS_2FA_ENABLED"
  | "SMS_2FA_DISABLED"
  | "RECOVERY_CODE_USED"
  | "EMAIL_CHANGED"
  | "OAUTH_APP_CONNECTED"
  | "OAUTH_APP_REVOKED";

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export function getMySecurityEvents(): Promise<SecurityEvent[]> {
  return authedFetch<SecurityEvent[]>("/security/events");
}

// --- Settings ---

export interface MeProfile {
  id: string;
  ndyId: string;
  email: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  verificationLevel: string;
  ndyappsConnected: boolean;
  twoFactorEnabled: boolean;
  smsTwoFactorEnabled: boolean;
  smsPhoneMasked: string | null;
  role: UserRole;
  createdAt: string;
  bio: string | null;
  country: string | null;
  website: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  businessName: string | null;
  businessRole: string | null;
  phone: string | null;
  bioIsPublic: boolean;
  countryIsPublic: boolean;
  websiteIsPublic: boolean;
  socialsIsPublic: boolean;
  businessIsPublic: boolean;
  phoneIsPublic: boolean;
  // Only fullName gates the dashboard — see DashboardGate. Every other
  // Passport Card field is optional and editable any time from Settings.
  passportComplete: boolean;
  // Founder/Super Admin accounts read as verified regardless of their own
  // verificationLevel — see PublicPassport.isVerified's doc comment.
  isVerified: boolean;
}

export function getMe(): Promise<MeProfile> {
  return authedFetch<MeProfile>("/auth/me");
}

export interface UpdateProfileInput {
  fullName?: string;
  profilePhotoUrl?: string;
  bio?: string;
  country?: string;
  website?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  businessName?: string;
  businessRole?: string;
  phone?: string;
  bioIsPublic?: boolean;
  countryIsPublic?: boolean;
  websiteIsPublic?: boolean;
  socialsIsPublic?: boolean;
  businessIsPublic?: boolean;
  phoneIsPublic?: boolean;
}

export function updateProfile(
  updates: UpdateProfileInput,
): Promise<Omit<MeProfile, "id" | "verificationLevel" | "ndyappsConnected" | "twoFactorEnabled" | "role" | "createdAt">> {
  return authedFetch("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

/** Multipart upload, not JSON — can't use authedFetch (it always sets
 * Content-Type: application/json). Letting fetch set the multipart
 * boundary itself means never setting Content-Type explicitly here. */
export async function uploadProfilePhoto(
  file: File,
): Promise<{ profilePhotoUrl: string }> {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await fetch(`${PROXIED_API_PATH}/auth/me/photo`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.message ?? `Upload failed with status ${res.status}`,
      res.status,
    );
  }
  return res.json();
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return authedFetch<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// --- Two-factor authentication (TOTP) ---

export function verify2fa(
  challengeToken: string,
  code: string,
): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function begin2faSetup(): Promise<{
  secret: string;
  otpauthUri: string;
}> {
  return authedFetch("/auth/2fa/setup", { method: "POST" });
}

export function confirm2faSetup(
  code: string,
): Promise<{ backupCodes: string[] }> {
  return authedFetch("/auth/2fa/enable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function disable2fa(
  currentPassword: string,
  code: string,
): Promise<void> {
  return authedFetch<void>("/auth/2fa/disable", {
    method: "POST",
    body: JSON.stringify({ currentPassword, code }),
  });
}

// --- Two-factor authentication (SMS) ---
// A second, independent 2FA method alongside TOTP above — a user can
// enable either, both, or neither. Unlike TOTP there's no local secret:
// Sinch owns the OTP itself, so setup is just "send a code, confirm it."

export function beginSmsSetup(phoneE164: string): Promise<void> {
  return authedFetch<void>("/auth/sms-2fa/setup", {
    method: "POST",
    body: JSON.stringify({ phoneE164 }),
  });
}

export function confirmSmsSetup(
  phoneE164: string,
  code: string,
): Promise<void> {
  return authedFetch<void>("/auth/sms-2fa/enable", {
    method: "POST",
    body: JSON.stringify({ phoneE164, code }),
  });
}

export function disableSms2fa(currentPassword: string): Promise<void> {
  return authedFetch<void>("/auth/sms-2fa/disable", {
    method: "POST",
    body: JSON.stringify({ currentPassword }),
  });
}

// Login-time "text me a code" — called once the user picks SMS on the
// method picker (when both TOTP and SMS are enabled), or automatically
// by the challenge form when SMS is the account's only method.
export function sendSmsChallenge(challengeToken: string): Promise<void> {
  return apiFetch<void>("/auth/2fa/send-sms", {
    method: "POST",
    body: JSON.stringify({ challengeToken }),
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

export function getMyPasskeys(): Promise<PasskeySummary[]> {
  return authedFetch<PasskeySummary[]>("/auth/passkeys");
}

export function removeMyPasskey(id: string): Promise<void> {
  return authedFetch<void>(`/auth/passkeys/${id}`, { method: "DELETE" });
}

// WebAuthn options/response JSON, typed precisely in passkey.ts
export function beginPasskeyRegistration(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any;
  challengeId: string;
}> {
  return authedFetch("/auth/passkeys/register/options", { method: "POST" });
}

export function verifyPasskeyRegistration(
  challengeId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
  deviceLabel?: string,
): Promise<PasskeySummary> {
  return authedFetch("/auth/passkeys/register/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, response, deviceLabel }),
  });
}

export function beginPasskeyLogin(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any;
  challengeId: string;
}> {
  return apiFetch("/auth/passkeys/login/options", { method: "POST" });
}

export function verifyPasskeyLogin(
  challengeId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
): Promise<IssuedSession> {
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

export function getOAuthProviders(): Promise<{
  google: boolean;
  apple: boolean;
}> {
  return apiFetch("/auth/oauth/providers");
}

export function buildOAuthStartUrl(
  provider: "google" | "apple",
  next: string,
): string {
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

export function getConnectedAccounts(): Promise<ConnectedAccount[]> {
  return authedFetch<ConnectedAccount[]>("/auth/connected-accounts");
}

export function unlinkConnectedAccount(id: string): Promise<void> {
  return authedFetch<void>(`/auth/connected-accounts/${id}`, {
    method: "DELETE",
  });
}

/** Unlike buildOAuthStartUrl, this needs the caller's own session to know
 * which account to link to, so it's a real authed fetch (returning the
 * authorize URL as JSON) rather than a plain <a href> — the caller
 * navigates the browser there itself once this resolves. */
export async function beginConnectOAuthProvider(
  provider: "google" | "apple",
): Promise<string> {
  const { url } = await authedFetch<{ url: string }>(
    `/auth/oauth/${provider}/connect?next=${encodeURIComponent("/settings")}`,
    { method: "POST" },
  );
  return url;
}

// --- Email verification ---

// Confirming now issues the account's first real session (register() no
// longer does), so this returns real tokens — the cookie gets set as a
// side effect server-side, same as login/register.
export function confirmEmailVerification(
  token: string,
): Promise<IssuedSession> {
  return apiFetch<IssuedSession>("/auth/verify-email/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendEmailVerification(): Promise<void> {
  return authedFetch<void>("/auth/verify-email/resend", { method: "POST" });
}

// Pre-login counterpart: a freshly registered or not-yet-verified account
// has no session to authenticate resendEmailVerification's request with.
export function resendEmailVerificationByEmail(
  email: string,
): Promise<{ expiresInSeconds: number }> {
  return apiFetch<{ expiresInSeconds: number }>(
    "/auth/verify-email/resend-by-email",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

// --- GDPR: data export + account deletion ---

/** Fetches the export as an authenticated request, then hands the browser
 * a blob: URL so it saves like a normal download with the right filename
 * (a plain <a href> pointed at the API can't set Content-Disposition). */
export async function downloadDataExport(ndyId: string): Promise<void> {
  const res = await fetch(`${PROXIED_API_PATH}/gdpr/export`, {
    credentials: "include",
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

export function deleteAccount(currentPassword: string): Promise<void> {
  return authedFetch<void>("/gdpr/delete-account", {
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

export function getMyTransactions(): Promise<Transaction[]> {
  return authedFetch<Transaction[]>("/transactions/me");
}

// --- Documents ---

export interface DocumentStub {
  id: string;
  type: "MEMBERSHIP_CONFIRMATION" | "CRYNDY_CERTIFICATE";
  title: string;
  date: string;
}

export function getMyDocuments(): Promise<DocumentStub[]> {
  return authedFetch<DocumentStub[]>("/documents/me");
}

/** A plain <a href> can't send an Authorization header, and the guard
 * shouldn't be weakened to accept tokens via query string just for this —
 * so fetch it as an authenticated request, then hand the browser a
 * blob: URL to actually save. Once real object storage exists, this
 * becomes a signed short-lived S3 URL instead and this function goes away. */
export async function downloadDocument(
  documentId: string,
  filename: string,
): Promise<void> {
  const res = await fetch(
    `${PROXIED_API_PATH}/documents/${documentId}/download`,
    {
      credentials: "include",
    },
  );
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

export function getMySupportTickets(): Promise<SupportTicket[]> {
  return authedFetch<SupportTicket[]>("/support/tickets");
}

export function createSupportTicket(
  subject: string,
  message: string,
): Promise<SupportTicket> {
  return authedFetch<SupportTicket>("/support/tickets", {
    method: "POST",
    body: JSON.stringify({ subject, message }),
  });
}

// --- Admin: support tickets ---

export interface AdminSupportTicket extends SupportTicket {
  userId: string;
  user: { ndyId: string; email: string };
}

export function adminListSupportTickets(): Promise<AdminSupportTicket[]> {
  return authedFetch<AdminSupportTicket[]>("/admin/support-tickets");
}

export function adminReplySupportTicket(
  ticketId: string,
  reply: string,
): Promise<AdminSupportTicket> {
  return authedFetch<AdminSupportTicket>(
    `/admin/support-tickets/${ticketId}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ reply }),
    },
  );
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

export interface AdminUserDetail {
  id: string;
  ndyId: string;
  email: string;
  fullName: string | null;
  profilePhotoUrl: string | null;
  role: UserRole;

  suspended: boolean;
  suspendedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;

  verificationLevel: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  identityVerifiedAt: string | null;

  twoFactorEnabled: boolean;
  passkeyCount: number;
  activeSessionCount: number;

  ndyappsConnected: boolean;
  ndyappsConnectedAt: string | null;
  connectedProviders: { provider: "GOOGLE" | "APPLE"; email: string | null; linkedAt: string }[];

  membership: { tierLabel: string; status: string } | null;
  cryndyAvailableBalance: number;
  cryndyPurchaseCount: number;
  ndybitsBalance: number;
}

export function searchAdminUsers(
  q?: string,
): Promise<{ users: AdminUserSummary[]; total: number }> {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return authedFetch(`/admin/users${query}`);
}

export function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  return authedFetch(`/admin/users/${userId}`);
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
  targetUserId: string,
  role: UserRole,
  reason?: string,
): Promise<RoleChangeRequest> {
  return authedFetch("/admin/role-requests", {
    method: "POST",
    body: JSON.stringify({ targetUserId, role, reason }),
  });
}

export function listRoleChangeRequests(
  status?: RoleChangeRequestStatus,
): Promise<RoleChangeRequest[]> {
  const query = status ? `?status=${status}` : "";
  return authedFetch(`/admin/role-requests${query}`);
}

export function approveRoleChangeRequest(
  requestId: string,
  reason?: string,
): Promise<RoleChangeRequest> {
  return authedFetch(`/admin/role-requests/${requestId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function rejectRoleChangeRequest(
  requestId: string,
  reason?: string,
): Promise<RoleChangeRequest> {
  return authedFetch(`/admin/role-requests/${requestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function adminSetSuspended(
  userId: string,
  suspended: boolean,
  reason?: string,
): Promise<{ id: string; ndyId: string; suspended: boolean }> {
  return authedFetch(
    `/admin/users/${userId}/${suspended ? "suspend" : "unsuspend"}`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
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

export function getAdminAuditLog(): Promise<{
  entries: AuditLogEntry[];
  total: number;
}> {
  return authedFetch("/admin/audit-log?take=25");
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

export function getOAuthScopeCatalog(): Promise<{
  scopes: Record<string, string>;
  all: string[];
}> {
  return authedFetch("/admin/oauth-clients/scopes");
}

export function listAdminOAuthClients(): Promise<AdminOAuthClient[]> {
  return authedFetch("/admin/oauth-clients");
}

/** The response includes clientSecret in plaintext — the one and only time
 * it's ever visible. The caller must show it once and never fetch it again. */
export function createAdminOAuthClient(params: {
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
}): Promise<AdminOAuthClient & { clientSecret: string }> {
  return authedFetch("/admin/oauth-clients", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function setAdminOAuthClientActive(
  id: string,
  active: boolean,
): Promise<AdminOAuthClient> {
  return authedFetch(
    `/admin/oauth-clients/${id}/${active ? "activate" : "deactivate"}`,
    {
      method: "PATCH",
    },
  );
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
  clientId: string,
  scope: string,
): Promise<OAuthAuthorizeStatus> {
  const params = new URLSearchParams({ client_id: clientId, scope });
  return authedFetch<OAuthAuthorizeStatus>(
    `/oauth/authorize/status?${params.toString()}`,
  );
}

export interface OAuthConsentResult {
  redirectUrl: string;
}

export function submitOAuthConsent(params: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  approve: boolean;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}): Promise<OAuthConsentResult> {
  return authedFetch<OAuthConsentResult>("/oauth/authorize/consent", {
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

export function getConnectedSites(): Promise<ConnectedSite[]> {
  return authedFetch<ConnectedSite[]>("/oauth/grants");
}

export function revokeConnectedSite(grantId: string): Promise<void> {
  return authedFetch<void>(`/oauth/grants/${grantId}`, { method: "DELETE" });
}

/**
 * What the QR code actually encodes — a deep link NDYAPPS registers itself
 * to open. The web-only fallback query param lets a browser that scans this
 * by accident land somewhere sane instead of a dead `ndyapps://` link.
 */
export function buildLoginDeepLink(token: string): string {
  const webFallback = encodeURIComponent(
    `${API_BASE_URL}/auth/login-request/${token}`,
  );
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

export function getFounderEcosystemOverview(): Promise<FounderEcosystemOverview> {
  return authedFetch("/founder/overview");
}

export interface FinancialSummary {
  revenue: FounderEcosystemOverview["revenue"];
  cryndy: FounderEcosystemOverview["cryndy"];
  ndybits: FounderEcosystemOverview["ndybits"];
  generatedAt: string;
}

/** FINANCE-role-accessible subset of the founder overview — same data, no
 * user/session/system-health fields a finance user has no reason to see. */
export function getFinancialSummary(): Promise<FinancialSummary> {
  return authedFetch("/founder/financials");
}

// --- Ecosystem overview: real, non-sensitive aggregate stats shown on both
// the public landing page and the authenticated dashboard home. Fully
// public endpoint — no token needed, since the landing page needs it
// before anyone has signed in.

export interface EcosystemOverview {
  totalMembers: number;
  connectedPlatforms: number;
  systemUptimePct: number;
  countries: number;
  transactions24h: number;
  cryndy: { totalSold: number; dailySeries: number[] };
  bitcoin: {
    priceUsd: number;
    change24hPct: number;
    sparkline7d: number[];
  } | null;
  systemStatus: "ok" | "down";
  generatedAt: string;
}

export function getEcosystemOverview(): Promise<EcosystemOverview> {
  return apiFetch("/ecosystem/overview");
}

// --- Recent Activity: the current user's own activity feed, merged from
// security events, CRYNDY purchases, NDYBITS ledger entries, and
// membership changes. Not an ecosystem-wide/all-users feed.

export type ActivityType =
  | "SECURITY"
  | "CRYNDY_PURCHASE"
  | "NDYBITS"
  | "MEMBERSHIP";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  label: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export function getMyActivity(): Promise<ActivityItem[]> {
  return authedFetch("/activity/me");
}

// --- Business Center (Phase 4): workspace requests, team, invites ---

export type BusinessWorkspaceRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export interface BusinessWorkspaceRequest {
  id: string;
  requestedByUserId: string;
  requestedByNdyId: string;
  businessName: string;
  requestReason: string | null;
  status: BusinessWorkspaceRequestStatus;
  reviewedByNdyId: string | null;
  reviewReason: string | null;
  resolvedAt: string | null;
  createdWorkspaceId: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  type: "PERSONAL" | "BUSINESS";
  name: string;
  ownerUserId: string;
  ndyBusinessId: string | null;
  createdAt: string;
}

export interface WorkspaceMembershipRow {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  department: string | null;
  createdAt: string;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  invitedRole: WorkspaceRole;
  invitedDepartment: string | null;
  invitedByNdyId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
}

export function requestBusinessWorkspace(
  businessName: string,
  reason?: string,
): Promise<BusinessWorkspaceRequest> {
  return authedFetch("/business-workspaces/requests", {
    method: "POST",
    body: JSON.stringify({ businessName, reason }),
  });
}

export function getMyBusinessWorkspaceRequests(): Promise<
  BusinessWorkspaceRequest[]
> {
  return authedFetch("/business-workspaces/requests");
}

export function listBusinessWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMembershipRow[]> {
  return authedFetch(`/business-workspaces/${workspaceId}/members`);
}

export function listWorkspaceInvites(
  workspaceId: string,
): Promise<WorkspaceInvite[]> {
  return authedFetch(`/business-workspaces/${workspaceId}/invites`);
}

export function inviteToWorkspace(
  workspaceId: string,
  invitedEmail: string,
  invitedRole: WorkspaceRole,
  invitedDepartment?: string,
): Promise<WorkspaceInvite> {
  return authedFetch(`/business-workspaces/${workspaceId}/invites`, {
    method: "POST",
    body: JSON.stringify({ invitedEmail, invitedRole, invitedDepartment }),
  });
}

export function revokeWorkspaceInvite(
  workspaceId: string,
  inviteId: string,
): Promise<WorkspaceInvite> {
  return authedFetch(
    `/business-workspaces/${workspaceId}/invites/${inviteId}`,
    { method: "DELETE" },
  );
}

export function acceptWorkspaceInvite(
  token: string,
): Promise<WorkspaceMembershipRow> {
  return authedFetch("/workspace-invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
