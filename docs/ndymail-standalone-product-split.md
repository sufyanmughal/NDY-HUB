# NDYMAIL — Standalone Product Split (Design Proposal)

**Status: architecture proposal, not yet built.** Client-approved direction (2026-08-28): NDYMAIL splits out of NDYHUB into its own standalone NDJOYIT product — its own deployment, database, storage, and scaling model — while NDYHUB remains the identity backbone every NDJOYIT product trusts. Modeled explicitly on Microsoft/Outlook: one Microsoft account, Outlook is its own product built on top of it.

Client's own framing, quoted so nothing here drifts from it:

> "NDYHUB owns Identity. NDYMAIL owns Mail. NDYTREXX owns Intelligence. NDYHUB connects the ecosystem... NDYMAIL should trust NDYHUB through SSO/OIDC and APIs, while owning its own mailbox, message, attachment, quota, policy and storage data independently."

---

## 1. The good news: the trust mechanism already exists, fully built

NDYHUB already runs a complete, standards-based **OpenID Connect / OAuth2 provider** — this is not new infrastructure to build, it's infrastructure to *use* the way any third-party app already does:

- `GET /.well-known/openid-configuration` — OIDC discovery (`discovery.controller.ts`)
- `GET /oauth/authorize` — the login/consent flow (`authorize.controller.ts`)
- `POST /oauth/token` — code exchange, refresh tokens (`token.controller.ts`)
- `GET /oauth/userinfo` — identity claims (`userinfo.controller.ts`)
- `OAuthClient` model — registered clients with `redirectUris`, `allowedScopes`, `clientSecretHash` (`apps/api/prisma/schema.prisma`)
- Existing scopes already cover exactly what NDYMAIL needs: `openid` (who you are), `profile` (name + NDY ID), `email` (email address) — no new scopes required for basic login.

**This means NDYMAIL-as-a-separate-product connects to NDYHUB exactly the way this document's own earlier work already designed NDYMAIL to connect to Microsoft** — a real OAuth client, a real redirect flow, a real token exchange. The pattern isn't new; it's the same shape turned around: NDYMAIL becomes an OAuth *client* of NDYHUB, the same relationship every future NDJOYIT product will have with NDYHUB as "the identity backbone."

## 2. What "split" concretely means

