# NDY HUB API Reference

Base URL:
- Production: `https://api.ndyhub.com`
- Local dev: `http://localhost:3000`

All request/response bodies are JSON unless noted otherwise. All endpoints
are under the `/auth`, `/oauth`, or `/security` prefix shown in each
section's heading.

## Contents

1. [Authentication model](#authentication-model)
2. [Registration](#registration)
3. [Email verification](#email-verification)
4. [Login](#login)
5. [Two-factor authentication (TOTP)](#two-factor-authentication-totp)
6. [Passkeys (WebAuthn/FIDO2)](#passkeys-webauthnfido2)
7. [Social login (Google / Apple)](#social-login-google--apple)
8. [Password management](#password-management)
9. [Profile](#profile)
10. [Sessions & security](#sessions--security)
11. [Connected accounts (social)](#connected-accounts-social)
12. [OAuth2 / OIDC provider (for other NDY apps)](#oauth2--oidc-provider-for-other-ndy-apps)
13. [QR / cross-device login](#qr--cross-device-login)
14. [Rate limits](#rate-limits)
15. [Error shape](#error-shape)

---

## Authentication model

NDY HUB issues short-lived **access tokens** (15 minutes, signed JWT) and
long-lived **refresh tokens** (30 days, opaque random string, only its
SHA-256 hash is stored server-side).

Any endpoint that issues a session (register, login, email verification
confirm, 2FA verify, passkey login, OAuth code exchange, QR-login exchange)
returns:

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "3f8a...",
  "expiresIn": "15m"
}
```

**Two ways to carry these:**

- **Browser (web app)**: the same response also sets two `httpOnly`
  cookies — `ndyhub_access_token` and `ndyhub_refresh_token` — via
  `SessionCookieInterceptor`. The web app never touches the tokens
  directly; it just relies on the cookies being sent automatically.
- **Non-browser clients (NDYAPPS, mobile, server-to-server)**: read
  `accessToken`/`refreshToken` from the JSON body and send the access
  token as `Authorization: Bearer <accessToken>` on every authenticated
  request.

Endpoints marked **🔒 authenticated** require either the cookie or the
`Authorization` header.

**Refreshing**: `POST /auth/refresh` with `{ "refreshToken": "..." }` (or
just the cookie, browser clients don't need a body) rotates to a new
access/refresh pair and revokes the old refresh token — a stolen-and-reused
refresh token only ever works once.

**Logout**: `POST /auth/logout` with the same shape as refresh. Revokes the
refresh token and clears both cookies.

---

## Registration

### `POST /auth/register`

```json
{
  "email": "person@example.com",
  "password": "at least 8 characters",
  "fullName": "Jane Doe",
  "bio": "optional, max 280 chars",
  "country": "optional, max 56 chars",
  "website": "https://optional-url.com",
  "linkedinUrl": "https://linkedin.com/in/...",
  "instagramUrl": "https://instagram.com/...",
  "xUrl": "https://x.com/...",
  "businessName": "optional",
  "businessRole": "optional",
  "phone": "optional",
  "bioIsPublic": true,
  "countryIsPublic": true,
  "websiteIsPublic": true,
  "socialsIsPublic": true,
  "businessIsPublic": true,
  "phoneIsPublic": true
}
```

Only `email` and `password` are required. `fullName`, `bio`, `country`,
etc. are the same Passport Card fields exposed later on `PATCH /auth/me` —
sending them at registration just saves the user a second step. Everything
except `email`/`password` can be filled in later.

At registration, the backend immediately mints a permanent **NDY ID**
(format `NDY-XXXXXX`, e.g. `NDY-4F82XK`) — this never changes and is the
user's identifier across the whole ecosystem.

**Response** — registration does **not** issue a session directly. The
account exists but is unusable until its email is confirmed:

```json
{
  "requiresEmailVerification": true,
  "email": "person@example.com",
  "expiresInSeconds": 299
}
```

`expiresInSeconds` is always `299` (4 minutes 59 seconds) — the window the
just-sent verification email is valid for. The frontend uses this to drive
a live countdown.

Rate limit: 5 requests/minute/IP.

---

## Email verification

Verification is **link-based**, not a code — the email contains a button
linking to `{WEB_APP_URL}/verify-email?token=...`. The link expires in
**4 minutes 59 seconds**; after that it must be resent.

### `POST /auth/verify-email/confirm`

Public (no auth) — the token itself is the credential.

```json
{ "token": "the-32-char-token-from-the-email-link" }
```

**This is where a brand-new account's first real session is issued** —
`register()` no longer issues one, so confirming email is what actually
logs the user in for the first time. Response is a full session object
(see [Authentication model](#authentication-model)).

Errors: `400` if the token is invalid or expired, `409` if it was already
used (double-click protection).

### `POST /auth/verify-email/resend-by-email`

Public. Used on the "check your email" screen shown right after
registration (no session exists yet to authenticate a resend).

```json
{ "email": "person@example.com" }
```

Response: `{ "expiresInSeconds": 299 }` — always the same shape whether or
not the email is actually registered/unverified (prevents using this
endpoint to enumerate which emails have accounts). Issues a **fresh**
token and a fresh 4:59 window every time it's called.

Rate limit: 5 requests/minute/IP.

### `POST /auth/verify-email/resend` 🔒

Session-gated equivalent of the above, for a logged-in-but-somehow-still-
unverified edge case. No body required.

---

## Login

### `POST /auth/login`

```json
{ "email": "person@example.com", "password": "..." }
```

Returns one of three shapes depending on account state — same
discriminated-union pattern used throughout this API rather than throwing
for "successful request, different next step":

**1. Unverified email** — password was correct, but the account can't log
in yet:
```json
{ "requiresEmailVerification": true, "email": "person@example.com" }
```
(No `expiresInSeconds` here — this reports existing state, it doesn't send
a new email. Call `verify-email/resend-by-email` to get a fresh link.)

**2. 2FA enabled** — password was correct, a TOTP/backup code is still
needed:
```json
{ "requires2fa": true, "challengeToken": "..." }
```
Continue with `POST /auth/2fa/verify` (see below).

**3. Success** — a full session object.

Wrong email/password always returns a generic `401 Incorrect email or
password.` — never reveals which part was wrong. A suspended account
returns `401 This account has been suspended.`

Rate limit: 5 requests/minute/IP.

---

## Two-factor authentication (TOTP)

Authenticator-app based (RFC 6238, ±30s clock-drift tolerance), plus 8
single-use backup/recovery codes. SMS and email-OTP are **not**
implemented as 2FA methods yet — this is TOTP-only today.

### `POST /auth/2fa/setup` 🔒

No body. Generates (or regenerates, if setup was started but never
confirmed) a secret.

```json
{ "secret": "BASE32SECRET...", "otpauthUri": "otpauth://totp/NDY%20HUB:..." }
```

Render `otpauthUri` as a QR code for the user's authenticator app, or show
`secret` for manual entry.

### `POST /auth/2fa/enable` 🔒

```json
{ "code": "123456" }
```

The 6-digit code from the authenticator app, to prove setup worked.
Returns the 8 backup codes **exactly once** — only their hashes are ever
stored, so this is the user's only chance to save them:

```json
{ "backupCodes": ["ABCD-1234", "..."] }
```

### `POST /auth/2fa/disable` 🔒

```json
{ "currentPassword": "...", "code": "123456-or-a-backup-code" }
```

Requires both the current password and a valid code — high friction on
purpose for a security-downgrading action. Deletes the secret and all
backup codes; re-enabling later starts fresh.

### `POST /auth/2fa/verify`

Public — this is step 2 of a 2FA login, called after `login()` returned
`requires2fa`.

```json
{ "challengeToken": "from-the-login-response", "code": "123456-or-backup-code" }
```

Returns a full session on success. Using a backup code is logged as a
distinct `RECOVERY_CODE_USED` security event (see
[Sessions & security](#sessions--security)). Challenge tokens expire after
5 minutes and are single-use.

Rate limit: 5 requests/minute/IP.

---

## Passkeys (WebAuthn/FIDO2)

Real `@simplewebauthn` implementation — Face ID (iOS/Safari), fingerprint
(Android/Chrome), Windows Hello, or a hardware security key all work
through this. **No biometric data is ever sent to or stored by NDY HUB** —
the device/OS verifies the biometric locally and only sends back a
cryptographic signature.

A successful passkey login issues a session directly without also
requiring TOTP, even on a 2FA-enabled account — a passkey already clears a
higher bar (phishing-resistant public-key crypto + on-device user
verification) than a password does.

### `GET /auth/passkeys` 🔒

```json
[
  { "id": "...", "deviceLabel": "iPhone", "createdAt": "...", "lastUsedAt": "..." }
]
```

### `DELETE /auth/passkeys/:id` 🔒

Removes a passkey. `404` if it doesn't exist or belongs to another user.

### `POST /auth/passkeys/register/options` 🔒

No body. Returns WebAuthn registration options plus a `challengeId` — pass
both straight into `navigator.credentials.create()` (or
`@simplewebauthn/browser`'s `startRegistration()`).

### `POST /auth/passkeys/register/verify` 🔒

```json
{
  "challengeId": "from-the-options-call",
  "response": { "...": "the browser's PublicKeyCredential, as JSON" },
  "deviceLabel": "optional, e.g. 'MacBook Touch ID'"
}
```

### `POST /auth/passkeys/login/options`

Public, no body — usernameless/discoverable login. Returns authentication
options + `challengeId`.

### `POST /auth/passkeys/login/verify`

Public.

```json
{ "challengeId": "...", "response": { "...": "the browser's assertion" } }
```

Returns a full session. Same generic failure message whether the
credential was unrecognized or cryptographic verification failed — no
oracle for which one it was.

Rate limit: 5 requests/minute/IP.

---

## Social login (Google / Apple)

### `GET /auth/oauth/providers`

Public. `{ "google": true, "apple": false }` — lets the frontend decide
whether to render each button at all, based on whether credentials are
actually configured server-side.

### `GET /auth/oauth/:provider/start?next=/dashboard`

`:provider` is `google` or `apple`. A real browser navigation (302
redirect to the provider's consent screen), not a fetch call.

### `GET /auth/oauth/google/callback` / `POST /auth/oauth/apple/callback`

Provider redirects/posts here. Google uses a GET redirect; Apple **posts**
(`response_mode=form_post`, required whenever name/email scopes are
requested). Both end in a 302 redirect back to the web app with a one-time
exchange `code` in the URL — the actual tokens never appear in a URL.

### `POST /auth/oauth/exchange`

Public.

```json
{ "code": "the-one-time-code-from-the-callback-redirect" }
```

Returns a full session.

### `POST /auth/oauth/:provider/connect` 🔒

Same as `start`, but for linking a social account to an *already logged
in* user (Settings → "Connect Google"). Returns `{ "url": "..." }` as JSON
instead of redirecting — the frontend navigates the browser there itself.

---

## Password management

### `POST /auth/change-password` 🔒

```json
{ "currentPassword": "...", "newPassword": "at least 8 chars" }
```

Rate limit: 5 requests/minute/IP.

### `POST /auth/forgot-password`

Public.

```json
{ "email": "person@example.com" }
```

Password reset is **code-based**, not link-based: a 6-digit numeric code
is emailed. Response is always the same shape regardless of whether the
email is registered (account-enumeration-safe):

```json
{ "expiresInSeconds": 299 }
```

### `POST /auth/reset-password`

Public — the code is the credential.

```json
{ "email": "person@example.com", "code": "482913", "newPassword": "at least 8 chars" }
```

On success, **every existing session on the account is revoked** —
whoever had the old password gets signed out everywhere, not just on the
device doing the reset. `400` if the code is invalid/expired, `409` if
already used.

### `POST /auth/reset-password/resend`

Public, same body/behavior as `forgot-password` (delegates to it directly)
— the "Resend code" button on the enter-code screen.

Rate limit on both: 5 requests/minute/IP.

---

## Profile

### `GET /auth/me` 🔒

```json
{
  "id": "uuid",
  "ndyId": "NDY-4F82XK",
  "email": "person@example.com",
  "fullName": "Jane Doe",
  "profilePhotoUrl": "https://...",
  "verificationLevel": "LEVEL_1",
  "ndyappsConnected": false,
  "twoFactorEnabled": false,
  "role": "USER",
  "createdAt": "...",
  "bio": "...", "country": "...", "website": "...",
  "linkedinUrl": "...", "instagramUrl": "...", "xUrl": "...",
  "businessName": "...", "businessRole": "...", "phone": "...",
  "bioIsPublic": true, "countryIsPublic": true, "websiteIsPublic": true,
  "socialsIsPublic": true, "businessIsPublic": true, "phoneIsPublic": true,
  "passportComplete": true,
  "isVerified": false
}
```

`verificationLevel` is `LEVEL_0` (unverified) through `LEVEL_3`; email
confirmation moves `LEVEL_0` → `LEVEL_1`. `passportComplete` reflects
whether the required Passport fields (full name, country, photo) are
filled in — `DashboardGate` on the frontend routes anyone `false` here to
`/passport/complete`.

### `PATCH /auth/me` 🔒

Same body shape as the optional fields in [Registration](#registration)
(`fullName`, `bio`, `country`, `website`, `linkedinUrl`, `instagramUrl`,
`xUrl`, `businessName`, `businessRole`, `phone`, and the matching
`*IsPublic` booleans, plus `profilePhotoUrl` as a direct URL string).
Returns the same shape as `GET /auth/me` (minus a couple of fields).

### `POST /auth/me/photo` 🔒

`multipart/form-data`, field name `photo`. JPEG/PNG/WebP only, max 5MB
(SVG is deliberately rejected — it can carry inline `<script>`).

```json
{ "profilePhotoUrl": "https://..." }
```

---

## Sessions & security

### `GET /security/sessions` 🔒

Every active (non-revoked, non-expired) session/device currently signed
in.

```json
[
  {
    "id": "uuid",
    "userAgent": "Mozilla/5.0...",
    "ip": "203.0.113.4",
    "createdAt": "...",
    "expiresAt": "...",
    "isCurrent": true
  }
]
```

### `DELETE /security/sessions/:id` 🔒

Revokes one session. `404` if it isn't active or doesn't belong to the
caller.

### `POST /security/sessions/revoke-all` 🔒

Logs out every device, including the one making the call (its access
token stays valid until natural expiry — max 15 minutes — since it's a
stateless JWT with nothing to revoke, but the refresh token behind it is
dead).

```json
{ "revokedCount": 3 }
```

### `GET /security/events` 🔒

The account's security activity timeline — up to the 50 most recent
events, newest first:

```json
[
  {
    "id": "uuid",
    "type": "LOGIN_SUCCESS",
    "ip": "203.0.113.4",
    "userAgent": "Mozilla/5.0...",
    "createdAt": "..."
  }
]
```

`type` is one of: `LOGIN_SUCCESS`, `NEW_DEVICE`, `PASSWORD_CHANGED`,
`PASSKEY_ADDED`, `PASSKEY_REMOVED`, `TOTP_ENABLED`, `TOTP_DISABLED`,
`RECOVERY_CODE_USED`, `EMAIL_CHANGED`, `OAUTH_APP_CONNECTED`,
`OAUTH_APP_REVOKED`.

`NEW_DEVICE` fires alongside `LOGIN_SUCCESS` the first time a given
`User-Agent` string signs in on that account — a simple first-seen check
against prior sessions, not full device fingerprinting. This log is
distinct from the admin-only audit log: every row here is something the
account owner themselves did or that happened to their own account.

---

## Connected accounts (social)

### `GET /auth/connected-accounts` 🔒

Google/Apple accounts linked for sign-in (distinct from OAuth *client*
grants below — this is "which social providers can I log in with," not
"which third-party apps can access my data").

### `DELETE /auth/connected-accounts/:id` 🔒

Unlinks a social provider. Rejected with `409` if this would leave the
account with no way to sign in at all — no password, no other linked
social provider, and no passkey.

---

## OAuth2 / OIDC provider (for other NDY apps)

NDY HUB is a standards-compliant OpenID Connect provider — this is the
mechanism by which NDJOYIT, NDYAPPS, and future NDY products all
authenticate against the same identity without each maintaining their own
password store. Authorization Code Flow with PKCE (S256 only — `plain` is
rejected).

**Integrating a specific client?** This section is the raw endpoint
reference — for a guided, step-by-step walkthrough see
`docs/WEBSITE-INTEGRATION.md` (a website calling the API directly) or
`docs/MOBILE-INTEGRATION.md` (a Flutter/native app, registered as a
**Public** OAuth client — no `client_secret`, PKCE-only, see that doc's §1
for why).

**Discovery**: `GET /.well-known/openid-configuration` and
`GET /.well-known/jwks.json` — standard OIDC discovery documents, so any
off-the-shelf OIDC client library can integrate without NDY HUB-specific
code.

**Supported scopes**:

| Scope | Grants |
|---|---|
| `openid` | Confirm who you are (required on every connection) |
| `profile` | Name and NDY ID |
| `email` | Email address |
| `membership` | Current membership tier and status |
| `cryndy` | Available CRYNDY balance |

### 1. `GET /oauth/authorize?client_id=...&redirect_uri=...&response_type=code&scope=openid+profile&state=...&code_challenge=...&code_challenge_method=S256`

Browser redirect entry point. Never redirects back to the relying party on
a bad `client_id`/`redirect_uri` (that's an open-redirect phishing vector)
— renders a plain error instead. On success, redirects the browser to the
web app's own `/oauth/consent` page (which knows whether this browser has
an NDY HUB session; the API layer doesn't).

### 2. `GET /oauth/authorize/status?client_id=...&scope=...` 🔒

Called by the consent page. Tells it what to render:

```json
{
  "client": { "name": "NDYAPPS", "...": "..." },
  "scopeDescriptions": [{ "scope": "profile", "description": "Your name and NDY ID" }],
  "alreadyGranted": false
}
```

If `alreadyGranted` is `true`, the consent page can skip straight to
issuing a code — that's the actual "one login, not one login per visit"
part of SSO.

### 3. `POST /oauth/authorize/consent` 🔒

```json
{
  "clientId": "...", "redirectUri": "...", "scope": "openid profile",
  "approve": true, "state": "...",
  "codeChallenge": "...", "codeChallengeMethod": "S256"
}
```

```json
{ "redirectUrl": "https://relying-party.com/callback?code=...&state=..." }
```

The frontend navigates the browser to `redirectUrl`. If `approve: false`,
the redirect carries `error=access_denied` instead of a code.

### 4. `POST /oauth/token` (client-authenticated)

**Confidential clients** (websites, server backends): the relying party's
**backend**, never the browser, calls this directly with its
`client_id`/`client_secret`.

```json
{
  "grant_type": "authorization_code",
  "code": "...", "redirect_uri": "...", "code_verifier": "...",
  "client_id": "...", "client_secret": "..."
}
```

or

```json
{ "grant_type": "refresh_token", "refresh_token": "...", "client_id": "...", "client_secret": "..." }
```

**Public clients** (native/mobile apps registered with `clientType:
PUBLIC` — see `docs/MOBILE-INTEGRATION.md`): identical shape, but
`client_secret` is omitted entirely — none is ever issued to a Public
client. `code_verifier` (PKCE) is mandatory instead, both here and at
`/oauth/authorize` in step 1; a Public client's authorize request without
a `code_challenge` is rejected outright.

Standard OIDC token response shape (`access_token`, `id_token`,
`refresh_token`, `expires_in`, `token_type`) regardless of client type.

### 5. `GET /oauth/userinfo`

Bearer-authenticated with the *OAuth* access token (not an NDY HUB
session token). Returns claims matching the granted scope.

### `GET /oauth/grants` 🔒 / `DELETE /oauth/grants/:id` 🔒

The user-facing "which apps are connected to my account" list and revoke
action — same data shown on the `/security` dashboard page. Revoking also
kills every refresh token that client holds for the user, not just the
grant record.

---

## QR / cross-device login

Used by NDYAPPS-style flows where a desktop browser shows a QR code and a
phone (already logged in) approves it.

- `POST /auth/login-request` — desktop creates a pending request, gets a
  token back to render as a QR code / poll.
- `GET /auth/login-request/:token` — poll for status (`PENDING` /
  `APPROVED` / `DENIED` / `EXPIRED`). Prefer subscribing to the
  `login-request:status` WebSocket event over polling.
- `POST /auth/login-request/:token/approve` 🔒 — phone approves (requires
  a valid NDY HUB session).
- `POST /auth/login-request/:token/deny` 🔒 — phone denies.
- `POST /auth/login-request/:token/exchange` — desktop, once it sees
  `APPROVED`, trades the token for a real session.

Requests expire after 90 seconds.

---

## Rate limits

Every credential-guessing-relevant endpoint (register, login, 2FA verify,
passkey login verify, OAuth exchange, forgot-password, reset-password and
its resend, change-password, both email-verification resend endpoints) is
limited to **5 requests/minute/IP** — tighter than the app-wide default of
100/minute. Exceeding it returns `429 Too Many Requests`.

## Error shape

Standard NestJS/`class-validator` shape:

```json
{
  "statusCode": 400,
  "message": "Incorrect email or password.",
  "error": "Bad Request"
}
```

`message` can be a string or an array of strings (validation errors, one
per failing field). Error messages are deliberately generic wherever a
specific one could leak account existence (e.g. login, password reset,
email verification resend all use the same message regardless of whether
the target account exists).
