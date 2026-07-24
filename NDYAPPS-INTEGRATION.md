# NDYAPPS ↔ NDY HUB integration contract

This is what the NDYAPPS developer needs to build the login-approval side of
the QR / deep-link flow. Everything below is implemented and running in
`apps/api` today — this isn't a design doc, it's a description of working
code. If something here turns out to be wrong, the code is the source of
truth; ping whoever owns `apps/api` to update this file at the same time.

Base URL for local dev: `http://localhost:3000`. There is no staging/prod
URL yet — this will get an entry here the moment one exists.

## The one thing to understand before anything else

**NDYAPPS needs its own logged-in session before it can approve anything.**
The person must already be signed into NDYAPPS itself (today: email +
password against the same `/auth` endpoints below; Google/Apple/passkey
login are Phase 1 items not built yet). That session's **access token** is
what gets sent as a Bearer token when approving or denying a login request —
it's how the server knows *who* is approving, and it's what stops a random
caller from approving a login as someone else.

## Getting a session (NDYAPPS's own login)

```
POST /auth/register
Body: { "email": string, "password": string (min 8 chars), "fullName"?: string }

POST /auth/login
Body: { "email": string, "password": string }

POST /auth/refresh
Body: { "refreshToken": string }

POST /auth/logout
Body: { "refreshToken": string }
```

`register`, `login`, and `refresh` all return the same shape:

```json
{ "accessToken": "<JWT>", "refreshToken": "<opaque string>", "expiresIn": "15m" }
```

**`expiresIn` is a duration string like `"15m"`, not a number of seconds** —
don't parse it as an integer. The access token is a 15-minute JWT; the
refresh token is a 30-day opaque string that **rotates on every use** (the
old one stops working the instant `/auth/refresh` issues a new one, so don't
cache a refresh token you've already spent). Store both the way you'd store
any long-lived credential — platform keychain/keystore, not plain
`UserDefaults`/`SharedPreferences`.

## The login-request lifecycle

A "login request" is what a desktop browser or a deep link creates when
someone clicks "Continue with NDYAPPS." It's a random 32-character token,
valid for **90 seconds**, usable exactly once. NDYAPPS only ever touches it
after it already exists — creating it is the browser's job, not yours.

```
GET /auth/login-request/:token
```
No auth required. Call this first, whichever way NDYAPPS received the
token (QR scan or deep link), to get what to show on the approval screen:

```json
{
  "id": "...",
  "token": "...",
  "method": "QR",
  "status": "PENDING",
  "requestingIp": "203.0.113.4",
  "requestingDevice": null,
  "requestingBrowser": "Mozilla/5.0 ...",
  "requestingLocation": null,
  "userId": null,
  "expiresAt": "2026-07-25T10:32:11.000Z",
  "approvedAt": null,
  "deniedAt": null,
  "sessionIssuedAt": null,
  "createdAt": "2026-07-25T10:30:41.000Z"
}
```

Show the person: the browser/device info you have, and a countdown to
`expiresAt`. If `status` isn't `"PENDING"` when you fetch it, don't show an
approve/deny screen at all — show why (expired / already handled).

**Known gap, flagged on purpose:** there's no "which website is asking" field
yet — today every login request originates from NDY HUB itself, so there's
nothing to disambiguate. Once other NDJOYIT sites become OIDC clients of NDY
HUB (later milestone), a requesting-site field will need to be added here,
and this doc will get a corresponding update before you'd need to handle it.

```
POST /auth/login-request/:token/approve
Header: Authorization: Bearer <NDYAPPS's own access token>
```
```
POST /auth/login-request/:token/deny
Header: Authorization: Bearer <NDYAPPS's own access token>
```

Both return the updated login-request object (same shape as the `GET`
above). Both are single-use: calling either twice, or calling one after the
other, returns a `409 Conflict` the second time — treat that as "someone
else (or a double-tap) already handled this," not as a bug to retry.

Approving flips `ndyappsConnected` to `true` on the user's account (visible
via `GET /passport/:ndyId`) — that's the only place that flag gets set, so
it's an accurate signal of "this person has actually used NDYAPPS to log in
at least once," not just "installed the app."

## What NDYAPPS does NOT need to implement

- **The WebSocket channel** (`login-request:subscribe` / `login-request:status`)
  — that's how the *desktop browser* finds out approval happened live. NDYAPPS
  never connects to it.
- **`POST /auth/login-request/:token/exchange`** — that's the desktop
  redeeming an approved request for its own session. Not NDYAPPS's call to make.
- **Creating login requests** (`POST /auth/login-request`) — NDYAPPS only
  ever receives a token that already exists (via QR scan or deep link), never
  originates one.

## Deep link format

```
ndyapps://login?token=<32-char token>&fallback=<url-encoded web fallback URL>
```

Register `ndyapps://login` as a custom URL scheme (and, once there's a real
domain, as an iOS Universal Link / Android App Link pointing at that
domain — TODO once `apps/web` has a production URL). On open: parse `token`
from the query string, call `GET /auth/login-request/:token`, show the
approval screen. `fallback` is there so a browser that opens this link by
mistake lands somewhere sane instead of a dead custom scheme — NDYAPPS can
ignore it.

## Error shape

Every error response is `{ "message": string, ... }` with a standard HTTP
status (`400` malformed/expired, `401` missing or bad bearer token, `404`
unknown token/NDY ID, `409` already-handled). No custom error codes yet —
match on status code, not on message text, since the message strings aren't
guaranteed stable.

## Open items this contract doesn't cover yet

- Push notifications for an incoming login request (Firebase/OneSignal,
  per the architecture doc) — not wired up; today NDYAPPS has to be already
  open to catch a scan/deep-link.
- Google/Apple/passkey login, 2FA — Phase 1 items, not built.
- Any admin/support surface for revoking a device's NDYAPPS connection —
  that's the Security page (`apps/web`), also not built yet.
