# NDY HUB

One Identity. One Passport. One Ecosystem.

This is the local dev scaffold for NDY HUB, started against milestone 1 (identity
core) and milestone 2 (dashboard shell + Passport) from the build plan. See the
proposal doc for the full architecture and milestone sequence — this repo is the
first of those milestones turned into actual code, not a rewrite of the plan.

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

**API (`apps/api`)**
- Prisma schema: `User`, `AuthIdentity` (so Google/Apple/NDYAPPS/password all map to
  one account instead of creating duplicates), `LoginRequest` (the QR/deep-link
  handshake), `Session`.
- NDY ID generator — collision-safe, retried on unique-constraint conflict, excludes
  ambiguous characters (`0/O`, `1/I/L`).
- `POST /auth/register`, `POST /auth/login` — password auth with bcrypt.
- `POST /auth/login-request`, `GET /auth/login-request/:token`,
  `POST /auth/login-request/:token/approve`, `.../deny` — the single-use, 90-second
  token lifecycle behind both the desktop QR flow and the mobile deep link.
- `GET /passport/:ndyId` — the public-safe Passport view (no email, no password hash).

**Web (`apps/web`)**
- Dashboard shell with the full nav from the mockup: Dashboard, NDY Passport,
  Memberships, CRYNDY, NDYBITS, Connected Platforms, Transactions, Documents,
  Security, Settings, Support.
- Dashboard overview and NDY Passport pages built against mock data, matching the
  layout in the client's reference mockup.
- Everything else is a labeled placeholder stating which milestone fills it in —
  not a broken link.

**Not built yet, on purpose:** session issuance (JWT/OIDC tokens), the WebSocket
push for live QR approval, the NDYAPPS-session guard on the approve endpoint, and
any real data fetching in the dashboard. Those are the rest of milestone 1 and 3 —
this commit is the foundation they get built on.

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
for local dev. `apps/api/.env.example` documents every variable if you're pointing
at something else.

Note: this environment doesn't have Docker installed, so the migration above
hasn't actually been run against a live database yet — the schema and generated
Prisma client are verified to compile, but `prisma migrate dev` still needs to run
once against a real Postgres instance to create the tables.

## Next up (per the build sequence)

1. Finish milestone 1 — session issuance, the WebSocket channel for live QR
   approval, and the NDYAPPS-session guard on `/approve`.
2. Freeze the login API contract so the NDYAPPS developer can start building
   against it (milestone 3).
3. Membership + Stripe billing (milestone 4).