| | Today (inside NDYHUB) | After the split |
|---|---|---|
| **Deployment** | Same Next.js app, same NestJS API, same droplet | Own frontend deployment, own API deployment, own droplet(s) |
| **Database** | Shares NDYHUB's Postgres — `MailAccount`, `MailFolder`, `MailThread`, `MailMessage`, `MailAttachment`, `MailEvent`, `WorkspaceAiPolicy` all live in NDYHUB's schema today | Own Postgres database, entirely separate from NDYHUB's |
| **Storage** | Mail attachments can point at NDYHUB's own Drive storage (`MailAttachment.storageRef` → `DriveFile`) | Own object storage (DigitalOcean Spaces or similar), never touches NDYHUB's storage |
| **Auth** | Reads NDYHUB's JWT directly (same-process, `JwtAuthGuard`) | Real OIDC — NDYMAIL redirects to NDYHUB's `/oauth/authorize`, gets back its own access/refresh tokens scoped to NDYMAIL, verifies them independently (NDYHUB's public signing key, same as any OAuth relying party does) |
| **Identity source of truth** | N/A — same database | **Unchanged principle, now enforced by architecture, not just convention**: NDYHUB's `User`/`ndyId` remains the only place identity lives. NDYMAIL never stores a password, never has its own signup flow — a user without an NDY ID cannot exist in NDYMAIL at all. |
| **What NDYMAIL owns independently** | N/A | Mailbox data, message/thread/attachment data, quota state, provisioning-state policy, mail-specific audit log — all client's own explicit list, all live in NDYMAIL's own database going forward |

## 3. Migration path — moving existing data without breaking anything

The `Mail*` models (`MailAccount`, `MailFolder`, `MailThread`, `MailMessage`, `MailAttachment`, `MailEvent`) and `WorkspaceAiPolicy` currently live in NDYHUB's Postgres. Moving them out is a real data migration, sequenced to avoid downtime:

1. **Stand up the new NDYMAIL database and API**, schema identical to today's `Mail*` models (a straight copy of the existing Prisma models into a new, standalone schema — no redesign needed, they were already built cleanly separated from the rest of NDYHUB's schema).
2. **Dual-write period** (short, deliberately temporary): NDYHUB's API continues serving the existing `/ndy-mail/*` routes exactly as today, but the underlying service layer starts also writing to the new NDYMAIL database — proves the new system works with real traffic before anyone depends on it.
3. **Data backfill**: a one-time migration script copies existing `Mail*` rows (currently just the architecture/test data — no real business volume yet, confirmed by the client's own "still small" framing, which is exactly why now is the right time) into the new database.
4. **Cut over**: the NDYMAIL frontend switches to its own new domain/deployment, talking to the new NDYMAIL API directly. NDYHUB's `/ndy-mail/*` routes are decommissioned once the cutover is confirmed stable — not deleted immediately, kept dormant for a rollback window.
5. **Remove the dual-write code** once the cutover has been stable for a defined period (e.g. two weeks) — this is temporary bridge code, not permanent architecture.

**Why this order matters**: at no point does a user experience downtime or a broken login — NDYMAIL keeps working throughout, because the frontend and the "where is the data" question are decoupled by this sequencing.

## 4. What NDYMAIL keeps building on its own, post-split

Everything already built (Phases A-E, deployed) moves with it, unchanged in behavior:

- The full `MailProviderAdapter` interface + `GraphMailAdapter` (Microsoft Graph)
- `MailAccountService`, `MailSyncService`, `MailComposeService`, `MailEventService`
- Webhook reliability (`MailWebhookService`, `MailWebhookLifecycleService`)
- `MailAiPolicyService` and the `WorkspaceAiPolicy` org-ceiling model — this one needs one careful decision: `WorkspaceAiPolicy.workspaceId` currently references NDYHUB's `Workspace` model directly (a foreign key). Post-split, NDYMAIL can't have a direct database foreign key into a database it no longer shares — this becomes an API call to NDYHUB (`GET /workspaces/:id` or similar) rather than a join, resolved at read time. Flagged here as real, concrete migration work, not glossed over.
- Everything in `docs/ndy-mail-core-self-hosted-architecture.md` (the self-hosted mailbox infrastructure plan) — unaffected by this split, that document was already designed as NDYMAIL's *own* infrastructure, separate from NDYHUB's app droplet. If anything, this split makes that document's direction more clearly correct, not less.

## 5. What NDYHUB keeps owning, unchanged

- `User`, `ndyId`, `ndyCoreId`, all Passport/Trust/Signature/Proof identity work (Phase 7, Phase 8)
- The OAuth/OIDC provider itself (`authorize`, `token`, `userinfo`, `.well-known`) — NDYMAIL becomes one more client of it, alongside any future NDJOYIT product
- `Workspace`/`WorkspaceMembership` — the tenancy model NDYMAIL's org-level AI policy still needs to read from, now via API instead of a shared database
- The general `Notification` model and Notification Center UI (§ built this session) — **open question, see §7** on whether NDYMAIL keeps writing into NDYHUB's shared notification system after the split, or gets its own

## 6. New NDYMAIL OAuth client registration (concrete, mechanical step)

A real `OAuthClient` row gets created in NDYHUB for NDYMAIL itself:

```
clientId: "ndymail"
name: "NDYMAIL"
redirectUris: ["https://mail.ndyhub.com/oauth/callback"]  (or whatever domain NDYMAIL's standalone product ends up on)
allowedScopes: ["openid", "profile", "email"]
clientType: CONFIDENTIAL
```

This is the exact same mechanism any external NDJOYIT product (or, eventually, a genuine third party) would use — no special-casing NDYMAIL in NDYHUB's OAuth code at all, which is precisely the point: NDYMAIL becomes a real, ordinary relying party, proving the "NDYHUB connects the ecosystem" model actually works for more than one product before a second and third product need it too.

## 7. Open questions for the client

1. **Domain/branding for the standalone product** — does NDYMAIL get its own domain (e.g. `mail.ndyhub.com`, or something like `ndymail.com`/`ndymail.app` entirely separate from the `ndyhub.com` domain, mirroring how `outlook.com` is its own domain distinct from `microsoft.com`)? This affects the OAuth redirect URI above and how "separate product" reads to end users.
2. **Notifications**: does NDYMAIL keep writing into NDYHUB's shared Notification Center (meaning another cross-database API call, same pattern as the `WorkspaceAiPolicy` fix in §4), or does NDYMAIL get its own notification surface, with NDYHUB's bell only ever showing a summary/link out? Either is buildable — this is a real UX decision, not an engineering default.
3. **Timing relative to the self-hosted mail infrastructure work** (`docs/ndy-mail-core-self-hosted-architecture.md`) — do the standalone-product split and the self-hosted-mailbox-infrastructure build happen together, or is one sequenced before the other? They're independent pieces of work (one is "whose database/deployment," the other is "whose mail servers") but touch some of the same code, so worth sequencing deliberately rather than running both as simultaneous, uncoordinated changes.
4. **New team/infra ownership** — a second full deployment (own droplet(s), own database, own monitoring/backups) is genuinely more operational surface area than one deployment. Confirming this is accounted for in planning, not just an assumed "it'll be fine" — same spirit as the DigitalOcean cost transparency already established for the mail infrastructure work.

---

## 8. What this document deliberately does not do

No new deployment has been provisioned. No `OAuthClient` row has been created. No data migration has run. Per this project's standing discipline, this is the architecture sign-off artifact — implementation starts once the open questions in §7 are answered.
