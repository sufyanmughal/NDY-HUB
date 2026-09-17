# NDY Mail Core — Self-Hosted Mailbox Infrastructure (v2 direction)

**Status: architecture proposal, not yet built.** Supersedes the single-mailbox self-hosting guide (`docs/self-hosted-mail-server-setup.md`) with the client's actual long-term vision: mass NDYMAIL identity provisioning for every NDY ID, not a one-off mailbox for the founding team. Written before any infrastructure is provisioned or code is written, per this project's standing discipline.

**This is a direct response to the client's own message** (relayed 2026-08-28), which is quoted/addressed section by section below so nothing in his direction is silently dropped or reinterpreted.

---

## 0. What the client actually asked for

1. Every NDY ID eventually gets a provisioned `@ndyhub.com` NDYMAIL identity — `NDY-MBR-123456` → `NDY-MBR-123456@ndyhub.com` — automatically, at scale, for potentially very large user counts.
2. Not built around paying Microsoft per-mailbox for every user — move toward NDY-owned mailbox infrastructure.
3. **Keep the Microsoft Graph adapter** — it remains a real provider option (connected external accounts, enterprise/fallback use), not thrown away.
4. Don't underestimate deliverability — use a **professional outbound relay/delivery layer**, not raw self-hosted SMTP, to protect `ndyhub.com`'s reputation.
5. A provisioning state machine — `RESERVED → ACTIVATED → VERIFIED → FULL MAILBOX` — so creating an NDY ID reserves the identity without immediately consuming full mailbox resources.
6. A full list of day-one requirements: quotas, rate limits, anti-spam/anti-abuse, bot protection, SPF/DKIM/DMARC, bounce handling, malware scanning, backups, monitoring, suspension controls, audit logging, storage scaling, reputation monitoring.
7. A concrete recommendation: DigitalOcean infrastructure sizing, backup strategy, monthly cost estimate, and which relay service to use.

## 1. The architecture, mapped onto what already exists

```
NDJOYIT Registration
        ↓
NDYHUB Identity (existing — User, ndyId)
        ↓
NDY ID + NDY Passport (existing — Phase 7/8 work)
        ↓
NDYMAIL Identity Provisioning (NEW — this document, §3)
        ↓
NDY Mail Core (existing — MailAccount/MailFolder/MailThread/MailMessage, already deployed)
        ↓
NDY-Owned Mailbox Infrastructure (NEW — §4: self-hosted Postfix/Dovecot cluster)
        ↓
Professional Delivery/Relay Layer (NEW — §5: Amazon SES, recommended below)
```

Everything above "NDY Mail Core" already exists and is live in production (Phase A-E, deployed). This document only designs the two new layers below it: the provisioning state machine and the actual mailbox infrastructure + relay.

**Microsoft Graph adapter status: unchanged, kept exactly as-is.** `GraphMailAdapter` remains a fully valid `MailProviderAdapter` implementation for users who want to connect an external Microsoft account, or for enterprise/business workspaces that prefer it. Nothing about this document removes or deprecates it. The new `NdyNativeMailAdapter` (§6) is simply a second, additional adapter implementing the same interface — this is exactly what the adapter pattern was built for.

## 2. Why raw self-hosted SMTP alone is the wrong call (client's own instinct, confirmed)

The client's instinct in his message — don't risk `ndyhub.com`'s reputation on a brand-new mail server sending directly — is correct and matches the deliverability risk already flagged in the earlier single-server guide. The fix isn't "don't self-host," it's **separate mailbox storage from outbound delivery**:

- **Mailbox storage/IMAP** (where mail lives, what NDYMAIL reads) — self-hosted, NDY-owned. This is where cost savings at scale actually come from.
- **Outbound delivery** (the actual SMTP handoff to the receiving world) — routed through a professional relay service with an already-established sending reputation, so `ndyhub.com`'s deliverability doesn't depend on a brand-new server's unproven reputation.

