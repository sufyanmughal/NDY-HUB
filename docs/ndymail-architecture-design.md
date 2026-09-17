# NDYMAIL — Provider-Independent Mail Platform (Design Proposal)

**Status: architecture locked/client-approved 2026-08-27, not yet built.**
Grounded in the client's full message thread (provider-independence
requirement → green-light + detailed requirements list → NDY-ID-derived
official address requirement → decisions locked on all open questions,
§10). Written before any schema/code is touched, per this project's
standing discipline. Revised timeline is the next deliverable (§10.4);
implementation has not started.

**Supersedes, does not extend, the existing `Email`/`EmailRecipient`
model.** That model (schema.prisma's "--- NDYMAIL ---" section, built
earlier) is internal-only NDYSPACE-to-NDYSPACE messaging with no real
SMTP/IMAP, no provider concept, and no external send/receive — it was a
rough first pass before the client had specified real requirements. Per the
client's own framing ("old one was not fully architected, gave rough data
at that time"), this document treats the new spec as the authoritative
architecture and proposes a clean new domain rather than retrofitting the
old model — see §7 for exactly what happens to the old tables.

---

## 0. What the client actually asked for, across three messages

1. **Provider independence** — NDYMAIL must never be built "around" any one
   provider. Architecture: `NDYMAIL App → NDY Mail Gateway/API → provider
   (M365 / Google Workspace / IMAP-SMTP / future NDY Mail Infrastructure)`.
2. **Green-lit scope, with a refined architecture**:
   `NDYMAIL App → NDY Mail API → NDY Mail Core → Provider Adapter Layer →
   Microsoft Graph / Gmail / IMAP / future NDY Mail Infrastructure`, plus:
   - Provider-independent data model for Messages, Threads, Mailboxes,
     Folders, Attachments, Contacts, Mail Events.
   - Provider credentials/tokens server-side, encrypted, linked to NDY ID —
     never in the app.
   - Webhook renewal/recovery/resync — never blindly trust provider pushes.
   - Mail Event Bus now: `mail.received`, `mail.sent`, `mail.flagged`,
     `mail.deleted`, `attachment.received`.
   - NDYTREXX AI access to mail content permission-gated via NDYHUB from
     day one.
   - Notifications routed through the existing NDYHUB Notification System.
   - Contacts against the future shared NDYHUB Identity Graph, not a silo.
   - Calendar integration kept ready (meeting/event extraction).
   - Full audit logging: account connections, security events, sending
     activity, future AI actions.
   - Data model already prepared for native NDY email addresses, even
     though Phase 1 doesn't run NDYHUB's own mail servers.
   - First adapter: Microsoft Graph. Gmail/IMAP/future-NDY-infra as
     additional adapters, same interface.
3. **NDY-ID-derived official addresses** (latest message) — every user's
   *official* NDYMAIL address is generated from their permanent NDY ID,
   e.g. `NDY-CEO-000001@ndyhub.com`, `NDY-FND-000002@ndyhub.com`. Friendly
   aliases (`teun@ndyhub.com`) may exist later but resolve to the
   underlying permanent mailbox — the NDY ID address is the official
   identity, so a role/title change never orphans mailbox history.

## 1. Why this is a new domain, not an extension of the old `Email` model

The old model has no concept of: an external provider, an OAuth-linked
mailbox, a thread separate from a single message, a folder that isn't one
of 4 hardcoded enum values, a webhook, or an event bus. Every one of these
is load-bearing for what's being asked. Retrofitting means either (a)
bolting provider concerns onto a schema that was explicitly commented "no
SMTP/IMAP integration here," fighting its assumptions the whole way, or (b)
building the real thing properly. This proposes (b): a new module
(`ndy-mail`, distinct from `ndyspace-mail`), new tables, and explicit
handling of what becomes of the old ones (§7).

## 2. Architecture layers (mapping the client's diagram onto real modules)

