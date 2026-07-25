# NDY HUB

One Identity. One Passport. One Ecosystem.

This is the local dev scaffold for NDY HUB. See the proposal doc for the full
architecture and milestone sequence — this repo is those milestones turned into
actual code, not a rewrite of the plan.

## Layout

```
ndy-hub/
├── apps/
│   ├── api/    NestJS + TypeScript — the Core API, the only thing that writes identity data
│   └── web/    Next.js + TypeScript + Tailwind — the NDY HUB dashboard
├── docker-compose.yml   Local Postgres + Redis
└── package.json         npm workspaces root
```

## What's actually built right now

**API (`apps/api`) — milestone 1 (identity core), complete**
- Prisma schema: `User`, `AuthIdentity` (so Google/Apple/NDYAPPS/password all map to
  one account instead of creating duplicates), `LoginRequest` (the QR/deep-link
  handshake), `Session`.
- NDY ID generator — collision-safe, retried on unique-constraint conflict, excludes
  ambiguous characters (`0/O`, `1/I/L`).
- `POST /auth/register`, `POST /auth/login` — password auth with bcrypt, both issue
  a real access/refresh session on success.
- `POST /auth/refresh`, `POST /auth/logout` — refresh tokens rotate on every use
  (the old one is revoked the instant a new pair is issued) and are stored as a
  SHA-256 hash, never in plaintext.
- The full QR / deep-link handshake:
  - `POST /auth/login-request` — creates a single-use, 90-second token
  - `GET /auth/login-request/:token` — status poll (fallback path)
  - `POST /auth/login-request/:token/approve` / `.../deny` — **requires a valid
    NDYAPPS bearer token** (`JwtAuthGuard`); this is the endpoint the NDYAPPS
    developer's build calls
  - `POST /auth/login-request/:token/exchange` — the desktop browser redeems an
    APPROVED request for a real session (OAuth2 authorization-code pattern)
- A WebSocket gateway (`login-request:subscribe` / `login-request:status`) pushes
  approval/denial live instead of making the desktop poll.
- `GET /passport/:ndyId` — the public-safe Passport view (no email, no password hash).
- Approving a login request now actually sets `User.ndyappsConnected` — it didn't
  before, despite being in the schema and the Passport response.

**API (`apps/api`) — milestone 5 (CRYNDY + NDYBITS pipeline), complete**
- Prisma schema: `CryndyPurchase` (full lifecycle — `PAYMENT_PENDING` through
  `DISTRIBUTED_ON_CHAIN`/`CANCELLED`/`REFUNDED`) and `NdybitsLedgerEntry`.
- `GET /cryndy/me` (guarded) — purchase history plus a full per-status breakdown,
  so pending/locked/allocated CRYNDY can never be mistaken for spendable. Only
  `AVAILABLE` and `DISTRIBUTED_ON_CHAIN` count toward the balance.
- `POST /webhooks/cryndy/purchase` — the presale site's intake endpoint.
  HMAC-SHA256 signed over the raw request body (`CRYNDY_WEBHOOK_SECRET`,
  timing-safe comparison), idempotent on `providerTransactionId` (a replay
  returns `200 { duplicate: true }`, not an error).
- `GET /ndybits/me` (guarded) — balance (summed from the ledger on read, not a
  cached counter — see the comment in `ndybits.service.ts` for why) plus recent
  entries.

**Web (`apps/web`) — milestone 2 (dashboard shell) + working slices of 3 and 5**
- Dashboard shell with the full nav from the mockup: Dashboard, NDY Passport,
  Memberships, CRYNDY, NDYBITS, Connected Platforms, Transactions, Documents,
  Security, Settings, Support.
- **`/cryndy`** and **`/ndybits`** — full pages (status breakdown, purchase
  history, ledger) built against mock data shaped exactly like `GET /cryndy/me`
  and `GET /ndybits/me`'s real response bodies, so wiring in a live fetch later
  is a small, mechanical change. The Dashboard overview and Passport page pull
  the same mock exports — one source of numbers, not three independently
  hardcoded ones.
- **`/login`** — a real, working QR login page. Generates the login request against
  the API, renders the QR code, subscribes to the WebSocket for live status, falls
  back to polling if the socket doesn't connect, and exchanges an approval for a
  session the moment it lands.
- **The session is real end to end now.** `AuthProvider` (`src/lib/auth-context.tsx`)
  holds it, `DashboardGate` (`src/app/(dashboard)/layout.tsx`) redirects to `/login`
  if there isn't one and bounces already-logged-in visitors away from `/login`
  itself, and the access token auto-refreshes on load if it's gone stale. The
  Dashboard overview, Passport page, and Topbar all show your real NDY ID and
  Passport (fetched from `GET /passport/:ndyId`) instead of mock data — only
  Membership is still mock (M4 hasn't landed), and it's commented as such.
- Everything not yet built is a labeled placeholder stating which milestone fills
  it in — not a broken link.
- **Known gap, on purpose:** sessions live in `localStorage`, not an httpOnly
  cookie (see the comment in `src/lib/auth-client.ts`). Fine for local dev, not
  the final security posture the proposal commits to — swap this before any real
  traffic touches it.

## Running it locally

Requires Node 20+, npm, and Docker (for Postgres/Redis).

```bash
# from the repo root
npm install
npm run db:up                 # starts Postgres + Redis
npm run --workspace apps/api exec -- prisma migrate dev --name init
npm run dev:api                # http://localhost:3000
npm run dev:web                # http://localhost:3001
```

`apps/api/.env` is already set up to match `docker-compose.yml` — no edits needed
for local dev. `.env.example` files (in both `apps/api` and `apps/web`) document
every variable if you're pointing at something else.

Note: this environment doesn't have Docker installed, so the migration above
hasn't actually been run against a live database yet — the schema and generated
Prisma client are verified to compile, and both apps build clean, but
`prisma migrate dev` still needs to run once against a real Postgres instance to
create the tables before any of this is live-testable end to end.

## Testing the QR login flow without NDYAPPS

There's no NDYAPPS build to scan the code with yet, so approve it by hand:

```bash
# 1. Register a user (or reuse one) and grab its access token
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teun@example.com","password":"correct-horse-battery","fullName":"Teun Rietdijk"}'
# -> { "accessToken": "...", "refreshToken": "...", "expiresIn": "15m" }

# 2. Open http://localhost:3001/login in a browser, copy the token shown in
#    devtools (or watch the network tab for POST /auth/login-request's response)

# 3. Approve it as that user
curl -s -X POST http://localhost:3000/auth/login-request/<token>/approve \
  -H "Authorization: Bearer <accessToken from step 1>"
```

The browser tab should flip to "You're logged in" within a second or two over the
WebSocket, without any manual refresh, and land you on a real dashboard showing
that account's actual NDY ID and Passport.

The login API contract for the NDYAPPS developer is frozen and documented in
[`NDYAPPS-INTEGRATION.md`](./NDYAPPS-INTEGRATION.md) — everything they need to
build the approve/deny screen against, independent of anything else in this repo.

## Next up (per the build sequence)

1. Move sessions from `localStorage` to an httpOnly cookie set by the API —
   the real security posture, not the dev placeholder.
2. Membership + Stripe billing (milestone 4) — the one piece of the dashboard
   still on hardcoded mock data.
3. Wire `/cryndy` and `/ndybits` to their real endpoints instead of mock data
   now that a session exists to authenticate the fetch with.
4. CRYNDY + NDYBITS pipeline (milestone 5).
