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

The user gets an email with a verification link (expires in 4 minutes 59
seconds). Your UI should show a "check your email" screen at this point —
see step 5 for how the user actually gets logged in after clicking it.

If the email didn't arrive in time, resend it:

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
  // Show the same "check your email" screen as step 3, and offer the
  // resend-by-email call from step 3 again.
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

## 5. Confirming the email verification link

The verification email links to `https://ndyhub.com/verify-email?token=...`
by default — **that's NDY HUB's own page, not yours**. If you want the
user to land back on your site instead, you'll need to build your own
`/verify-email` page that reads the `token` query param and calls:

```js
const res = await fetch("https://api.ndyhub.com/auth/verify-email/confirm", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token }),
});
const session = await res.json();
// -> { accessToken, refreshToken, expiresIn: "15m" }
saveTokens(session.accessToken, session.refreshToken);
```

This is the moment the account actually becomes usable — the response is a
real session, log the user straight in. Tell us if you want the
verification email itself to link to your domain instead of ndyhub.com and
we'll set that up per-account.

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
- [ ] Registration form calls `/auth/register`, shows a "check your email"
      state on the `requiresEmailVerification` response
- [ ] A `/verify-email` page on your own site (or you're OK using NDY
      HUB's) that calls `/auth/verify-email/confirm` and logs the user in
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
