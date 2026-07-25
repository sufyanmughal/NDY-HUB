# NDY HUB

One Identity. One Passport. One Ecosystem.

Local dev build of NDY HUB. See the proposal doc for the full architecture and
milestone sequence — this repo is those milestones turned into actual code,
not a rewrite of the plan.

## Layout

```
ndy-hub/
├── apps/
│   ├── api/    NestJS + TypeScript — the Core API, the only thing that writes identity data
│   └── web/    Next.js + TypeScript + Tailwind — the NDY HUB dashboard
├── docker-compose.yml   Local Postgres + Redis
└── package.json         npm workspaces root
```

## What's actually built

Every module below is wired to the real API — not mock data — and has been
verified end to end against a live local Postgres database: booted the app,
hit the real endpoints, confirmed the actual behavior (not just that it
builds and lints clean, which catches far less than it feels like it should).

**Identity core** — registration, login, NDY ID generation (collision-safe,
excludes ambiguous characters), profile editing, password change.

**QR / deep-link login** — the full handshake: create a single-use 90-second
login request, approve/deny it from an authenticated NDYAPPS session
(`JwtAuthGuard`), exchange an approval for a real session, all pushed live
over a WebSocket instead of polling. `/login` is a real working page — see
"Testing the login flow" below. `NDYAPPS-INTEGRATION.md` is the frozen API
contract for whoever builds NDYAPPS.

**Sessions & Security** — JWT access tokens (15 min) + rotating opaque
refresh tokens (30 days, SHA-256 hashed at rest, never stored plaintext).
`/security` lists every active session with device/IP/sign-in time, lets you
revoke one or all of them. Revoking stops a session from refreshing; an
already-issued access token still runs out its own clock — a deliberate,
documented tradeoff of stateless JWTs, not an oversight.

**Membership (M4)** — six tiers, monthly/annual billing, subscribe/cancel,
full history. Real Stripe Checkout when `STRIPE_SECRET_KEY` is configured;
direct activation otherwise (logged clearly as a dev fallback, not silent).
Stripe webhook handler is signature-verified and structurally correct but
genuinely untested against a live Stripe account — flagged, not overclaimed.

**CRYNDY + NDYBITS (M5)** — full purchase lifecycle (`PAYMENT_PENDING`
through `DISTRIBUTED_ON_CHAIN`/`CANCELLED`/`REFUNDED`), a status breakdown so
pending/locked CRYNDY can never read as spendable, an HMAC-signed idempotent
webhook intake for the presale site, and an append-only NDYBITS ledger.

**Transactions** — unified history across memberships and CRYNDY purchases,
newest first.

**Documents** — membership confirmations and CRYNDY certificates, generated
on demand from real data rather than pretending a file bucket exists (no S3
credentials in this environment — see the comment in `documents.service.ts`
for exactly what a real object-storage swap would replace).

**Admin (M6)** — user search, role management, suspend/unsuspend (which
actually revokes sessions and blocks login, not just a database flag), and
an audit log recording every admin action with before/after values. Lives at
`/admin`, outside the regular sidebar — no normal user should see that link.
See "Bootstrapping the first admin" below.

**Dashboard shell** — full nav from the mockup. Dashboard overview and
Passport page show real NDY ID, Passport, membership, CRYNDY, and NDYBITS
data. Connected Platforms and the platform list itself are still mock — no
platforms backend exists yet.

**Known gap, on purpose:** sessions live in `localStorage`, not an httpOnly
cookie (see `src/lib/auth-client.ts`). Fine for local dev, not the final
security posture — swap this before any real traffic touches it.

## Running it locally

Requires Node 20+, npm, and Docker Desktop running (for Postgres/Redis).

```bash
# from the repo root
npm install
npm run db:up                 # starts Postgres + Redis
npm run --workspace apps/api exec -- prisma migrate dev --name init
npm run dev:api                # http://localhost:3000
npm run dev:web                # http://localhost:3001
```

`apps/api/.env` is already set up to match `docker-compose.yml` — no edits
needed for local dev. `.env.example` files (in both `apps/api` and
`apps/web`) document every variable if you're pointing at something else.

If a rebuild ever hits `EPERM ... rename query_engine-windows.dll.node` or
similar on Windows: stop the running dev server first (it holds a lock on
the Prisma engine DLL), then re-run `prisma generate`/`migrate`.

## Testing the QR login flow

Open **http://localhost:3001/login**. There's no NDYAPPS build to scan the
code with yet, so approve it one of two ways:

**The easy way:** click "Skip NDYAPPS — approve as test user (dev only)"
under the QR code. It does exactly what the curl steps below do, from the
page itself. Only ever appears outside a production build.

**The manual way**, if you want to see the actual handshake:
```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"something-long-enough","fullName":"Your Name"}'
# -> { "accessToken": "...", "refreshToken": "...", "expiresIn": "15m" }

# Open /login in a browser, grab the token from the network tab's
# POST /auth/login-request response, then:
curl -s -X POST http://localhost:3000/auth/login-request/<token>/approve \
  -H "Authorization: Bearer <accessToken from above>"
```

Either way, the tab flips to "You're logged in" within a second over the
WebSocket and lands on a real dashboard.

## Bootstrapping the first admin

Nothing in the product can create the first admin — that's deliberate, an
admin-creation button would just move the privilege-escalation problem
somewhere else. Do it once, directly:

```bash
cd apps/api
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.update({ where: { email: 'you@example.com' }, data: { role: 'ADMIN' } })
  .then(u => console.log('promoted:', u.ndyId, u.role))
  .finally(() => prisma.\$disconnect());
"
```

Every admin action after that (role changes, suspensions) goes through
`/admin` and is written to the audit log — including changes made to other
admins.

## Next up

1. Move sessions from `localStorage` to an httpOnly cookie set by the API —
   the real security posture, not the dev placeholder.
2. Real object storage (S3/R2) for Documents, once there's a bucket to point
   at — the generation logic underneath won't need to change.
3. A Connected Platforms backend — `/platforms` is still the last page on
   mock data.
4. Whatever NDJOYIT decides on the crypto payment rail for the presale
   (flagged since the very first proposal doc as a legal/business decision,
   not an engineering one).