```
NDYMAIL App (web/mobile UI)
        │  REST/GraphQL, auth via NDYHUB session (never provider tokens)
        ▼
NDY Mail API            — apps/api/src/ndy-mail/*.controller.ts
        │  provider-agnostic calls only: listThreads(), send(), etc.
        ▼
NDY Mail Core           — apps/api/src/ndy-mail/core/*.service.ts
        │  owns the data model (§3), the event bus (§5), permissioning,
        │  webhook recovery/resync, audit logging. Never imports a
        │  provider SDK directly.
        ▼
Provider Adapter Layer  — apps/api/src/ndy-mail/adapters/{graph,gmail,imap,ndy-native}/
        │  each adapter implements the same MailProviderAdapter interface
        │  (§4); Core code only ever calls the interface.
        ▼
Microsoft Graph / Gmail API / IMAP-SMTP / future NDY Mail Infrastructure
```

Identity/SSO, permissions, and notifications are NOT inside NDY Mail at
all — they're the existing NDYHUB systems, called into:

- **Identity/SSO**: NDYMAIL has no login of its own. A user is already
  authenticated via NDYHUB's existing session/JWT (`JwtAuthGuard`, same as
  every other module). "Multiple accounts" means multiple linked
  `MailAccount` rows (§3) under one authenticated NDY ID, not multiple
  logins.
