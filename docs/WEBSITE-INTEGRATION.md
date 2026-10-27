# Integrating a Website with NDY HUB — Login & Signup

This is a step-by-step guide for connecting **your website's own login/signup
forms** directly to the NDY HUB API. Your site keeps its own UI — you're not
redirecting anywhere — you just call the NDY HUB API instead of your own
auth backend.

Full API reference (every endpoint, every field): **https://ndyhub.com/docs**
This document is the "how do I actually wire this up" companion to that
reference.

---

## 0. Before you write any code

**Send us your website's exact production domain** (e.g. `https://yoursite.com`)
so we can add it to the API's CORS allowlist. Until that's done, every
request your site's JavaScript makes to the API will be blocked by the
browser — this isn't optional, it has to happen first. If you have a
separate staging/preview domain, send that too.

**Base URL for every request below**: `https://api.ndyhub.com`

---

## 1. The core idea

1. User fills in your site's own signup/login form.
2. Your site's JavaScript calls the NDY HUB API (`fetch`/`axios`, whatever
   you already use) instead of your own backend.
3. NDY HUB gives back an **access token** (short-lived, 15 minutes) and a
   **refresh token** (long-lived, 30 days).
4. You store both, and send the access token on every request that needs to
   know who's logged in.
5. When the access token expires, you use the refresh token to get a new
   pair — silently, the user never notices.

There is no server-side session on your end to manage. NDY HUB is the only
place a password ever touches.

### This is the whole ecosystem's identity, not a copy of it

`POST /auth/register` doesn't create a "your-website" account that happens
to live in NDY HUB's database — it creates **the** account. The moment
someone registers through your site, they have a real NDY ID
(`NDY-XXXXXX`), and that same email/password (or the same NDY ID, if they
log in a different way) works unmodified on every other product that talks
to this same API — the NDY HUB dashboard itself, NDJOYIT, any future NDY
product, anything built from `docs/MOBILE-INTEGRATION.md` or this doc.
There's no sync step, no export, no "connect your account" flow needed —
one registration, used everywhere, by construction. The reverse is equally
true: someone who already has an NDY ID from using a different NDY product
logs into *your* site with the exact same credentials, no new signup.

The only thing that's "yours" is the UI — the form, the branding, the
screens. The identity behind it is shared, permanently, with everything
else in the ecosystem. That's the entire point of NDY HUB existing.

---

## 2. Where to store the tokens

**Do not use `localStorage` or `sessionStorage`** for either token — both
are readable by any JavaScript running on your page, which makes them a
target for XSS. The recommended approach:

- Store both tokens in an **httpOnly cookie set by your own backend**, if
  your site has one (your server proxies the login call, sets the cookie,
  and reads it back on subsequent requests — this is the most secure
  option and is what NDY HUB's own web app does).
- If your site is fully static/client-only with no backend of its own, the
  practical fallback is an in-memory JS variable for the access token
  (lost on page refresh, refreshed via the refresh token on load) plus the
  refresh token in a cookie with `Secure; SameSite=Strict` set by your own
  server if you have any backend at all, even a thin one.

If you're not sure which applies to your site, tell us your stack and
we'll advise directly — this is the one part of integration worth getting
right before shipping.

---

## 3. Registration

```js
const res = await fetch("https://api.ndyhub.com/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "person@example.com",
    password: "at least 8 characters",
    fullName: "Jane Doe", // optional but recommended — see step 6
  }),
});
const result = await res.json();
```

**Important: registration does NOT log the user in immediately.** The
response is always:

```json
{
  "requiresEmailVerification": true,
  "email": "person@example.com",
  "expiresInSeconds": 299
}
```

**As of 2026-10-06, verification is a typed-in 6-digit code, not a
link.** NDY HUB emails a 6-digit numeric code to that address, valid for
`expiresInSeconds` (always 299 — 4 minutes 59 seconds). Your UI should show
your own "enter your code" screen at this point, with a live countdown —
see step 5 for submitting it.

If the code expires or didn't arrive in time, resend it:

```js
await fetch("https://api.ndyhub.com/auth/verify-email/resend-by-email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "person@example.com" }),
});
// -> { "expiresInSeconds": 299 }
```

---

## 4. Login

```js
const res = await fetch("https://api.ndyhub.com/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const result = await res.json();
```

The response is **one of three shapes** — always check which one you got,
don't assume success:

```js
if ("requiresEmailVerification" in result) {
  // Correct password, but this account hasn't verified its email yet.
  // Show the same "enter your code" screen as step 3 (no
  // `expiresInSeconds` here — this reports existing state rather than
  // sending a new code — so call resend-by-email from step 3 first to get
  // a fresh one).
} else if ("requires2fa" in result) {
  // Correct password, but this account has 2FA enabled (authenticator
  // app and/or SMS). See step 7 — you need a second screen to collect
  // the 2FA code before you get real tokens.
} else {
  // Success — this is the real thing:
  // { accessToken, refreshToken, expiresIn: "15m" }
  saveTokens(result.accessToken, result.refreshToken);
}
```

Wrong email/password always returns a generic `401` with the message
`"Incorrect email or password."` — the API deliberately never reveals
which one was wrong.

---

## 5. Confirming the 6-digit code

There's nothing to deep-link or register for this — the code is the
credential, typed directly into a field on your own page. Build an "enter
your code" screen (6-digit numeric input, a live countdown driven by
`expiresInSeconds`, a resend button that re-enables once it hits zero),
then:

