# NDYHUB — Architecture & Build Plan for the 7 Remaining Items

**Written:** 2026-09-16. Grounds every item in this codebase's real,
already-proven conventions (propose→approve, `forwardRef()` DI cycles,
denormalized-actor-snapshot audit rows, owner-scoped `getOwned()` 404
pattern, additive-only migrations) so nothing here invents a new pattern
where an existing one already fits. Each section is independently
buildable and independently shippable — none blocks another except where
explicitly stated.

---

## 1. NDY Signature (Phase 8, second half)

### What it is
A way for an NDY-identified user to cryptographically/procedurally sign a
document or statement, producing a durable, independently-verifiable
artifact — not an internal audit log entry, a piece of evidence that can
outlive this system and be checked by a third party.

### Why it's its own domain, not an Action Engine action
The Action Engine's `ActionLogEntry` is an internal audit trail. A
signature needs to be exportable as proof ("this NDY user signed this
document on this date") independent of NDYHUB's own database being
trusted. Different durability contract → different domain, per
`docs/phase8-signature-trust-design.md` §2 (already written, still valid).

### Data model (additive, 3 new tables)
```prisma
enum SignatureRequestStatus { PENDING SIGNED DECLINED EXPIRED REVOKED }

model SignatureRequest {
  id              String                 @id @default(uuid())
  title           String
  contentHash     String                 // sha256 of the document/statement
  contentRef      String?                // DriveFile id or external URL — never raw bytes here
  createdByUserId String
  createdByNdyId  String
  status          SignatureRequestStatus @default(PENDING)
  expiresAt       DateTime?
  createdAt       DateTime               @default(now())
  signers         SignatureRequestSigner[]
  signatures      Signature[]
}

model SignatureRequestSigner {
  id                 String           @id @default(uuid())
  signatureRequestId String
  signatureRequest   SignatureRequest @relation(fields: [signatureRequestId], references: [id], onDelete: Cascade)
  userId             String?          // null until resolved if invited by email
  invitedEmail       String?
  tokenHash          String           @unique   // same single-use-token shape as WorkspaceInvite
  signedAt           DateTime?
  expiresAt          DateTime
  @@index([signatureRequestId])
}

model Signature {
  id                 String           @id @default(uuid())
  signatureRequestId String
  signatureRequest   SignatureRequest @relation(fields: [signatureRequestId], references: [id], onDelete: Cascade)
  signerUserId       String
  signerNdyId        String           // denormalized snapshot, same reasoning as AuditLogEntry
  contentHash        String           // copied at sign time — proves what was actually signed
  ip                 String?
  userAgent          String?
  signedAt           DateTime         @default(now())
  @@index([signatureRequestId])
  @@index([signerUserId])
}
```

### Services & routes
- `apps/api/src/signature/signature.module.ts` (new module)
- `SignatureService.create()` — mint per-signer tokens, call
  `NotificationService.notify()` (category `ACTION_APPROVAL` or a new
  `SIGNATURE` category) per invited signer.
- `SignatureService.sign(token, ip, userAgent)` — validate token not
  expired/used, write `Signature`, mark signer resolved, flip
  `SignatureRequest.status` to `SIGNED` once every signer row is resolved.
- `SignatureService.decline()` / `revoke()`.
- `POST /signature` (authenticated, creates a request)
- `POST /signature/:token/sign` (token-authenticated, not JWT — same shape
  as `WorkspaceInviteService.accept()`)
- `GET /signature/verify/:signatureId` — **public**, unauthenticated,
  returns only `contentHash` + `signerNdyId` + `signedAt`, mirroring the
  existing public `GET /passport/:ndyId` pattern. This is the actual
  "verifiable artifact" surface — a third party hits this with no auth to
  confirm a signature is real.

### Build order (5 steps)
1. Migration (additive, 3 tables) → apply to prod via
   `docker exec ndy-hub-api npx prisma migrate deploy`.
2. `SignatureModule` + `SignatureService` (business logic only, unit-testable
   without a DB via mocked Prisma — same pattern as existing service tests).
3. `SignatureController` (the 3 routes above) + DTOs
   (`class-validator`, same convention as every other controller).
4. Wire `NotificationService` calls at create/sign/decline.
5. Minimal web UI: a "Sign" page at `/sign/[token]` (public, outside the
   dashboard shell) showing title + a link to `contentRef` + a Sign/Decline
   button; a "My Signature Requests" list under NDYSPACE or a new nav item.

### Decisions still needed from Teun before step 1
These are the exact open questions from §5 of the existing design doc —
unresolved, and this plan doesn't silently answer them:
1. Is this legally-binding e-signature (eIDAS/ESIGN Act consent-language
   and audit-trail requirements) or an internal attestation with no legal
   claim? This changes what has to be captured at sign time (e.g. explicit
   "I intend to sign" consent text, IP + device fingerprint retention
   policy) — build the schema above either way, but the UI/consent flow
   differs materially.
2. Does signing route through the Action Engine as a registered
   `signature.document.sign` action (gets approval/audit machinery for
   free) or stay fully separate as drafted? Recommendation: separate,
   per the design doc's own reasoning — flag for confirmation, don't
   silently decide.

**Effort estimate:** ~3-4 focused days once the two decisions above land
(schema + services + controller + minimal UI + tests + deploy).

---

## 2. Trust numeric score (Phase 8 remainder)

### What exists today vs. what's missing
`TrustProfile.tier` (enum, `UNVERIFIED→BASIC→VERIFIED→TRUSTED`) is live,
computed by `TrustService.computeTier()` from `verificationLevel` +
trust-relevant `PassportClaim` rows. The score field was deliberately
**not** added — per the design doc §5.4, shipping a wrong formula silently
is worse than shipping no score. This is the one item where the schema
already anticipated the field (`docs/phase8-signature-trust-design.md`
§3's draft has `score Int @default(0)`) — the missing piece is a formula,
not engineering.

### Proposed approach
1. **Get the formula from Teun before touching code.** Concretely ask:
   what inputs move the score, and by how much? Candidate inputs already
   available with zero new work: `verificationLevel`, count/type of
   `PassportClaim` rows, account age (`User.createdAt`), presence of a
   `BusinessWorkspaceRequest` approval, zero vs. nonzero `SecurityEvent`
   flags. A reasonable starting proposal to put in front of him (not to
   silently ship):

   | Signal | Points |
   |---|---|
   | Email verified (LEVEL_1) | 10 |
   | Phone verified (LEVEL_2 / BASIC tier) | 25 |
   | Identity document verified (LEVEL_3 / VERIFIED tier) | 40 |
   | Business workspace verified | +15 |
   | Account age > 90 days with zero security flags | +10 |
   | Cap | 100 |

2. **Schema**: add `score Int @default(0)` to the existing `TrustProfile`
   model — one-line additive migration, no new table.
3. **Service**: extend `TrustService.computeTier()` (already the single
   recompute path, called after phone verification and identity-verification
   approval — `apps/api/src/auth/sms-2fa.service.ts` and
   `apps/api/src/identity-verification/identity-verification.service.ts`)
   to also set `score` in the same write. No new call sites needed — the
   recompute triggers already cover every event that should move the score.
4. **Expose**: add `score` to the existing `GET /trust/me` response — no
   new route.

### Build order
1. Confirm formula with Teun (blocking — do not build against a guess).
2. One-line schema migration.
3. Extend `TrustService.computeTier()` → `computeScore()` alongside it.
4. Add `score` to the DTO returned by `TrustController`.
5. Deploy, verify via `curl` with a real bearer token that score moves
   correctly across a LEVEL_2→LEVEL_3 transition on a test account.

**Effort estimate:** ~half a day once the formula is confirmed — this is
the smallest of the 7 items by a wide margin.

---

## 3. NDY Admin (standalone product)

### Architecture (as already agreed with Teun)
A **separate application** — not a module inside `ndy-hub`'s own
`apps/web`/`apps/api` — that authenticates against NDYHUB via OAuth2/OIDC
exactly like NDYMAIL does today (NDYMAIL is the proven reference
implementation: authorization-code + PKCE flow, `GET /oauth/userinfo`
filtered strictly to granted scope, no direct DB access). NDY Admin gets
no special backdoor into NDYHUB's database — it is a relying party like
any other product, just with elevated scopes granted to its `OAuthClient`
registration.

### Why standalone, not folded into the existing `/admin` section
NDYHUB's `apps/web` already has an Admin Center (`nav-items.ts` — "Admin
Center / Platform Management", `anyOfPermissions`-gated). NDY Admin as
described by Teun is broader: cross-team coordination surface (the tool
Hassan/Sufyan/Abdul would use), not just NDYHUB's own platform settings.
Keeping it a separate product avoids conflating "manage NDYHUB itself"
(stays in `apps/web/admin`) with "manage the whole NDY ecosystem across
products" (the new standalone NDY Admin) — same reasoning that kept
NDYMAIL separate rather than bolting mail into NDYHUB's web app.

### What it needs from NDYHUB (mostly already exists)
- New `OAuthClient` registration for `ndy-admin` with an elevated scope
  set — reuse `apps/api/src/oauth/scopes.ts`'s existing convention ("add
  scopes as real clients need them"); likely needs `admin:read`,
  `admin:users`, `admin:audit` as new coarse scopes.
- `GET /founder/*` endpoints (`apps/api/src/founder/founder.service.ts`)
  already described as intended to grow into an "economic command
  center" — NDY Admin is a natural consumer of these, not a reason to
  duplicate them.
- `AuditLogEntry` read access (already a real, populated model) for a
  cross-ecosystem activity view.
- `ActionApproval` list (`GET /action-engine/approvals`) for a central
  approvals inbox spanning all workspaces an admin has visibility into.

### Build order
1. **Design doc first** (this codebase's own standing discipline — every
   phase shipped a design doc before code). Define NDY Admin's actual
   feature list precisely: user management, cross-workspace approvals
   inbox, audit log viewer, economy overview, what else. Get Teun's
   sign-off — this is exactly the "schedule the Hassan+Sufyan+Abdul
   architecture sync" Teun already asked for before this starts.
2. Register the `ndy-admin` OAuth client + new scopes in NDYHUB (small,
   additive — no schema change, just seed data + scopes.ts entries).
3. Scaffold the new repo/app (Next.js, same stack as NDYMAIL for
   consistency) with the OAuth login flow ported from NDYMAIL's
   `oidc-client.ts`/`session.ts` (proven code, not a rewrite).
4. Build feature-by-feature against the read-only NDYHUB endpoints that
   already exist (`/founder/*`, `/action-engine/approvals`, audit log) —
   this order means NDY Admin has real, working data from day one instead
   of scaffolding against mocks.
5. Only after the read-only surface works: any write-capable admin actions
   should go through the **Action Engine** as registered actions
   (`admin.user.suspend`, etc.) rather than new ad hoc endpoints — reuses
   the approval/audit machinery for free, and keeps NDYHUB's own API
   surface from growing a parallel admin-only write path.

**Effort estimate:** design doc + sync call first (schedule this before
any code); then ~2-3 weeks for a v1 read-mostly admin surface once scope
is confirmed, given how much of the backend already exists to consume.

---

## 4. Context Broker / AI external-service permission layer

### What it is (per prior agreement with Teun)
A gate between any AI/agent-driven action and the products it touches —
so an AI assistant acting on a user's behalf can only reach the specific
scopes/resources the user has explicitly granted, auditable the same way
a human's OAuth grant is. This is the mechanism that makes "let an AI
draft a calendar event" safe rather than "give the AI a raw API key."

### Why this reuses OAuth scopes + Action Engine, not a new auth system
NDYHUB already has the two halves this needs:
- **Scoped grants**: `OAuthGrant`/`OAuthRefreshToken` + `scopes.ts`'s
  scope vocabulary already express "this client may access exactly these
  resources for this user."
- **Approval-gated execution with audit**: the Action Engine's
  propose→authorize→validate→execute→log pipeline already does "an
  external actor requests something be done on a user's behalf, checked
  against real permissions, logged either way."

The Context Broker is best understood as a **thin policy layer in front
of the Action Engine**, not a new pillar: an AI agent authenticates as an
OAuth client (same as any product), its requests get tagged with an
`origin: "ai-agent"` marker already supported by `ActionLogEntry`'s
`origin Json` field, and a new policy check runs before `Authorize`:
"does this user's AI-consent record permit this agent to invoke this
actionKey."

### Data model (additive)
```prisma
enum AiAgentConsentScope { CALENDAR CONTACTS TASKS NOTES ECONOMY_READ }

model AiAgentConsent {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  oauthClientId String  // which registered AI agent/client this grant is for
  scopes       AiAgentConsentScope[]
  grantedAt    DateTime @default(now())
  revokedAt    DateTime?
  @@unique([userId, oauthClientId])
}
```

### Services
- `ContextBrokerService.assertConsent(userId, oauthClientId, actionKey)` —
  called from `ActionEngineService`'s existing Authorize step, additively:
  if the requesting `OAuthClient.type` is `AI_AGENT` (a new
  `OAuthClientType` enum value — additive), also check
  `AiAgentConsent`; if not an AI agent, behavior is unchanged. This means
  the Context Broker adds a check, it doesn't fork the pipeline.
- A user-facing consent screen (web) — "Agent X wants to: create calendar
  events, read tasks" — same visual pattern as an OAuth consent screen,
  because it structurally is one.

### Build order
1. Confirm with Teun which specific AI surfaces this gates first (NDY
   Generative Media Core? A future NDYCORE agent? Hassan's Flutter app
   doing something agentic?) — the consent-scope enum above is a
   placeholder until a real first consumer is named.
2. Add `AiAgentConsent` model + `AI_AGENT` `OAuthClientType` value
   (additive migration).
3. Add the one `assertConsent()` check into `ActionEngineService`'s
   existing Authorize step — this is a small, surgical change to code
   that already exists and works, not new pipeline.
4. Build the consent-grant UI (reuse the existing OAuth-consent-screen
   component if `apps/web` already has one from the OIDC authorize flow;
   if not, this is the one net-new UI piece).
5. Register the first real AI-agent `OAuthClient` and dry-run one action
   end-to-end before calling this live.

**Effort estimate:** ~1-2 weeks, but genuinely blocked on step 1 (naming
a real first consumer) — do not build a speculative consent-scope catalog
before one exists, per this codebase's own repeated "don't build ahead of
a real caller" discipline (see `scopes.ts`'s own comment).

---

## 5. NDY Verification Core (as a separated service)

### What exists today
Identity verification is currently a module inside NDYHUB's own API:
`apps/api/src/identity-verification/` (`IdentityVerificationRequest`
model, propose→approve flow, feeds `TrustService.recompute()` on
approval). It works, is deployed, and is the LEVEL_3 gate.

### What "separated service" means and why it was proposed
Per prior discussion with Teun/Hassan: verification logic (document
checks, liveness, future vendor integrations) is likely to be reused by
other NDY products directly (not just NDYHUB's own onboarding flow) and
may eventually need a real document-verification vendor (Persona, Onfido,
etc.) — a vendor integration is cleaner to isolate in its own service
than to embed inside NDYHUB's core API, especially once a vendor webhook
needs its own public endpoint surface and its own scaling/rate
characteristics independent of the rest of NDYHUB.

### Recommended approach: extract, don't rebuild
This is **not** a rewrite. The existing `IdentityVerificationService` is
correct and already integrated with `TrustService`. The separation is
purely an extraction:

1. Stand up `ndy-verification-core` as its own small NestJS service
   (own repo or a new `apps/` workspace member if kept monorepo — either
   is viable; monorepo is lower friction given the existing npm
   workspace setup).
2. Move `IdentityVerificationRequest`'s table ownership: either (a) keep
   it in NDYHUB's Postgres and have the new service connect to the same
   DB with a scoped role (fastest, but couples deploys), or (b) give it
   its own database and have NDYHUB call it via an internal service
   token (`InternalModule` already exists in `apps/api/src/internal/` —
   check if it already has a service-to-service auth pattern to reuse
   before inventing one). **Recommendation: (b)**, since the entire point
   of separating this is independent scaling/deployment — sharing the DB
   defeats that.
3. NDYHUB's `IdentityVerificationModule` becomes a thin client calling
   the new service, with `TrustService.recompute()` still triggered from
   NDYHUB's side on a webhook/callback from the verification service when
   a request is approved (same "notify on completion" shape as SES
   bounce webhooks already handled elsewhere in this ecosystem).
4. Vendor integration (real document/liveness checks) becomes new work
   *inside* the separated service, isolated from NDYHUB's core API blast
   radius — this isolation is the actual payoff of doing this extraction.

### Build order
1. Confirm this is still wanted now vs. later — it's a pure infrastructure
   move with no new user-facing capability by itself; the payoff only
   materializes once a real vendor integration or a second consumer
   product exists. Worth explicitly asking Teun whether to prioritize this
   extraction now or defer it until a second real consumer is named
   (mirrors the Context Broker's "don't build ahead of a real caller"
   caution above).
2. If confirmed now: scaffold the new service, port
   `IdentityVerificationService` largely as-is.
3. Add the internal service-to-service auth (reuse `InternalModule`'s
   pattern if one already exists there — check before building new).
4. Cut NDYHUB over to calling the new service; verify the LEVEL_3 approval
   → `TrustService.recompute()` chain still fires correctly end-to-end in
   production before decommissioning the in-process module.

**Effort estimate:** ~1 week of pure extraction work if prioritized now;
recommend deferring until a second consumer or a real vendor integration
is imminent, since building it speculatively risks the same "architecture
with no real caller yet" trap this plan flags elsewhere.

---

## 6. Founding-team NDY ID seeding

### Current state (verified directly in the file)
`apps/api/prisma/seed-founding-team.ts` is **code-complete**. It is
blocked on exactly one thing: 6 placeholder email addresses still present
in the file —

```
REPLACE_WITH_TEUN_EMAIL
REPLACE_WITH_SUFYAN_EMAIL
REPLACE_WITH_QURBAN_EMAIL
REPLACE_WITH_HASSAN_EMAIL
REPLACE_WITH_ABDUL_EMAIL
REPLACE_WITH_ABRAR_EMAIL
```

The script itself has a guard (`if (entry.email.startsWith('REPLACE_WITH_'))`)
that refuses to run against unfilled placeholders — so there is no risk of
accidentally seeding garbage; it fails safe.

### Build order (this is not really "build" — it's data + one command)
1. Get real, confirmed email addresses for all 6 people from Teun (these
   must be the actual email each person will use to log into NDYHUB —
   get this right the first time, since NDY ID is meant to be permanent).
2. Fill the 6 placeholders in the file.
3. Run a **dry run** first (the script should support a no-`--apply` mode
   per its own guard structure — confirm this before running for real).
4. Review dry-run output with the user/Teun.
5. Run with `--apply`.
6. Verify: each of the 6 accounts exists with the correct `NdyIdType`
   (`CEO`/`EXE`/`DEV` etc. per the earlier-fixed `ndy-id.util.ts`) and can
   actually log in.

**Effort estimate:** minutes of engineering time once the 6 real emails
are provided — this is purely blocked on that one input, not on any
remaining code.

---

## 7. NDYQR image endpoint + service credentials

### What exists vs. what's deferred
NDYQR itself is fully live (CRUD, analytics, branded rendering, scan
validation). Deferred, per `docs/ndyqr.md` §7: a server-rendered image
endpoint so non-JS clients (mobile apps, print pipelines) can fetch a
branded PNG/SVG without running the web renderer JS, plus scoped
service credentials so another product's backend (not a logged-in user)
can create/render codes on its own behalf.

### Why this is low-risk, additive work
`apps/web/src/lib/ndyqr-render.ts` already isolates all rendering logic
(gradient, module rounding, center-zone reservation, Level-H error
correction, `jsqr` validation) in one module with no web-framework
coupling beyond using `canvas`/`qrcode` — porting it server-side is a
port, not a rewrite, exactly as the existing doc already notes.

### Build order
1. Move `ndyqr-render.ts`'s logic into `apps/api` (or a shared package if
   the monorepo already has a shared-code convention — check
   `apps/api`/`apps/web` for an existing shared lib pattern before adding
   a new workspace package).
2. Add `GET /q/:slug/image.png` and `.svg` to
   `ndyqr-redirect.controller.ts` (already public, already throttled
   300/min — same guard characteristics apply, no new security surface).
3. Run `validateNdyQrPng()` server-side before returning the image (same
   validation already proven client-side — just relocate the call).
4. Add a new OAuth scope (`ndyqr:create`) following `scopes.ts`'s
   established "add scopes as real clients need them" rule, gated to
   registered `OAuthClient`s, for other products' backends to call
   `POST /ndyqr` and fetch the resulting image without a logged-in user
   session — mirrors exactly how NDYBITS' event-intake scope
   (`ndybits:report-event`) was added for the Reward Engine.

**Effort estimate:** ~2-3 days — smallest "new capability" item on this
list since the hard rendering work is already done and just needs a
second entry point.

---

## Summary table

| # | Item | Blocked on | Effort once unblocked | Risk if built ahead of schedule |
|---|---|---|---|---|
| 1 | NDY Signature | Legal-weight + Action-Engine-routing decisions from Teun | ~3-4 days | Wrong consent/legal capture is expensive to retrofit |
| 2 | Trust score | Formula from Teun | ~0.5 day | Wrong formula erodes trust in "Trust" itself |
| 3 | NDY Admin | Design doc + Hassan/Sufyan/Abdul sync call | Design first, then ~2-3 weeks | Building UI before scope sync wastes the most effort of any item here |
| 4 | Context Broker | Naming a real first AI consumer | ~1-2 weeks | Speculative scope catalog, no real caller to validate against |
| 5 | Verification Core extraction | Confirm priority now vs. later | ~1 week | Pure infra move with no payoff until a 2nd consumer/vendor exists |
| 6 | Founding NDY ID seeding | 6 real email addresses | Minutes | None — script already fails safe |
| 7 | NDYQR image endpoint | Nothing — pure engineering | ~2-3 days | None — fully additive, no design ambiguity |

**Recommended build order given what's actually unblocked right now:**
7 → 6 → 2 → 1 → then whichever of 3/4/5 Teun prioritizes after the
architecture sync call, since 3, 4, and 5 all explicitly depend on a
conversation or decision that hasn't happened yet, while 7, 6, 2, and 1
(pending its two small decisions) can start immediately.