- **Permissions**: NDYTREXX AI access to mail content is gated by a new
  permission-scope check against NDYHUB's existing permission system
  (`common/permissions.ts`'s `Permission` enum pattern) — not a bespoke
  mail-only setting. See §6.
- **Notifications**: new mail fires through the existing
  `NotificationService.notify()` (Phase 2) with `category: 'NDYMAIL'`
  (a new `NotificationCategory` enum value) — no separate notification
  stack, exactly as instructed.
- **Events**: the Mail Event Bus reuses the exact `EcosystemEvent` shape
  (namespaced `eventType`, `payload Json?`, `sourceEventId` idempotency)
  already proven in this schema — either as rows directly in
  `EcosystemEvent` with a `mail.*` namespace, or a dedicated `MailEvent`
  table if mail volume would otherwise flood the shared table. Recommend
  starting with a dedicated `MailEvent` table (§3) since mail event volume
  (every inbound message) is much higher than typical ecosystem events and
  souldn't dilute that table's indexes — same reasoning as why
  `NdybitsLedgerEntry` and `EcosystemEvent` are already separate tables
  rather than one shared "all events" table.

## 3. Provider-independent data model (draft)

```prisma
// --- NDY Mail Core (provider-independent) ---

enum MailProviderType {
  MICROSOFT_GRAPH
  GOOGLE_WORKSPACE
  IMAP_SMTP
  NDY_NATIVE   // future in-house mail infrastructure — see §8
}

enum MailAccountStatus {
  CONNECTED
  REAUTH_REQUIRED   // token expired/revoked at the provider, needs the user to relink
  DISABLED
}

// One user can link multiple provider mailboxes ("multiple accounts").
// This is NEVER the login identity — NDYHUB's User/ndyId already is that.
model MailAccount {
  id                String            @id @default(uuid())
  userId            String
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider          MailProviderType
  // The official NDY Mail address for this account, e.g.
  // "NDY-CEO-000001@ndyhub.com" for the primary/native account, or the
  // linked provider's own address (e.g. a Microsoft 365 mailbox) for a
  // secondary connected account. See §9 for exactly how the NDY-ID address
  // is derived/provisioned.
  address           String            @unique
  isPrimary         Boolean           @default(false) // the official NDY ID mailbox — see §9
  status            MailAccountStatus @default(CONNECTED)
  // Server-side only, AES-256-GCM encrypted (same primitive as
  // common/totp-crypto.util.ts, new MAIL_TOKEN_ENCRYPTION_KEY secret) —
  // never sent to the client, never logged. Nullable: NDY_NATIVE accounts
  // (once real) won't need an external OAuth token at all.
  encryptedAccessToken  String?
  encryptedRefreshToken String?
  tokenExpiresAt        DateTime?
  // Webhook subscription bookkeeping — see §6 for the renewal/recovery
  // mechanism this backs. Nullable: IMAP has no webhook concept, needs
  // polling instead (see MailProviderAdapter.supportsWebhooks()).
  webhookSubscriptionId String?
  webhookExpiresAt      DateTime?
  lastSyncedAt          DateTime?
  connectedAt           DateTime          @default(now())

  folders     MailFolder[]
  threads     MailThread[]

  @@index([userId])
}

enum MailFolderKind {
  INBOX
  SENT
  DRAFTS
  SPAM
  TRASH
  ARCHIVE
  CUSTOM
}

// Providers have arbitrary custom folders/labels (Gmail labels aren't
// really folders) — kind classifies into the fixed UI tabs the client
// asked for; providerFolderId is the opaque provider-side id/label for
// sync purposes.
model MailFolder {
  id               String         @id @default(uuid())
  mailAccountId    String
  mailAccount      MailAccount    @relation(fields: [mailAccountId], references: [id], onDelete: Cascade)
  kind             MailFolderKind
  name             String         // display name, e.g. "Inbox" or a custom label's real name
  providerFolderId String?        // null for IMAP if using naming-convention-only mapping

  threads MailThread[]

  @@unique([mailAccountId, providerFolderId])
  @@index([mailAccountId, kind])
}

// A thread is the real unit of conversation — matches how Gmail/Graph both
// already model mail, and how the NDYMAIL UI (Inbox as a thread list) will
// actually render. A single-message "thread" is just a thread with one
// MailMessage.
model MailThread {
  id              String      @id @default(uuid())
  mailAccountId   String
  mailAccount     MailAccount @relation(fields: [mailAccountId], references: [id], onDelete: Cascade)
  folderId        String
  folder          MailFolder  @relation(fields: [folderId], references: [id])
  providerThreadId String?    // opaque provider-side thread/conversation id
  subject         String
  isRead          Boolean     @default(false)
  isStarred       Boolean     @default(false)
  lastMessageAt   DateTime

  messages    MailMessage[]

  @@index([mailAccountId, folderId, lastMessageAt])
}

model MailMessage {
  id                 String       @id @default(uuid())
  threadId           String
  thread             MailThread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  providerMessageId  String?      // opaque provider-side message id — the sync/dedup key
  fromAddress        String
  toAddresses        String[]
  ccAddresses        String[]     @default([])
  bccAddresses       String[]     @default([])
  subject            String
  bodyText           String?
  bodyHtml           String?
  sentAt             DateTime
  receivedAt         DateTime?    @default(now())

  attachments MailAttachment[]

  @@unique([threadId, providerMessageId])
  @@index([threadId, sentAt])
}

// Metadata + a pointer, not the raw bytes — same "don't store the
// sensitive artifact directly, store a reference" pattern as
// IdentityVerificationRequest.evidenceNote and EmailAttachment's existing
// DriveFile-pointer design. storageRef is either a DriveFile id (if pulled
// into NDY Drive) or an opaque provider attachment id (if fetched
// on-demand from the provider, not persisted) — which one is a
// provider-adapter-level decision, not fixed here.
model MailAttachment {
  id          String      @id @default(uuid())
  messageId   String
  message     MailMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  fileName    String
  mimeType    String
  sizeBytes   Int
  storageRef  String      // DriveFile id, or opaque provider attachment id

  @@index([messageId])
}

// --- Mail Event Bus ---
// Deliberately its own table, not reusing EcosystemEvent directly — see §2
// for why (volume). Same eventType/payload/sourceEventId shape so any
// future consumer (NDYTREXX AI, analytics) doesn't have to learn a second
// event contract.
model MailEvent {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  mailAccountId String?
  // "mail.received" | "mail.sent" | "mail.flagged" | "mail.deleted" |
  // "attachment.received" — validated against a small registered catalog,
  // same discipline as EcosystemEvent.eventType.
  eventType     String
  payload       Json?
  sourceEventId String   @unique // idempotency — same contract as EcosystemEvent.sourceEventId
  createdAt     DateTime @default(now())

  @@index([userId, eventType, createdAt])
}

// --- Audit ---
// Reuses the existing AuditLogEntry model/service (already used by every
// other admin/security-relevant action in this codebase) rather than a
// mail-specific audit table — account connect/disconnect, send activity,
// and (later) AI actions all become AuditLogEntry rows with a
// "mail.account.connected" / "mail.message.sent" / "mail.ai.summarized"
// style action string, same as every other domain already does. No new
// audit model needed.
```

## 4. Provider Adapter interface (draft)

```typescript
// apps/api/src/ndy-mail/adapters/mail-provider-adapter.interface.ts
export interface MailProviderAdapter {
  readonly provider: MailProviderType;
  supportsWebhooks(): boolean;

  // OAuth/connection lifecycle — Core calls these, never touches a
  // provider SDK or OAuth flow directly.
  getAuthorizationUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<ProviderTokenSet>;
  refreshTokens(refreshToken: string): Promise<ProviderTokenSet>;

  // Sync — Core's job is turning these into MailThread/MailMessage rows;
  // the adapter's job is only translating the provider's shape into a
  // small set of plain DTOs (ProviderThreadDto, ProviderMessageDto).
  listFolders(account: MailAccount): Promise<ProviderFolderDto[]>;
  syncFolder(account: MailAccount, folder: MailFolder, since?: Date): Promise<ProviderThreadDto[]>;
  sendMessage(account: MailAccount, draft: OutboundMessageDto): Promise<{ providerMessageId: string }>;

  // Webhook lifecycle (no-ops / throws NotSupported for IMAP) — see §6.
  registerWebhook(account: MailAccount, callbackUrl: string): Promise<{ subscriptionId: string; expiresAt: Date }>;
  renewWebhook(account: MailAccount): Promise<{ expiresAt: Date }>;
}
```

Every screen in the NDYMAIL app calls **NDY Mail API** endpoints
(`GET /ndy-mail/threads`, `POST /ndy-mail/messages`, etc.) — never a
provider SDK, never even the adapter interface directly. Swapping or adding
a provider means writing one new class implementing this interface and
registering it; zero UI or API-layer changes. This is the concrete
mechanism behind the client's "adapter pattern from day one" requirement.

## 5. Feature build order (unchanged from the plan already green-lit)

1. NDYHUB SSO is already in place — no new auth work; `MailAccount` linking
   is the only new identity-adjacent piece (OAuth-connect a provider
   mailbox to an already-authenticated NDY ID).
2. `MailAccount`/`MailFolder`/`MailThread`/`MailMessage` schema + Graph
   adapter, read-only sync (Inbox/Sent/Drafts/Trash).
3. Compose/Reply/Forward + attachments (via Graph's send API).
4. Search, Spam handling.
5. Webhook registration + `MailEvent` emission → NDYHUB
   `NotificationService`.
6. Renewal/recovery/resync hardening (§6) — not deferred to "later," per
   the client's explicit requirement it ships in this phase.

## 6. Webhook renewal, recovery, and resync (explicit requirement)

Graph/Gmail webhook subscriptions expire (Graph: max ~3 days) and can
silently fail to fire. Three mechanisms, all required from v1 per the
client's message, none optional:

1. **Renewal**: a scheduled job (same pattern as any existing cron-style
   job in this codebase, or a simple interval check on API boot) scans
   `MailAccount.webhookExpiresAt` and calls `renewWebhook()` before
   expiry — never waits for a provider to ask us to renew.
2. **Recovery**: if a webhook renewal fails (provider error, revoked
   consent), `MailAccount.status` flips to `REAUTH_REQUIRED` and a
   Notification fires to the user — never silently stops syncing without
   telling anyone.
3. **Resync**: independent of webhooks, a periodic full-folder resync
   (`syncFolder(since: lastSyncedAt)`) runs on a longer interval as a
   safety net — a missed/failed webhook delivery is caught within one
   resync cycle, not left stale indefinitely. This is the concrete answer
   to "don't depend blindly on provider notifications."

## 7. What happens to the existing internal `Email`/`EmailRecipient` model

Per the client's own framing (rough early pass, not a real spec), and
since it's NDYSPACE-internal messaging with real existing usage
(NDYSPACE's own Inbox/Sent/Drafts UI, `ndyspace-mail.controller.ts`):

- **Not deleted.** It's live, in use, and this document isn't proposing a
  breaking migration of existing user data.
- **Not the foundation NDYMAIL is built on.** New `ndy-mail` module,
  entirely new tables, as above.
- **Recommend renaming its concept internally** (not necessarily an
  immediate code rename) to make clear it's NDYSPACE's internal
  messaging/notes-style mail, distinct from real NDYMAIL — avoids two
  different systems both claiming the "NDYMAIL" name going forward. Flagged
  as an open question in §10 rather than assumed, since renaming touches
  live UI text NDYSPACE users already see.

## 8. NDY Native provider (future in-house mail infrastructure)

`MailProviderType.NDY_NATIVE` exists in the enum now, unused — exactly
mirroring this codebase's existing "architecture-ready, not activated"
pattern (the CRYNDY bridge, Phase 6). No mail server, no MTA, no DNS/MX
work is proposed in this document. When NDYHUB eventually runs its own
mail infrastructure, it's one more adapter implementing the same
interface — no NDYMAIL UI or API change required, which is the entire
point of the adapter layer existing.

## 9. NDY-ID-derived official mailbox addresses (latest requirement)

- On `MailAccount` creation for a user's **primary** account
  (`isPrimary: true`), the address is deterministically derived from the
  user's permanent `ndyId` (already lowercased/normalized) —
  `ndy-ceo-000001@ndyhub.com` for `NDY-CEO-000001` — reusing the existing
  `ndyIdTypeForUser`/`ndyId` machinery from the founding-identities work
  ([[docs/founding-identities.md]]), not a new ID scheme.
- **Provisioning trigger**: whenever a user's NDY ID is finalized/activated
  (today: at signup for ordinary MBR users; for the founding six, at the
  point `seed-founding-team.ts` assigns their override), a
  `MailProvisioningService.provisionPrimaryMailbox(userId)` call creates
  the primary `MailAccount` row automatically — this is provisioning the
  *address/identity*, not standing up a real mailbox backend (Phase 1 still
  runs actual mail through Graph/Gmail per §8 — see open question 1 below
  for exactly what backs this address before NDY_NATIVE exists, since real
  inbound delivery to `@ndyhub.com` needs actual mail server / DNS MX work).
- **Aliases**: a separate `MailAlias` table (`aliasAddress`,
  `mailAccountId`, both unique) lets a friendly address
  (`teun@ndyhub.com`) resolve to the same primary `MailAccount` — not
  drafted in full here since it's explicitly a "later" per the client's
  message, but the `MailAccount.address` design already doesn't preclude
  it (aliases just add rows pointing at the same account).
- **Role/title changes never affect this**: exactly like `ndyId` itself,
  the mailbox address is tied to the permanent ID segment, not the
  person's current title — a professional-title change (Phase 8's
  `professional_title` claim) never touches `MailAccount.address`. A role
  change that changes the *ID class itself* (vanishingly rare, only the
  hand-curated founding set) would need an explicit, deliberate mailbox
  address migration — flagged, not silently handled, since email address
  changes break external correspondence in a way a display badge does not.

## 10. Decisions — locked by the client, 2026-08-27

All four open questions below are now resolved. Recorded as asked/answered
(not rewritten as if they were always settled) so the reasoning stays
visible for later phases.

### 10.1 `@ndyhub.com` — real inbound + outbound in Phase 1, not cosmetic

**Client's answer**: build it the way recommended, but with one correction
to my original proposal — the NDY address must be **genuinely usable for
both sending and receiving**, not a display-only alias with the provider
address doing the real work. "The user should only know and use the NDY
address. The Microsoft/Google account is an infrastructure detail behind
the scenes." Also locked as a standing principle: **the NDY ID email
address belongs to NDYHUB — the provider never owns the identity** —
Microsoft/Google/IMAP/future NDY infrastructure are interchangeable
delivery layers behind NDY Mail Core, never the identity itself.

**Correction to my original §10 draft**: "send-as alias" (Graph's own
outbound-only alias feature) only solves *outbound* — it does not make
`@ndyhub.com` receive mail. Real inbound delivery to `@ndyhub.com` without
NDYHUB running its own mail servers requires **adding `ndyhub.com` as a
verified custom domain inside the Microsoft 365 / Google Workspace tenant
NDYHUB itself controls**, with MX records for `ndyhub.com` pointing at that
tenant (Microsoft/Google's own mail infrastructure, not a self-hosted MTA).
This is a standard, supported feature of both platforms (custom domain
mailboxes) — it satisfies "we won't operate our own mail servers" (Google/
Microsoft's infrastructure still does the actual SMTP handling) while
making `NDY-CEO-000001@ndyhub.com` a real, directly-addressable mailbox
that receives mail with zero "actually forward to a different address"
step. This is the corrected Phase 1 model — not the cosmetic-alias version
originally drafted above.

Concretely: `MailAccount.address` for a primary account IS the mailbox's
real address at the provider (a custom-domain mailbox provisioned under
`ndyhub.com` in NDYHUB's own M365/Workspace tenant), not a separate
display value layered over a different underlying provider address. The
provider adapter still owns all the OAuth/API mechanics (§3, §4) — the
distinction is *which* mailbox gets provisioned at the provider, not a new
architectural layer. **Future migration to NDY_NATIVE**: address, identity,
mailbox history, and the NDYMAIL UI stay unchanged — only the adapter
backing that one `MailAccount` row changes, per the client's explicit
requirement ("address, identity, mailbox history and NDYMAIL UI must
remain unchanged").

**Follow-up needed, not yet answered**: verifying `ndyhub.com` as a custom
domain inside an M365/Workspace tenant is an admin-console/DNS action on
the client's own domain (adding TXT/MX/CNAME records), not something built
in code. This should be scheduled as an explicit setup step (likely with
Teun or whoever holds `ndyhub.com`'s DNS) before Phase 1's Graph adapter
work can provision real primary mailboxes — flagged here so it isn't
missed once implementation starts.

### 10.2 Existing NDYSPACE mail — renamed, not retired

**Client's answer**: rename the existing internal `Email`/`EmailRecipient`
feature to **"NDYSPACE Messages"** (or "NDYSPACE Internal Mail") in UI
copy — "NDYMAIL" is reserved exclusively for the new standalone platform
designed in this document. No schema/model rename required (internal name
`Email`/`EmailRecipient` can stay as-is; this is UI copy and any
user-facing references only) — tracked as a small follow-up task, separate
from NDYMAIL's own build.

### 10.3 NDYTREXX AI permissions — user toggle within an org policy ceiling

**Client's answer**: confirmed off-by-default, user-toggleable per
mailbox, exactly as proposed — **plus** a new requirement not in the
original draft: a **Business/organization admin policy layer** that caps
what any user inside that organization can enable, for future Business
workspaces. Locked model:

```
Organization Policy  →  User Permission  →  NDYTREXX AI Access
   (ceiling)              (must be ≤ ceiling)     (effective access)
```

Concretely, this needs a new org-level policy shape (naturally a
`WorkspaceAiPolicy` model, scoped to a `BUSINESS` Workspace — reusing
Phase 4's `Workspace`/`WorkspaceMembership` foundation rather than
inventing a second org concept) with fields covering at least:
- `aiEnabled: Boolean` (org kill switch — false disables AI for every
  mailbox in the workspace regardless of user setting)
- `allowSummaries` / `allowDrafting` / `allowAutoReply`-style granular
  toggles (exact feature list TBD against NDYTREXX's real capabilities
  when that integration is actually built — not fixed here)
- Per-mailbox restriction (allowlist/denylist of which workspace mailboxes
  AI may touch at all)
- Retention/privacy policy fields (TBD — likely follows whatever pattern
  GDPR module already uses for retention, not a new one)

The effective permission check becomes: `userSetting.enabled AND
orgPolicy.aiEnabled AND (requested feature allowed by orgPolicy)` — the
user's own toggle can only ever narrow access, never exceed the
organization's ceiling. This is additive to, not a replacement for, the
originally-proposed `AI_MAIL_ACCESS`-style user-level permission scope —
Phase 1 for PERSONAL workspaces (no organization) simply has no ceiling to
check (org policy defaults to fully permissive/inapplicable), so this adds
no friction for individual users. Full `WorkspaceAiPolicy` schema is
deferred to whichever phase actually builds NDYTREXX AI integration (this
document only locks the *shape* of the decision so mailbox/permission
plumbing doesn't need to be redone later) — flagged, not built now.

### 10.4 Timeline — deferred until architecture is fully locked

**Client's answer**: explicitly do not force the old 4–6 week estimate.
Finish locking the schema/technical architecture properly first (this
document, now with 10.1–10.3 resolved), then give a realistic revised
estimate — quality and future-proofing take priority over hitting a
pre-existing number. A revised timeline is the next deliverable after this
document is finalized (see §12).

---

## 11. What this document deliberately does not do

No schema migration, no service code, no controller, no adapter
implementation has been written against this proposal. Nothing here is
committed. Per this project's standing discipline (every phase, most
recently Phase 8), this is the architecture sign-off artifact, not the
implementation.

## 12. Confirmed identity chain (client's framing) and next steps

The client has explicitly framed NDYMAIL as one link in a single identity
backbone, not a standalone product:

```
NDY ID → NDY Passport → NDYMAIL → NDY Trust → NDY Signature → NDY Proof
```

Every piece of this document was written to keep that chain intact: the
mailbox address is derived from the same `ndyId`/`ndyIdTypeForUser`
machinery as the Passport badge (§9, [[docs/founding-identities.md]]), and
Trust/Signature/Proof (Phase 8, [[docs/phase8-signature-trust-design.md]])
share the same "permanent identity, evolving attributes, NDYHUB as the
single source of truth" principle already locked for both the ID system
and this document. No architectural change is needed here to keep that
chain connectable later — this section records the confirmation, not a new
requirement.

**Status as of this decision round**: architecture is client-approved
end-to-end (10.1–10.3 above). Remaining before implementation starts:
1. Revised timeline (§10.4) — next deliverable, see §13.
2. `ndyhub.com` custom-domain verification inside the M365/Workspace
   tenant (§10.1 follow-up) — an admin/DNS action, needs scheduling.
3. Rename NDYSPACE's existing internal mail UI copy (§10.2) — small,
   independent task, can happen anytime, not blocking NDYMAIL's build.

## 13. Revised timeline

The original 4–6 week estimate (given before this document existed) only
covered a single-provider read/write mail UI. Locked scope now includes
webhook recovery/resync, a dedicated event bus, org-policy-aware AI
permissioning, real custom-domain mailbox provisioning, and full audit
logging — all required in v1, not deferred. Breaking the locked
architecture into shippable phases, each independently demoable (same
discipline as every other phase in this project):

| Phase | Scope | Estimate | Status |
|---|---|---|---|
| **A. Foundation** | `MailAccount`/`MailFolder`/`MailThread`/`MailMessage`/`MailAttachment` schema + migration. `MailProviderAdapter` interface. Microsoft Graph adapter: OAuth connect flow, read-only folder/thread/message sync. | 1.5–2 weeks | **Built, deployed, verified live in production.** `ndyhub.com` custom-domain verification (§10.1 follow-up) still blocked on DNS access from Teun — see docs/ndyhub-com-mail-domain-setup.md, sent separately. |
| **B. Core mail UX** | Compose/Reply/Forward + attachments (send via Graph). Search. Spam/Trash handling. NDYMAIL UI: Inbox/Sent/Drafts/Spam/Trash, multiple-account switcher. | 1.5–2 weeks | **Built locally, not yet deployed** (holding per explicit instruction — deploying together with later phases). Found and fixed a real bug while building: the OAuth callback route needed to be public (no JwtAuthGuard) and use a real 302 redirect back into `/ndymail`, not JSON — Graph's redirect-back carries no bearer token. |
| **C. Reliability** | Webhook registration + renewal job + `REAUTH_REQUIRED` recovery flow + periodic resync safety net (§6 — all three required, none optional). `MailEvent` bus wired to real sync/send paths. | 1–1.5 weeks | **Built locally, not yet deployed.** No `@nestjs/schedule` dependency existed in this codebase — used plain `OnModuleInit`/`setInterval`, matching how nothing else here does recurring jobs either, rather than adding a new dependency speculatively. New env var needed before this can run for real: `MAIL_WEBHOOK_BASE_URL` (nothing in the backend previously needed its own public URL). |
| **D. Identity + governance** | Official NDYMAIL address surfaced in `GET /auth/me` (`officialMailAddress`, always derived live from `ndyId` — no signup-time provisioning step needed since the address has zero stored state). `WorkspaceAiPolicy` schema + `MailAccount.aiAccessEnabled` + `MailAiPolicyService` (the `Organization Policy -> User Permission -> NDYTREXX AI Access` computation, §10.3) — schema-ready, not enforced against a real feature yet since NDYTREXX isn't integrated. Audit logging uses `SecurityEvent` (self-service "what happened on my account" timeline), not `AuditLogEntry` as originally assumed in this doc's first draft — `AuditLogEntry` requires an `adminUserId` acting on a target, wrong shape for a user connecting their own mailbox. | 1 week | **Built locally, not yet deployed.** |
| **E. Hardening + launch** | Cross-account testing, error-state UI (reauth banners, sync failures), rate-limit/backoff handling against Graph, staging soak test, founding-team mailbox provisioning for the six NDY IDs already assigned. | 0.5–1 week | **Partially built locally, not yet deployed.** Done: Graph 429/503/504 retry with `Retry-After`-aware exponential backoff (one choke point, `graphFetch`, so every call gets it — not repeated per call site). Reauth banner + distinct sync-failure messaging in the NDYMAIL UI (was previously a single generic error string indistinguishable from a real failure). Real unit tests added (14 passing, full suite 70/70 clean, no regressions) covering the two genuinely security/privacy-relevant pieces: `MailAiPolicyService`'s org-ceiling-never-exceeded guarantee, and `MailAccountService.getOwned`'s cross-account access check. Still open: a real staging soak test (needs live Graph credentials, still blocked on Teun/M365 tenant) and the actual founding-team mailbox provisioning run (blocked on the same credentials + `ndyhub.com` DNS). |

**Grounded estimate: ~6–8 weeks**, ~7 as the planning number, from the day
`ndyhub.com` DNS access is available and schema work starts — this is what
each phase above actually adds up to.

**Target: 4 weeks**, full scope unchanged (nothing in Phases A–E above is
being cut). This compresses the grounded estimate by running phases in
parallel wherever the dependency chain allows (e.g. starting Phase B's UI
work against Phase A's adapter interface before every last sync edge case
is done, rather than strictly sequencing all five) and treating it as an
aggressive, best-case target rather than a padded-in buffer. **Flagging
honestly**: this is tighter than the grounded estimate above, not a
different (smaller) scope — if something in Phase A or C runs into a real
snag (most likely spot: Graph webhook/reauth edge cases, or the
`ndyhub.com` DNS step landing late), 4 weeks is the number most likely to
slip, not the phases getting silently dropped. Will flag immediately if
that happens rather than let the date quietly pass.

**Explicitly NOT in this estimate** (later phases, not v1):
- Gmail and IMAP adapters (interface supports them per §4; each additional
  adapter is materially smaller than Phase A once the interface exists —
  ballpark 1–1.5 weeks per adapter, not estimated in detail here since
  order/priority for a second provider hasn't been requested yet).
- NDYTREXX AI integration itself (summaries, smart replies, drafting) —
  §10.3 only locks the *permission shape*, not the AI feature build.
- Calendar meeting/event extraction from mail (kept ready per §0, not
  built).
- `MailAlias` friendly-address support (§9) — deferred per the client's
  own "later" framing.
- NDY_NATIVE adapter / any self-hosted mail infrastructure (§8).