```js
const res = await fetch("https://api.ndyhub.com/auth/verify-email/confirm", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, code: userEnteredCode }),
});
const session = await res.json();
// -> { accessToken, refreshToken, expiresIn: "15m" }
saveTokens(session.accessToken, session.refreshToken);
```

This is the moment the account actually becomes usable — `register()`
itself never issues a session; confirming the code is what logs the user
in for the first time. Errors: `400` if the code is wrong or expired, `409`
if it was already used (e.g. a double form-submit).

To resend (same call as step 3):

```js
await fetch("https://api.ndyhub.com/auth/verify-email/resend-by-email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});
// -> { "expiresInSeconds": 299 } — issues a fresh code and a fresh window
```

---

## 6. Fetching the logged-in user's profile

Once you have an access token, every authenticated call sends it as a
bearer token:

```js
const res = await fetch("https://api.ndyhub.com/auth/me", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const profile = await res.json();
```

Returns the full profile — `ndyId` (the permanent NDY ID, e.g.
`NDY-4F82XK`), `email`, `fullName`, `profilePhotoUrl`, verification status,
and more. Full field list in the docs under "Profile."

---

## 7. If the account has 2FA enabled

`login()` returned `{ requires2fa: true, challengeToken, methods }` —
`methods` is an array like `["TOTP"]`, `["SMS"]`, or both. Show a second
screen asking for a code, then:

```js
const res = await fetch("https://api.ndyhub.com/auth/2fa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ challengeToken, code: userEnteredCode }),
});
const session = await res.json();
// -> { accessToken, refreshToken, expiresIn: "15m" }
```

If `methods` includes `"SMS"` and the user picks it (or it's the only
option), you may need to trigger the actual text message first:

```js
await fetch("https://api.ndyhub.com/auth/2fa/send-sms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ challengeToken }),
});
```

(If SMS is the account's *only* 2FA method, this already happened
automatically when `login()` was called — no need to call it again unless
the user asks to resend.)

---

## 8. Refreshing an expired access token

Access tokens last 15 minutes. Before making an API call (or on a 401), use
the refresh token to get a new pair:

```js
const res = await fetch("https://api.ndyhub.com/auth/refresh", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refreshToken }),
});
const session = await res.json();
// -> { accessToken, refreshToken, expiresIn: "15m" }
saveTokens(session.accessToken, session.refreshToken); // always save BOTH — the refresh token rotates too
```

**The refresh token rotates on every use** — the old one stops working the
instant a new pair is issued. Always overwrite your stored refresh token
with the new one from the response, never keep reusing the original.

**Device identification (optional, recommended)**: NDY HUB supports
central, ecosystem-wide device management — a user can see and revoke
every device connected across every NDY product from one place
(`ndyhub.com/security`). To participate, generate a random ID once,
persist it (a long-lived cookie or `localStorage`), and send it as an
`x-device-id` header on every `/auth/register`, `/auth/login`, and
`/auth/refresh` call:

```js
const res = await fetch("https://api.ndyhub.com/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-device-id": getOrCreateDeviceId(), // your own helper, stored client-side
  },
  body: JSON.stringify({ email, password }),
});
```

This is optional — a site that never sends it still authenticates
normally, it just won't appear in the user's cross-product device list.

---

## 9. Logout

```js
await fetch("https://api.ndyhub.com/auth/logout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refreshToken }),
});
// then clear your own stored tokens
```

---

## 10. Password reset

```js
// Step 1 — request a code
await fetch("https://api.ndyhub.com/auth/forgot-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});
// -> { "expiresInSeconds": 299 } — always this shape, whether or not the email exists

// Step 2 — user receives a 6-digit code by email, types it + a new password
const res = await fetch("https://api.ndyhub.com/auth/reset-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, code: "482913", newPassword: "new password" }),
});
```

This is code-based, not link-based — build one form that collects the code
and the new password together, not a link-click flow. Resetting revokes
every existing session on the account (the user gets signed out everywhere
except wherever they just reset from).

---

## 11. Rate limits

Every endpoint above except `/auth/refresh`, `/auth/me`, and `/auth/logout`
is limited to **5 requests per minute per IP address**. If you're testing
by rapidly resubmitting a form, you'll hit a `429 Too Many Requests` —
that's expected, not a bug. Build a real "too many attempts, wait a
minute" message into your UI rather than retrying silently in a loop.

---

## 12. Checklist before you consider this done

- [ ] Told us your production (and staging) domain for the CORS allowlist
- [ ] Registration form calls `/auth/register`, shows an "enter your code"
      state on the `requiresEmailVerification` response
- [ ] That screen collects the 6-digit code and calls
      `/auth/verify-email/confirm` with `{ email, code }`, with a live
      countdown from `expiresInSeconds` and a working resend button
- [ ] Login form handles all three response shapes (email verification, 2FA,
      success) — not just the success case
- [ ] Tokens stored somewhere other than plain `localStorage`
- [ ] Refresh logic in place before tokens expire in production (don't
      just test with a fresh 15-minute window and call it done)
- [ ] Logout clears stored tokens AND calls `/auth/logout`
- [ ] Password reset form collects email → code + new password (not a
      link-click flow)
- [ ] A visible "too many attempts" state for the 429 rate-limit response

Questions or something doesn't behave as documented — ask before guessing;
these are auth flows, not a place to paper over an unclear response shape.
