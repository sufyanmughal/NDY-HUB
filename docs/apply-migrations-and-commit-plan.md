# Apply Plan — 7 pending migrations + commit plan

Everything in this document is **waiting on an action by someone with access**,
not on more engineering. Two parts: applying the migrations, and committing the
work cleanly.

---

## Part 1 — Applying the 7 migrations

All seven are **additive** and **verified drift-free** (every schema change in
`prisma/schema.prisma` has a matching migration; no schema field is missing one).

Ordering is by timestamp and is handled automatically by Prisma — do not reorder.

| # | Migration | What it adds |
|---|---|---|
| 1 | `20260917000000_add_ndyqr` | NDYQR: `NdyQrType`, `NdyQrCode`, `NdyQrScan` |
| 2 | `20260917010000_add_ndy_signature` | NDY Signature: status enum, 3 tables, `SIGNATURE` notification category |
| 3 | `20260917020000_add_trust_score` | `TrustProfile.score` |
| 4 | `20260917030000_add_context_broker` | `AI_AGENT` client type, `AiAgentConsentScope`, `AiAgentConsent` |
| 5 | `20260917040000_add_ndyqr_service_owner` | `NdyQrCode.oauthClientId`, `ownerId` → nullable, single-owner CHECK |
| 6 | `20260917050000_add_signature_consent_text` | `Signature.consentText` |
| 7 | `20260917060000_add_login_failed_event` | `LOGIN_FAILED` security event type |

### The only one that touches an existing column

Migration 5 drops `NOT NULL` from `NdyQrCode.ownerId` (widening, not narrowing —
existing rows keep their owner) and adds a CHECK constraint asserting exactly one
owner. It will **fail loudly** if any existing row somehow has neither owner,
which is the intended behavior rather than a silent bypass.

### Apply to STAGING first

```bash
# from apps/api, with STAGING DATABASE_URL + DIRECT_URL in the environment
npx prisma migrate deploy
npx prisma migrate status      # expect: "Database schema is up to date!"
```

Then prove the flows (see Part 3) before touching production.

### Then production

```bash
# on the box that can reach the production DB
docker exec ndy-hub-api npx prisma migrate deploy
docker exec ndy-hub-api npx prisma migrate status
```

`migrate deploy` is non-interactive and never resets data — it applies pending
migrations only.

### Note on migration 4

Its `AiAgentConsentScope` enum was **edited in place** (the placeholder
calendar/contacts/tasks/notes/economy values were replaced with the NDYMAIL-AI
set) because it has never been applied anywhere. **If it has been applied to any
environment**, do not run it as-is — tell me and I'll add a follow-up migration
instead.

---

## Part 2 — Commit plan

The blocker: several files I edited **already contained other people's
uncommitted changes** (`app.module.ts`, `permissions.ts`, `scopes.ts`,
`nav-items.ts`, `api.ts`, `package.json` ×2). Committing "my" changes to those
files would commit their work too, which the client explicitly said not to do.

**Recommended sequence:**

1. **Someone commits or stashes the pre-existing work first.** After that, every
   commit below is genuinely clean.
2. Then commit per feature. Exact paths:

**Commit 1 — NDYQR**
```
apps/api/src/ndyqr/
apps/api/prisma/migrations/20260917000000_add_ndyqr/
apps/api/prisma/migrations/20260917040000_add_ndyqr_service_owner/
apps/web/src/lib/ndyqr-render.ts
apps/web/src/app/(dashboard)/qr-codes/
apps/api/src/app.module.ts          # ← shared file
apps/api/src/common/permissions.ts  # ← shared file
apps/api/src/oauth/scopes.ts        # ← shared file
apps/web/src/lib/{api,nav-items,permissions}.ts   # ← shared files
apps/api/package.json apps/web/package.json package-lock.json
docs/ndyqr.md
```

**Commit 2 — NDY Signature**
```
apps/api/src/signature/
apps/api/prisma/migrations/20260917010000_add_ndy_signature/
apps/api/prisma/migrations/20260917050000_add_signature_consent_text/
apps/web/src/app/sign/
apps/web/src/app/(dashboard)/signatures/
```

**Commit 3 — Trust Score + failed-login capture**
```
apps/api/src/trust/
apps/api/prisma/migrations/20260917020000_add_trust_score/
apps/api/prisma/migrations/20260917060000_add_login_failed_event/
apps/api/src/auth/auth.service.ts   # ← shared file (also has others' changes)
```

**Commit 4 — Context Broker**
```
apps/api/src/context-broker/
apps/api/prisma/migrations/20260917030000_add_context_broker/
apps/web/src/app/(dashboard)/ai-agents/
```

**Commit 5 — Docs**
```
docs/ndy-admin-v1-design.md
docs/draft-message-to-teun-*.md
```

I have deliberately **not** committed anything, because steps 1 and the shared
files make a wrong commit hard to unpick from a shared history.

---

## Part 3 — Verify after applying (staging)

There is no local database reachable from the development environment, so none of
these have been exercised end-to-end yet. In order:

1. **NDYQR** — `GET /q/{slug}/image.png` returns a PNG that decodes to
   `{API_URL}/q/{slug}`; create → retarget → analytics round trip.
2. **Trust Score** — `GET /trust/me` returns `{ tier, score }`; a brand-new clean
   account reads **exactly 50** (the neutral baseline), not 0 and not 55.
3. **Signature** — create → sign → verify via the public
   `GET /signature/verify/:id`; confirm `consentText` is stored.
4. **Context Broker** — grant an agent scope, then confirm an AI-originated
   action with a missing scope is **refused** (fails closed).
5. **Login failed capture** — one wrong password writes one `LOGIN_FAILED`
   security event, visible in that account's security history.