This is a completely standard, common architecture (most SaaS products with their own "from our platform" email do exactly this) — it is not a compromise or a hack.

### 2.1 The critical detail: inbound vs. outbound port blocking

DigitalOcean blocks **outbound** connections on ports 25/465/587 from every droplet by default, specifically to stop the platform being used for spam — this is a hard default, not something reliably lifted just by asking (DigitalOcean's own current documentation actively recommends against self-hosting mail at all and doesn't guarantee unblocking on request).

**This is exactly why SES is the right fix, not a workaround**: SES entirely replaces the droplet's need to make *outbound* SMTP connections at all — Postfix hands outbound mail to SES over SES's own authenticated API/SMTP endpoint (which isn't subject to DigitalOcean's port block, since it's a different, permitted kind of outbound connection), and SES's own already-trusted infrastructure does the actual delivery to Gmail/Outlook/Yahoo/etc.

**Inbound is the separate question, and the evidence is favorable but needs one final confirmation**: multiple independent sources (DigitalOcean's own community answers among them) consistently describe the port block as outbound-only — a droplet's port 25 stays open to *receive* connections from other mail servers trying to deliver mail to it via your MX record, since that's normal, expected mail-server behavior, not the abuse pattern the block exists to prevent. Given how central this is to the whole plan working, **the responsible next step before provisioning is a direct DigitalOcean support ticket explicitly confirming inbound port 25 is open on this account** (some documentation also mentions requesting "both inbound and outbound" unblocking as a formal process, so this should be nailed down with DigitalOcean directly rather than assumed from public docs alone) — cheap and fast to confirm, and removes any doubt before real infrastructure spend commits to this design.

### Relay service recommendation: Amazon SES

| Service | Cost at scale | Notes |
|---|---|---|
| **Amazon SES** | **$0.10 per 1,000 emails** (~$100/month at 1M emails, ~$10/month at 100K) | Recommended. By far the cheapest at any real volume, integrates cleanly with a self-hosted Postfix relay config, backed by AWS's own long-established sending reputation. |
| Postmark | ~$10 minimum, scales up, best-in-class deliverability reputation | Considered — better "white glove" deliverability tooling, but list pricing lands at $650-1,300+/month at 1M emails vs. SES's ~$100. Worth it only if SES's deliverability proves insufficient in practice. |
| SendGrid | ~$15 minimum, similar scaling to Postmark | Not recommended as primary — priced for marketing-email use cases, not the leanest fit for transactional-only NDYMAIL traffic. |

**Recommendation: start with Amazon SES.** It's the only option that stays genuinely cheap as NDY ID count grows into the thousands+ the client is planning for — this directly serves his stated goal ("architecture must already be designed for mass provisioning"). If real-world deliverability data later shows SES underperforming for a specific use case, Postmark is the fallback, not a reason to avoid starting with SES.

**Important nuance on inbound mail**: SES is primarily an *outbound* relay. Inbound mail (`external sender → NDY-MBR-123456@ndyhub.com`) still needs to actually arrive at your self-hosted mail server directly via MX records pointing at it — SES doesn't replace that. SES's role here is specifically: your self-hosted Postfix relays *outbound* mail through SES rather than sending directly from your own droplet's IP, which is what protects `ndyhub.com`'s reputation. (SES also has an inbound-receiving feature, which is a valid alternative worth evaluating in a later phase, but isn't required for the outbound-reputation-protection goal this document is solving for now.)

## 3. NDYMAIL Identity Provisioning — the state machine

Directly implements the client's `RESERVED → ACTIVATED → VERIFIED → FULL_MAILBOX` requirement, refined by his follow-up message into a precise, per-state meaning:

```prisma
enum NdyMailboxProvisioningState {
  RESERVED      // permanent NDYMAIL identity created — address exists, zero resources consumed
  ACTIVATED     // mailbox is actually provisioned (real Postfix/Dovecot mailbox exists)
  VERIFIED      // identity/security/trust requirements passed
  FULL_MAILBOX  // normal NDYMAIL capabilities + appropriate sending/storage limits unlocked
}
```

- **RESERVED**: the default, zero-cost state every NDY ID is in the moment it's created — this is already effectively true today, since `mailAddressForNdyId()` is a pure function requiring no stored state (see `docs/ndymail-architecture-design.md` §9). The permanent address belongs to the NDY ID immediately; no backend resource is touched.
- **ACTIVATED**: the trigger differs by account type, per the client's explicit direction —
  - **Founder / Leadership / Core team identities**: automatic activation — no user action required, the mailbox is provisioned as soon as the identity itself is created/assigned.
  - **Ordinary members**: activation happens when the member starts actually using NDYMAIL *and* meets the required account/security conditions (the specific conditions are configurable policy, not hardcoded — see below). This is the real protection against unnecessary storage/bot registrations the client asked for: a fake or dormant registration never consumes a real mailbox.
- **VERIFIED**: deliberately **not** "clicked an email verification link" — that's necessary at signup but not sufficient here. This state requires real NDYHUB identity/account verification, verified contact information, and passing the anti-abuse/risk checks in §7. Explicitly designed to integrate with **NDY Trust** later (see `docs/phase8-signature-trust-design.md`) — a higher Trust level should be able to unlock stronger sending limits and additional NDYMAIL capabilities without a redesign of this state machine, since Trust evaluation was already built as a live, policy-driven check rather than a cached value (same "never trust a cached value, always re-evaluate the live policy" principle Phase 8 already established).
- **FULL_MAILBOX**: normal capabilities, sending limits, and storage limits unlocked — the actual "usable mailbox" state a member experiences.

**Configurable policy, not hardcoded rules** — the client's explicit requirement, since the verification/Trust model will keep evolving. Concretely: the conditions that gate each transition (what counts as "the required account/security conditions" for member `ACTIVATED`, what NDY Trust level is "enough" for `VERIFIED`, what limits apply at `FULL_MAILBOX`) live in a small policy table/service (`MailProvisioningPolicyService` or similar), not as inline `if` statements scattered through `MailAccountService` — the same "policy as data, re-evaluated live" pattern already used for `WorkspaceAiPolicy` (§10.3 of `docs/ndymail-architecture-design.md`), so tightening or loosening the rules later is a data change, not a code change.

This state lives on `MailAccount` (already deployed) as a new field — `provisioningState`, defaulting to `RESERVED` for the address computed by `mailAddressForNdyId()`, with no `MailAccount` row created at all until `ACTIVATED` (matching the existing pattern where `officialMailAddress` in `GET /auth/me` is already shown without a real `MailAccount` row existing — see `docs/ndymail-architecture-design.md` §9's "provisioning the address/identity, not standing up a real mailbox backend").

`NDY-CEO-000001@ndyhub.com` remains the **Genesis mailbox** — the first `FULL_MAILBOX`-state account and the first complete end-to-end production test, per the client's explicit confirmation.

## 4. NDY-Owned Mailbox Infrastructure — sizing for scale

Unlike the single-server guide, this needs to be designed for growth from the start, per the client's explicit "build the foundation correctly now" instruction.

### Recommended initial setup

| Component | Sizing | Monthly cost (DigitalOcean) |
|---|---|---|
| Mail server droplet (Mailcow — Postfix/Dovecot/spam filtering, as in the single-server guide) | 8GB RAM / 4 vCPU — doubled from the single-mailbox guide's 4GB/2vCPU to handle real concurrent IMAP connections and spam-filtering load as mailbox count grows | ~$48/month |
| Object storage (mailbox data, once volume outgrows the droplet's own disk) | DigitalOcean Spaces, starts at 250GB | ~$5/month to start, scales with usage |
| Backups | 20% of droplet cost | ~$9.60/month |
| Load balancer (not needed at launch — flagged for when a second mail server is added, see §8) | — | $0 initially |
| Amazon SES (relay) | Pay-as-you-go, ~$0.10/1,000 emails | Scales with actual send volume — negligible at low volume, ~$100/month at 1M emails/month |
| **Total to start** | | **~$65-75/month**, not counting SES's usage-based cost |

This is a **separate droplet from the existing NDYHUB app droplet** — same reasoning as the single-server guide's §0 (the app droplet doesn't have spare capacity for this).

### Storage scaling plan

Start every `FULL_MAILBOX` account with a **modest default quota** (e.g. 1-2GB) rather than an unlimited allocation — directly serves the client's "protecting against unnecessary storage usage" concern. Mailcow supports per-mailbox quotas natively. Storage growth is handled by monitoring total disk usage and either resizing the droplet's disk or migrating to DigitalOcean Spaces-backed storage once volume genuinely requires it — not provisioned speculatively on day one.

## 5. The relay integration (technical shape)

Postfix (running on the mail droplet) is configured with SES as its **smart host** for outbound delivery — a standard, well-documented Postfix configuration pattern (`relayhost` pointing at SES's SMTP endpoint, with SES SMTP credentials, over port 587 with STARTTLS). Inbound mail still terminates directly at the mail droplet via the MX record, unaffected by this.

This is genuinely simple to configure — a few lines in Postfix's `main.cf` — the complexity in this whole document is in the provisioning/abuse-control layers around it, not the relay wiring itself.

## 6. New adapter: `NdyNativeMailAdapter`

Implements the existing `MailProviderAdapter` interface (`apps/api/src/ndy-mail/adapters/mail-provider-adapter.interface.ts`) — the same interface `GraphMailAdapter` already implements, unchanged. Talks to the self-hosted Mailcow instance via standard IMAP/SMTP rather than Microsoft Graph's REST API. Registered in `MailProviderRegistry` alongside Graph, not replacing it (§1's explicit "keep Graph" requirement).

**Auth model differs from Graph**: Graph uses OAuth (a browser redirect through Microsoft). A self-hosted IMAP/SMTP mailbox NDYHUB itself provisions doesn't need OAuth at all — NDYHUB already controls the credentials, since it created the mailbox. `finishConnect`'s OAuth-code-exchange flow doesn't apply here; instead, `MailAccountService` provisioning a `FULL_MAILBOX`-state account can directly generate and store the mailbox's credentials (encrypted, same `mail-token-crypto.util.ts` mechanism already in place) without any user-facing OAuth redirect at all. This is simpler than the Graph flow, not more complex — no external consent screen involved.

## 7. Anti-abuse, security, and operational controls — the client's full checklist

Addressed item by item, each mapped to a concrete mechanism:

| Requirement | Mechanism |
|---|---|
| **Mailbox quotas** | Per-mailbox storage limit in Mailcow (§4), enforced at the `FULL_MAILBOX` provisioning step |
| **Sending rate limits** | Postfix's built-in per-sender rate limiting (`smtpd_client_connection_rate_limit` and similar) + an application-level check in `MailComposeService.send()` (already the single choke point every outbound send goes through — a rate-limit check added there covers every send path without new plumbing) |
| **Anti-spam / anti-abuse controls** | Rspamd (inbound, already part of current Mailcow — replaced SpamAssassin entirely as of the 2026-07 release) + outbound abuse monitoring: flag accounts whose sent mail generates unusual bounce/complaint rates for review |
| **Bot protection** | Gate `ACTIVATED`→`VERIFIED` transition behind existing NDYHUB signals already available — `verificationLevel` (LEVEL_1+ email-verified minimum), account age threshold, and reuse of whatever CAPTCHA/bot-detection already exists on signup (not duplicated here) |
| **SPF / DKIM / DMARC** | Exactly as in the single-server guide (§3, §6 there) — unchanged, still required regardless of the relay layer |
| **Bounce handling** | SES provides bounce/complaint notifications via SNS — wire these into a new `MailEvent` type (`mail.bounced`) so a bounced/complained-about address can automatically pause further sends to it, protecting sender reputation |
| **Malware/attachment scanning** | ClamAV, already part of Mailcow's stack (mentioned in the single-server guide, confirmed as a real requirement here, not optional) |
| **Backups** | DigitalOcean droplet backups (§4) at minimum; consider a separate off-droplet backup of mailbox data (e.g. to DigitalOcean Spaces) for real disaster-recovery, not just droplet-snapshot recovery |
| **Monitoring** | Mailcow's own admin panel covers basic mail-queue/mailbox health; server-level monitoring (disk, memory, mail queue depth) should use whatever monitoring NDYHUB's own droplet already has set up (Phase 9's "Backup, DR & monitoring hardening" — extend that existing setup to the new droplet rather than standing up a second monitoring system) |
| **Mailbox suspension controls** | A `SUSPENDED` addition to the provisioning state enum (§3) — admin-triggered, immediately stops send/receive without deleting mailbox data, reversible |
| **Audit logging** | `SecurityEvent` (already the established pattern for mail-account-lifecycle events — connect/disconnect/reauth already use this, per `docs/ndymail-architecture-design.md`'s corrected Phase D notes) extended with new event types for provisioning-state transitions and admin suspension actions |
| **Storage scaling** | Covered in §4 |
| **Reputation/deliverability monitoring** | Google Postmaster Tools (free, Gmail-specific visibility) + periodic blacklist checks (mxtoolbox.com, as in the single-server guide) — recommend a scheduled check (reusing the same `setInterval`-based job pattern already established in `MailWebhookLifecycleService`, §C of the original NDYMAIL build) rather than a manual routine anyone has to remember to run |

## 8. What this document deliberately does not do yet

- No infrastructure has been provisioned (no new droplet created).
- No code has been written (`NdyNativeMailAdapter`, the provisioning-state schema changes, the rate-limit/bounce-handling additions to `MailComposeService`/`MailEventService` — all designed here, none built).
- **Multi-server/load-balanced mail infrastructure** (needed only once mailbox count genuinely outgrows one droplet) is explicitly out of scope for this first pass — flagged in §4 as a later addition, not a day-one requirement, consistent with the client's own "we don't have to provision unlimited resources immediately" instruction.
- SES inbound-receiving as an alternative to direct MX delivery (§2's nuance) is flagged but not adopted in this pass.

## 9. Recommended build order

1. Provision the new mail droplet (§4), install Mailcow, configure DNS (same steps as the single-server guide, §1-8 there) — this can start immediately, independent of any code changes.
2. Configure Postfix→SES relay (§5) — a config change on the same droplet, not a separate infrastructure step.
3. Schema: add `provisioningState` to `MailAccount`, add `SUSPENDED` state, new `SecurityEventType` values for provisioning transitions.
4. Build `NdyNativeMailAdapter` (§6) implementing the existing interface.
5. Build the abuse-control layer (§7): rate limiting in `MailComposeService`, bounce-event wiring from SES, the `ACTIVATED`→`VERIFIED` gate logic.
6. Test end-to-end with the first real mailbox (`NDY-CEO-000001@ndyhub.com` or whichever is chosen first) before opening `ACTIVATED` self-service to any broader user base.

---

## Open questions for the client

1. **Which NDY ID gets `FULL_MAILBOX` status first** — same `NDY-CEO-000001` milestone as originally planned, or does the new provisioning-state model change that choice?
2. **What exactly triggers `ACTIVATED`** — is it purely user-initiated ("I want a real NDYMAIL address"), or automatically triggered for certain account types (e.g. all founding/leadership IDs auto-activate, ordinary members must opt in)?
3. **`VERIFIED` threshold specifics** — what verification level/account-age/other signal is "enough" to trust an account with a full mailbox? This is a real anti-abuse policy decision, not something to default silently.
4. **SES vs. self-hosted inbound** — confirmed SES for outbound relay; are you comfortable with self-hosted Mailcow handling inbound directly (§2's nuance), or would you prefer evaluating SES's own inbound-receiving feature as an alternative in a later phase?
