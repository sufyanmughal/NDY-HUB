# NDY Action Engine — Contract & Risk-Tiering Model (v1 design)

Status: **design only, nothing in this doc is built yet.** This is the
foundation Teun asked for after the NDY Intelligence Fabric™ discussion —
the piece needed so that when the Fabric/Agents/Workflows layers get built
later (v2+), they slot into an execution boundary that already exists,
instead of NDY HUB being reshaped around them after the fact.

Everything below builds directly on patterns already live in this
codebase — it does not introduce a parallel system:

- `RoleChangeRequestService` — already implements exactly the
  propose → separately-approve → apply lifecycle this doc generalizes
  from "role changes" to "any registered action."
- `AuditLogEntry` — already the audit-log shape (denormalized actor
  snapshot, previous/new value, reason); `ActionLogEntry` below is its
  sibling, not a replacement.
- `oauth/scopes.ts` — already the scope vocabulary for what a caller may
  touch (`profile`, `email`, `membership`, `cryndy`, …). The Action
  Registry reuses these scopes rather than inventing a second permission
  language.
- `OAuthClient` — already the "external caller with granted scopes"
  concept; a future NDYAPPS-as-caller is architecturally the same shape.

## 1. Why a separate Action Engine (not "the AI calls the API")

Per the trust-zone split agreed with Teun: the Fabric (AI reasoning,
routing, future agents) and the Action Engine (execution) are different
trust zones. The Fabric is allowed to be wrong, manipulated (prompt
injection), or confidently mistaken about what it thinks should happen.
The Action Engine is the only component that actually mutates data, and
it must reach the same conclusion about whether a request is valid
*independently* of whatever the Fabric believed — it never trusts the
Fabric's judgment, only a structured, signed request.

Concretely: the Fabric never calls `PrismaService` or a domain service
directly. It only ever produces an **Action Request**, the same shape
regardless of whether a human clicked a button, typed a command, or a
future agent inferred an intent. There is exactly one path into any
mutation, and it's the same path a regular authenticated UI action
already uses today — the Action Engine adds a request/approval/audit
envelope around existing domain services, it does not replace them.

## 2. The Action Request contract

```ts
interface ActionRequest {
  actionKey: string;        // e.g. "calendar.event.create" — see Registry below
  workspaceId: string;      // personal workspace or business workspace_id
  requestedByUserId: string;
  requestedByNdyId: string;

  // Who/what originated this request — a human via UI, a human via the
  // AI command bar, or (future) an agent/trigger. Never omitted, always
  // logged. The Action Engine treats AI-originated and human-originated
  // requests identically once past this point — same validation, same
  // risk tier, same approval rules. The AI gets no special trust.
  origin: {
    type: "user_direct" | "ai_command" | "agent" | "trigger" | "external_api";
    detail?: string;        // e.g. which agent, which webhook, free text
  };

  params: Record<string, unknown>;  // validated against the action's own DTO — no untyped passthrough to Prisma, ever
  idempotencyKey: string;           // required on every request, not just trigger-originated ones — see §5
  intentToken?: string;             // required when origin.type is "agent" or "external_api" — see §6
}

interface ActionResult {
  status: "executed" | "pending_approval" | "rejected";
  actionLogId: string;
  approvalId?: string;      // present when status is "pending_approval"
  result?: unknown;         // the actual domain object created/changed, only when status is "executed"
  reason?: string;          // present when status is "rejected"
}
```

Key rule: **`params` is never trusted as-is.** Every registered action
owns a `class-validator` DTO exactly like today's controllers already
use (`CreateCalendarEventDto`, etc.) — the Action Engine runs that same
validation before anything else happens. This is the "Validate" step
added to the flow (see §4) — authorization says *who* may do this kind
of thing; validation says *this specific request* is well-formed and
safe to attempt (e.g. `endAt` after `startAt` — literally the bug fixed
in the calendar this session, which is exactly the class of error this
layer exists to catch before it becomes a confusing runtime error).

## 3. The Action Registry

A real table, not just a code convention — this is what lets the
Approval Center and audit UI enumerate "every action that exists"
without hardcoding a list in five places.

```prisma
enum ActionRiskTier {
  LOW        // reversible, no external visibility — create a reminder, save a draft, create a note
  MEDIUM     // visible to others or moderately hard to reverse — send an internal message, create a task assigned to someone else
  HIGH       // hard to reverse or touches sensitive data — send external email, change profile/passport fields, delete data
  CRITICAL   // financial or identity-security actions — payments, wallet operations, role/permission changes, KYC actions
}

model ActionDefinition {
  id            String          @id @default(uuid())
  actionKey     String          @unique   // "calendar.event.create"
  label         String                     // "Create calendar event"
  domain        String                     // "calendar" | "mail" | "ndyspace" | "contacts" | "wallet" | ...
  riskTier      ActionRiskTier
  requiredScopes String[]                  // reuses oauth/scopes.ts vocabulary, e.g. ["calendar"]
  reversible    Boolean         @default(false)
  reverseActionKey String?                 // e.g. "calendar.event.delete", null if genuinely irreversible (send email)
  enabled       Boolean         @default(true)  // kill switch — disable an action ecosystem-wide without a deploy
  createdAt     DateTime        @default(now())

  @@index([domain])
}
```

Registering an action is a deliberate, reviewed step — same discipline
as `oauth/scopes.ts`'s "add scopes as real clients need them, not
speculatively." v1 registers only the handful of actions actually being
built (calendar create/update/cancel, task create, contact create/update,
NDYSPACE file share) — not a speculative full list from the Fabric doc.

## 4. Execution flow

```
UNDERSTAND → AUTHORIZE → VALIDATE → risk-tier check → CONFIRM (if required) → EXECUTE → LOG
```

