# NDY HUB — Flutter / Mobile OAuth Integration

For Flutter apps (Android/iOS) authenticating against NDY HUB instead of
Firebase Auth or a per-app backend. Same underlying identity as every web
integration (see `docs/WEBSITE-INTEGRATION.md`) — one account, one
password, shared across every NDY product — but registered as a **public
client** instead of a confidential one, since a secret baked into an app
binary isn't a secret (RFC 8252, OAuth 2.0 for Native Apps).

## 1. Get registered as a Public OAuth client

An admin with `MANAGE_OAUTH_CLIENTS` registers your app at
`/admin` → **Connected Apps & Websites** → **Register a site**:

- **Client type**: Public
- **Redirect URI**: a custom scheme (`ndjoyit://oauth-callback`) or an
  Android App Link / iOS Universal Link (`https://ndjoyit.com/oauth-callback`)
- **Scopes**: whichever of `openid profile email membership cryndy` your
  app actually needs

You'll get back a `client_id` only — **no `client_secret`**. That's
correct, not a bug: public clients never receive one.

## 2. Add the OAuth flow in Flutter

Use [`flutter_appauth`](https://pub.dev/packages/flutter_appauth) — the
Flutter wrapper around Google's own AppAuth libraries, purpose-built for
exactly this (RFC 8252 native-app OAuth with PKCE). It handles PKCE
generation, the system browser/Custom Tabs launch, and the callback —
you don't hand-roll any of it.

```dart
final appAuth = FlutterAppAuth();

final result = await appAuth.authorizeAndExchangeCode(
  AuthorizationTokenRequest(
    'YOUR_CLIENT_ID',        // from step 1 — no secret needed
    'ndjoyit://oauth-callback', // your registered redirect URI
    serviceConfiguration: const AuthorizationServiceConfiguration(
      authorizationEndpoint: 'https://api.ndyhub.com/oauth/authorize',
      tokenEndpoint: 'https://api.ndyhub.com/oauth/token',
    ),
    scopes: ['openid', 'profile', 'email'],
  ),
);

// result.accessToken / result.refreshToken / result.idToken
```

`flutter_appauth` generates the PKCE `code_verifier`/`code_challenge`
itself — NDY HUB requires `code_challenge_method=S256` (plain is rejected)
and, for Public clients specifically, **requires** PKCE — an authorize
request with no `code_challenge` is rejected outright for a Public client,
by design (there's no client_secret to fall back on).

### Android setup

Register the redirect scheme in `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        manifestPlaceholders += [
            'appAuthRedirectScheme': 'ndjoyit'
        ]
    }
}
```

### iOS setup

Add the scheme to `ios/Runner/Info.plist`'s `CFBundleURLTypes` — see
`flutter_appauth`'s own README for the exact block; it's a standard
custom-URL-scheme registration, nothing NDY HUB-specific.

## 3. Using the tokens

- `accessToken` (15 min): send as `Authorization: Bearer <accessToken>` on
  every authenticated call to `api.ndyhub.com` or any other NDY product
  that accepts NDY HUB access tokens.
- `refreshToken` (30 days): call `POST /oauth/token` with
  `grant_type=refresh_token` when the access token expires — **no
  `client_secret` field for a Public client**, same PKCE-authenticated
  identity carries through.
- `idToken`: standard OIDC ID token — decode client-side if you just need
  the NDY ID/claims without another network call.

## 4. Reporting app activity back to NDY HUB

Authenticating a user is a separate concern from your app reporting events
(quiz completed, booking made, etc.) back to NDY HUB for NDYBITS rewards or
sync. That's a **different, server-to-server** mechanism — your app's own
backend (not the Flutter app directly, and never with the OAuth client
credentials above) calls `POST /ndy-economy/events/report` using a
*separate* Confidential OAuth client registered with the
`ndybits:report-event` scope. See `docs/ndy-economy-implementation-plan.md`
and `EconomyClientGuard` for that flow — client secrets belong on a
backend, never inside the app binary, which is exactly why this is a
distinct registration from the Public client used for user login above.

## What this replaces

If your app previously used Firebase Auth (or its own backend) to create
and store user accounts: stop creating accounts there. Every user signs up
and logs in through NDY HUB once; your app just requests an access token
for whichever NDY user is signed in. If you still want Firebase's SDK
conveniences (push notifications, analytics) without a second identity
store, mint a
[Firebase custom token](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
for the NDY user ID from your backend after the OAuth exchange above —
Firebase becomes a session/SDK layer, not a second source of truth for who
the user is.
