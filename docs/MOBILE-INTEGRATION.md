# Integrating a Flutter App with NDY HUB — Login & Signup

This is a step-by-step guide for connecting **your Flutter app's login/signup**
to NDY HUB instead of Firebase Auth or your own backend's user table. Same
underlying identity as every website integration (see
`docs/WEBSITE-INTEGRATION.md`) — one account, one password, shared across
every NDY product. If a user already signed up through NDJOYIT or another
NDY app, they log into yours with the exact same credentials — nothing new
to create.

Full API reference (every endpoint, every field): **https://ndyhub.com/docs**

---

## 0. Before you write any code

**Send us:**
1. Your app's name (shown on the login screen users see).
2. The **redirect URI** your app will use to receive the login result —
   either a custom URL scheme (`ndjoyit://oauth-callback`) or, if you'd
   rather avoid custom-scheme collisions with other apps on the same
   device, an Android App Link / iOS Universal Link
   (`https://ndjoyit.com/oauth-callback`).
3. Which scopes you need: `openid` (always required), plus any of
   `profile`, `email`, `membership`, `cryndy`.

We register your app as a **Public** OAuth client and send back a
`client_id`. There is no `client_secret` — that's intentional, not a step
we forgot (see §1 for why).

**Base URL for every request below**: `https://api.ndyhub.com`

---

## 1. Why this looks different from a website integration

A website's backend can keep a `client_secret` genuinely secret — it never
leaves the server. A mobile app can't: anyone can decompile an APK or IPA
and pull a string out of it, so a "secret" embedded in your app isn't one.

NDY HUB's OAuth provider supports two kinds of client:

| | **Confidential** (websites, server backends) | **Public** (your Flutter app) |
|---|---|---|
| Gets a `client_secret` | Yes | No — never issued |
| Authenticates itself via | The secret | PKCE (below) |
| Used by | `docs/WEBSITE-INTEGRATION.md` | This document |

**PKCE** (Proof Key for Code Exchange) is the standard replacement for a
secret in native apps — your app generates a random value, sends a hash of
it up front, and proves it holds the original at the end. Nobody who
intercepts the initial request can complete the exchange without that
original value, which never left your app's memory. This is the same
mechanism Google, Apple, and every serious OAuth provider requires for
native apps (RFC 8252), and it's mandatory here — an authorize request
from your app with no PKCE challenge is rejected outright.

You don't need to implement PKCE by hand. The library in §2 does it for
you.

---

## 2. Add the login flow