1. **Understand** — happens entirely on the Fabric/AI side (or is just
   "a user clicked a button," today). Produces an `ActionRequest`. Out
   of scope for the Action Engine itself.
2. **Authorize** — Action Engine checks: does `requestedByUserId` have
   `requiredScopes` for this `workspaceId`? (Reuses the existing RBAC +
   workspace-membership check, not a new permission system.) Rejects
   immediately if not — this never reaches validation.
3. **Validate** — run the action's own DTO validation against `params`.
   Rejects immediately with a specific reason if malformed (mirrors
   today's controller-level `class-validator` behavior exactly).
4. **Risk-tier check** — look up `riskTier` from the Registry.
   - `LOW`: proceed straight to Execute.
   - `MEDIUM` / `HIGH` / `CRITICAL`: create an `ActionApproval` row
     (status `PENDING`), return `status: "pending_approval"` to the
     caller. Nothing executes yet.
5. **Confirm** — for tiers requiring it, a human confirms via the
   Approval Center (see §5). `CRITICAL` additionally requires a fresh
   2FA/passkey check at confirmation time, not just an active session —
   same principle as the "payments always require additional
   authentication" rule from Teun's original message.
6. **Execute** — only after authorization + validation + (if required)
   confirmation all pass. Calls the actual domain service — the same
   `NdyspaceCalendarService.create()` a normal controller call would use
   today. The Action Engine is a wrapper around existing services, not
   a reimplementation of them.
7. **Log** — every request, at every stage (rejected, pending, executed,
   denied), writes an `ActionLogEntry`. Nothing exits this pipeline
   unlogged, including rejections — a denied action is itself a security
   signal worth keeping.

## 5. Approval Center (risk tiers, concretely)

```prisma
enum ActionApprovalStatus {
  PENDING
  APPROVED
  DENIED
  EXPIRED
}

model ActionApproval {
  id             String   @id @default(uuid())
  actionLogId    String   @unique
  riskTier       ActionRiskTier
  status         ActionApprovalStatus @default(PENDING)

  requiresStrongAuth Boolean @default(false)  // true for CRITICAL — approval must include a fresh passkey/2FA check
  expiresAt      DateTime                     // PENDING approvals expire — an unconfirmed payment request shouldn't sit executable forever

  resolvedByUserId String?
  resolvedAt       DateTime?

  createdAt DateTime @default(now())
  @@index([status])
}
```

- **LOW** — no `ActionApproval` row at all; executes immediately once
  authorized+validated. (Create a reminder, save a draft note.)
- **MEDIUM** — `ActionApproval` created, but can be auto-resolved by a
  lightweight in-context confirm (e.g. a UI toast "Send this message?
  [Confirm]"), no separate screen visit required.
- **HIGH** — must be resolved from the actual Approval Center screen,
  not an inline toast — deliberate extra friction (delete data, send
  external email, change passport/profile fields).
- **CRITICAL** — HIGH's requirements plus `requiresStrongAuth: true`
  (fresh passkey/2FA at the moment of approval, not just an active
  session) — payments, wallet operations, role/permission changes.

This is the same shape as `RoleChangeRequest`, generalized: propose
(here, "Action Engine creates a PENDING approval") → separate resolution
step → apply. Role changes themselves become one more entry in the
Action Registry once this exists (`admin.role.change`, tier `CRITICAL`)
rather than the bespoke system they are today — a natural consolidation,
not urgent to migrate in v1.

## 6. Idempotency and the Intent Token

**Idempotency** — every `ActionRequest` requires `idempotencyKey`, not
just trigger-originated ones (per the async/idempotent-from-day-one
requirement). The Action Engine treats a repeated key within a rolling
window (24h) as "already handled" and returns the original result rather
than executing twice. Cheap now, prevents an entire class of
double-booking/double-send bugs once webhooks and triggers exist.

**Intent Token** — when `origin.type` is `"agent"` or `"external_api"`
(i.e., the request did not originate from a live authenticated user
session in this request — e.g. NDYAPPS AI recognized "schedule this
meeting" from a conversation and wants NDY HUB to act on it), a bare
API call is not enough. NDY HUB issues a short-lived, single-use,
signed **Intent Token** scoped to exactly one proposed action + params +
workspace, tied to the user's own active NDY HUB session. The external
caller can carry that token back but cannot mint one or broaden its
scope. This is what turns "NDYAPPS asks NDY HUB to do something on a
user's behalf" from an ambient-trust API call into a capability the user
demonstrably already authorized in-session — the mechanism the Fabric
doc's cross-product diagrams needed but didn't name.

Not needed for v1 (no external callers yet) — documented now so the
`ActionRequest.intentToken` field exists in the contract from day one
and nothing has to be bolted on later.

## 7. What v1 actually builds (scope discipline)

Per the "prepare the foundation, don't build the Fabric yet" instruction
running through this whole thread — v1 is deliberately small:

1. `ActionDefinition` + `ActionApproval` + `ActionLogEntry` tables.
2. One `ActionEngineService` implementing the flow in §4, callable
   internally (no new public endpoint needed yet — it wraps existing
   authenticated controller actions).
3. Register 4–5 real, already-built actions as a proof of the pattern
   (e.g. `calendar.event.create` at MEDIUM, `contact.create` at LOW,
   `ndyspace.file.share` at MEDIUM) — enough to validate the contract
   against real code, not a speculative full catalog.
4. A minimal Approval Center list view (reuses the admin-dashboard
   patterns already in this codebase) showing PENDING approvals for the
   current user's workspace.

No agents, no Fabric, no triggers, no workflow chaining, no NDYAPPS
integration, no Intent Token issuance endpoint yet — those stay exactly
as designed above so v2+ has zero rework, but nothing past item 4 gets
built until Teun asks for it explicitly.
