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

**Web (`apps/web`) — milestone 2 (dashboard shell) + a working slice of milestone 3**
- Dashboard shell with the full nav from the mockup: Dashboard, NDY Passport,
  Memberships, CRYNDY, NDYBITS, Connected Platforms, Transactions, Documents,
  Security, Settings, Support.
- Dashboard overview and NDY Passport pages built against mock data, matching the
  layout in the client's reference mockup. Everything else still unbuilt is a
  labeled placeholder stating which milestone fills it in — not a broken link.
- **`/login`** — a real, working QR login page. Generates the login request against
  the API, renders the QR code, subscribes to the WebSocket for live status, falls
  back to polling if the socket doesn't connect, and exchanges an approval for a
  session the moment it lands. Nothing about it is mocked; it just doesn't have
  NDYAPPS on the other end yet, so approving it means calling the API directly
  (see "Testing the login flow" below).

**Not built yet, on purpose:** the dashboard doesn't consume the session `/login`
produces — there's no cookie, no auth-gated routing, no "logged in as" state yet.
That's the next slice: wiring the session into the dashboard shell itself.

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
WebSocket, without any manual refresh.

## Next up (per the build sequence)

1. Wire the session `/login` issues into the dashboard shell — cookie storage,
   auth-gated routing, a real "logged in as" state instead of mock data.
2. Freeze the login API contract so the NDYAPPS developer can start building
   against it (milestone 3) — the endpoints above are already stable enough to
   hand off.
3. Membership + Stripe billing (milestone 4).
4. CRYNDY + NDYBITS pipeline (milestone 5).