Add [`flutter_appauth`](https://pub.dev/packages/flutter_appauth) to your
`pubspec.yaml`:

```yaml
dependencies:
  flutter_appauth: ^7.0.0   # check pub.dev for the current version
```

This is Flutter's wrapper around Google's own AppAuth libraries
(AppAuth-Android / AppAuth-iOS) — the standard, audited way native apps do
OAuth. It opens the login page in the system browser or an in-app Custom
Tab (never a plain WebView — that's deliberate; a WebView can't be trusted
not to be instrumented by the host app, which defeats the point of not
trusting the app with a secret in the first place), generates the PKCE
challenge, and hands you back tokens.

```dart
import 'package:flutter_appauth/flutter_appauth.dart';

final FlutterAppAuth appAuth = FlutterAppAuth();

Future<void> signInWithNdyHub() async {
  final result = await appAuth.authorizeAndExchangeCode(
    AuthorizationTokenRequest(
      'YOUR_CLIENT_ID',              // from step 0 — no secret, ever
      'ndjoyit://oauth-callback',    // your registered redirect URI
      serviceConfiguration: const AuthorizationServiceConfiguration(
        authorizationEndpoint: 'https://api.ndyhub.com/oauth/authorize',
        tokenEndpoint: 'https://api.ndyhub.com/oauth/token',
      ),
      scopes: ['openid', 'profile', 'email'],
    ),
  );

  final accessToken = result.accessToken;   // 15-minute lifetime
  final refreshToken = result.refreshToken; // 30-day lifetime
  final idToken = result.idToken;           // decode for name/NDY ID

  // Store these — see §4 for where.
}
```

That single call does the entire round trip: it opens the browser, the
user logs in (or is silently already logged in — that's the actual "one
login for the ecosystem" part), NDY HUB redirects back into your app, and
`flutter_appauth` exchanges the code for tokens automatically, including
sending the PKCE verifier itself. You never touch the authorization code
or construct the token request by hand.

### Android — register the redirect scheme

In `android/app/build.gradle`, inside `defaultConfig`:

```gradle
manifestPlaceholders += [
    'appAuthRedirectScheme': 'ndjoyit'   // the scheme part only, before '://'
]
```

### iOS — register the redirect scheme

In `ios/Runner/Info.plist`, add a `CFBundleURLTypes` entry:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>ndjoyit</string>
    </array>
  </dict>
</array>
```

If you registered an Android App Link / Universal Link instead of a custom
scheme, follow `flutter_appauth`'s README for the associated-domains setup
— it's a standard deep-link registration, nothing NDY HUB-specific.

---

## 3. What can go wrong, and what it means

| Error | Cause |
|---|---|
| `code_challenge is required for public clients` | Your OAuth library didn't send a PKCE challenge — check you're using `authorizeAndExchangeCode` (or equivalent), not a raw manual request. |
| `redirect_uri is not registered for this client` | The URI your app sent doesn't exactly match what we registered in step 0 (including trailing slashes) — tell us the exact value and we'll fix it. |
| `Invalid client credentials` on the token exchange | You're sending a `client_secret` — don't. Public clients never send one; if your library requires a non-null value, pass an empty string or omit the field entirely, whichever it supports. |
| Browser opens but never redirects back | The redirect scheme isn't registered correctly on the device (see Android/iOS setup above) — the app has no way to catch the callback. |

---

## 4. Storing and using the tokens

- **Access token** (15 min): send as `Authorization: Bearer <accessToken>`
  on every authenticated call to `api.ndyhub.com` or any other NDY product
  that accepts NDY HUB access tokens.
- **Refresh token** (30 days): when the access token expires, `POST
  /oauth/token` with `grant_type=refresh_token` — again, **no
  `client_secret` field** for a Public client. `flutter_appauth` exposes a
  `token()` call that does this for you; most integrations just call it on
  a 401 and retry.
- **Storage**: use `flutter_secure_storage` (backed by Android Keystore /
  iOS Keychain) for both tokens. Do not use `SharedPreferences` — it's
  unencrypted on-device storage, readable by anything with root/jailbreak
  access.
- **ID token**: a standard OIDC JWT — decode it client-side (e.g. with
  `dart_jsonwebtoken`) if you just need the NDY ID/name/email claims
  without an extra network round trip.

---

## 5. Two ways to structure this — pick one

### Option A — NDY HUB is the only identity system (recommended)

Your app uses the flow above directly. No Firebase Auth, no separate user
table anywhere in your stack. This is the simplest option and the one we'd
recommend unless you have a specific reason to keep Firebase in the
picture.

### Option B — Keep Firebase for its SDK conveniences (push, analytics), NDY HUB stays the source of truth

If you want Firebase's non-auth features (Cloud Messaging, Analytics,
Crashlytics) without a second, independent user identity: your **backend**
completes the OAuth exchange above (or verifies a token your app already
obtained), confirms the NDY user, then mints a
[Firebase custom token](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
for that same NDY user ID:

```
// Your backend, using the Firebase Admin SDK — never in the Flutter app itself
admin.auth().createCustomToken(ndyUserId)
```

Your Flutter app signs into Firebase with that custom token
(`FirebaseAuth.instance.signInWithCustomToken(...)`), and now has both: a
Firebase session for the SDK conveniences, and an NDY HUB access token as
the actual, ecosystem-wide identity. Firebase never creates or stores a
password — it's a session/SDK layer sitting on top of NDY HUB, not a
second identity store.

**What to avoid, regardless of which option you pick**: each app creating
its own independent Firebase user pool with separately-created accounts.
That's the exact fragmentation "one login for the ecosystem" exists to
prevent — a user who signs up in one app should never have to sign up
again in another.

---

## 6. Syncing app activity back to NDY HUB

Logging a user in is a different problem from your app reporting *events*
back to NDY HUB — a quiz completed, a booking made, anything that should
feed NDYBITS rewards or show up in the user's activity. That's a
**separate, server-to-server mechanism**, and it does not involve the
Flutter app or the OAuth client above at all:

1. **Your backend** (not the Flutter app) gets registered as a second,
   **Confidential** OAuth client with the `ndybits:report-event` scope —
   tell us this is what you need and we'll set it up.
2. Your backend calls `POST /ndy-economy/events/report` with HTTP Basic
   auth (that client's `client_id`/`client_secret` — a real secret, held
   only on your server) and a body naming the event and which NDY user it
   happened to. NDY HUB decides the reward, if any — your backend reports
   *what happened*, never *how much to credit*.
3. Every event is idempotent (send the same `sourceEventId` twice, it's
   only ever applied once) — safe to retry on a network failure without
   double-counting.

This keeps the separation intentional: the OAuth client from §0 identifies
*a user*, on *their own device*; this second client identifies *your
backend*, reporting on their behalf. A client secret must never ship
inside the app binary — that's the whole reason Public clients exist.

---

## 7. Questions

If anything here doesn't match what you're seeing, tell us the exact
request and response (or error message) rather than a description — the
API's error messages are written to say exactly what's wrong, and having
the literal text is almost always faster than re-describing the symptom.
