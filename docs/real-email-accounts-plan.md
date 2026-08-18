# Plan: Real email accounts (name@ndyhub.com) for every NDY HUB user

## 1. What "real email" means, and why it's a different system than NDYMAIL

NDYMAIL (built earlier, inside NDYSPACE) is **internal-only**: it delivers
messages between NDYSPACE users identified by NDY ID, through our own
database. Nothing about it touches the public internet's email system.

What's being asked here is different: every user gets an address like
`teun@ndyhub.com` that works exactly like a Gmail or Outlook account —
someone at any company, anywhere, can email it, and the user can send to
anyone, from any device, using any mail app. That requires:

- **MX records** — tell the internet's mail servers where to deliver mail
  for `@ndyhub.com`.
- **SMTP** — the protocol for receiving and sending mail.
- **IMAP/POP3** — the protocol mail apps (Outlook, Apple Mail, Gmail app,
  Thunderbird) use to fetch a mailbox's contents.
- **SPF / DKIM / DMARC** — cryptographic proof-of-sender records that
  Gmail/Outlook/Yahoo check before deciding whether mail from
  `@ndyhub.com` is spam.
- **Deliverability reputation** — a track record, built over weeks to
  months, that convinces other providers your domain isn't a spam source.
- **Storage** — every mailbox's messages, growing indefinitely.
- **Spam/abuse handling** — inbound spam filtering, and outbound abuse
  prevention (a compromised account can't be allowed to spam the world
  from `@ndyhub.com` and get the whole domain blacklisted).
- **Webmail / mail client access** — something for the user to actually
  read and send mail from.

This is a fundamentally larger system than anything built so far in this
project. It is not a feature you bolt onto NDYSPACE in a day — it's
infrastructure most companies buy rather than build (see §4).

## 2. Existing constraint — READ THIS FIRST

**`ndyhub.com` already has live MX records**, pointing to a third-party
spam-filtering relay (`spamrelay.zxcs.nl`), with existing SPF
(`v=spf1 a mx ip4:185.104.29.176 ... include:filter-out.zxcs.nl ~all`)
and DMARC (`p=none`) records already in place. This strongly suggests
**the domain already has a working company mailbox setup** — almost
certainly NDJOYIT's actual business email (e.g. Teun's own inbox, sales@,
info@, etc.), likely through a Dutch hosting/email provider given the
`.nl` relay.

**Before any of this work starts, this must be confirmed with the client
directly**: is `ndyhub.com`'s existing mail already in active use? If so,
every option below needs to either (a) use a **different domain or
subdomain** (e.g. `mail.ndyhub.com`, or a separate domain entirely) to
avoid any risk of breaking existing company email, or (b) be coordinated
very carefully with whoever manages that existing mailbox, since MX
records only point to one place — adding a second mail system on the
same domain without care can break the first one outright, mid-flight,
for real people already relying on it.

**This plan assumes a separate subdomain (`mail.ndyhub.com`) is used**
for the new per-user mailbox system, specifically to avoid this risk.
Using the bare `ndyhub.com` domain is possible but should only happen
after the client confirms nothing there is in live use.

## 3. Two paths, compared

| | **Managed provider** (recommended) | **Self-hosted mail server** |
|---|---|---|
| What it is | Google Workspace or Microsoft 365, with mailboxes auto-created via their Admin API when a user signs up on NDY HUB | Run real mail server software (e.g. Postfix + Dovecot, or a packaged stack like Mailcow) on our own infrastructure |
| Deliverability | Excellent out of the box — Google/Microsoft's sending reputation is already trusted everywhere | Starts at zero. A fresh domain/IP sending mail for the first time is *routinely* sent straight to spam or rejected by Gmail/Outlook/Yahoo until a sending reputation is built up — this can take weeks to months of consistent, complaint-free sending |
| Ops burden | Vendor handles spam filtering, uptime, backups, security patching, abuse response | We own all of it: DKIM/SPF/DMARC correctness, blacklist monitoring (a single compromised account can get the whole domain blacklisted), TLS cert renewal for mail specifically, backup MX, disk growth, spam filtering quality |
| Cost | ~$6–15 per mailbox per month (Workspace Business Starter is ~$7.20/user/mo at time of writing; confirm current pricing) — scales with user count | Server cost is small (a modest VPS), but the *time* cost (ours, ongoing) is the real expense — mail server administration is a genuine specialty |
| Time to launch | Days (domain verification + API integration) | Weeks minimum before it's trustworthy enough to rely on, realistically longer to get deliverability solid |
| Who else does this | Nearly every company that "has email at their own domain" and isn't itself an email/hosting company | Actual email providers (Google, Microsoft, Fastmail, Proton) and companies with dedicated infrastructure teams |

**Recommendation: managed provider.** For a small droplet-hosted app with
no dedicated infrastructure team, self-hosting real internet-facing mail
is a significant, ongoing operational liability — and a broken or
spam-flagged mailbox is a support fire in a client-facing product. This
is genuinely what "like other companies do this" means in practice for a
company of this size: the mail server itself is rented, not built.

The rest of this plan is written for the **managed provider** path
(Google Workspace, since it has the most complete Admin API for
auto-provisioning — Microsoft 365 is a viable alternative with a
similar shape, noted where it differs). §7 covers self-hosting for
completeness, in case the client's decision goes that way after reading
this.

## 4. Managed-provider plan (recommended path)

### 4.1 Accounts & billing (client-side decision, not engineering)

- Client signs up for Google Workspace (or Microsoft 365) under the
  chosen domain/subdomain.
- Choose a plan tier — Business Starter (cheapest, ~30GB/mailbox) is
  enough to start; can upgrade per-mailbox later if needed.
- Billing is **per active mailbox**, so cost scales directly with user
  count — this needs to be a conscious product decision (does *every*
  NDY HUB signup get a real mailbox automatically, or is it opt-in / a
  paid tier feature?). Flagging this explicitly since it changes the
  cost model significantly at scale — 10,000 signups = 10,000 mailboxes
  = a real recurring bill, whether or not most are ever used.

### 4.2 Domain verification & DNS

- Verify domain ownership with Google (a TXT record).
- Point MX records for the **chosen subdomain** (`mail.ndyhub.com`, per
  §2) at Google's mail servers.
- Add Google's required SPF, DKIM, and DMARC records for that subdomain.
- None of this touches `ndyhub.com`'s existing root-domain MX/SPF/DMARC
  records (per §2's constraint) — the subdomain gets its own independent
  set.

### 4.3 Auto-provisioning integration (the actual engineering work)

- Google Workspace has an Admin SDK (`Directory API`) that supports
  creating a user (mailbox) programmatically via a service account with
  domain-wide delegation.
- New NestJS module, e.g. `apps/api/src/mailbox-provisioning/`:
  - On a triggering event (user completes signup, or an explicit "Get
    your @ndyhub.com email" action — product decision, see §4.1), call
    the Admin SDK to create `firstname.lastname@mail.ndyhub.com` (or
    based on NDY ID / a user-chosen handle — needs a collision-handling
    strategy, e.g. append a number on conflict).
  - Store the provisioned address on the `User` model (new column,
    small migration) so the rest of NDY HUB can reference it (e.g. show
    it on the profile/passport).
  - Handle deprovisioning on account deletion (suspend or delete the
    Workspace user) — ties into whatever account-deletion flow already
    exists.
  - Handle failure modes: Workspace API rate limits, quota exceeded
    (need to buy more licenses), name collisions, the Workspace account
    itself being suspended for billing reasons.
- Credentials: a Google Cloud service account JSON key with domain-wide
  delegation scoped narrowly to user-provisioning only — stored the same
  way other secrets in this app are (`.env.prod`, never committed).

### 4.4 User-facing access

Users need a way to actually *use* their new mailbox. Options, not
mutually exclusive:
- **Point them to Gmail's own web/app interface** — simplest, zero
  additional engineering, but it's a jarring context-switch away from
  NDY HUB's own UI and brand.
- **Embed/link out clearly from NDYSPACE** — a "Your Email" launcher
  card/nav item (visually consistent with the rest of NDYSPACE) that
  deep-links to Gmail's webmail for that account, or triggers Gmail's
  app on mobile.
- **Build a real webmail client against Google's Gmail API inside
  NDYSPACE** — lets mail live natively inside the NDY HUB UI instead of
  bouncing to Gmail's own interface. This is a genuinely large, separate
  engineering effort (OAuth per-user consent for Gmail API scopes,
  building inbox/compose/read UI against the Gmail API) — scope this as
  its own follow-up project if wanted, not bundled into the initial
  mailbox rollout.

**Recommendation for v1**: option 2 (a clearly-branded launcher that
opens Gmail) — get real, working mailboxes live fast without taking on
the scope of a full custom webmail client. Revisit option 3 later if
there's a real product reason NDYSPACE needs mail natively rendered
in-app rather than in Gmail's own (perfectly good) interface.

### 4.5 Rollout sequencing

1. Confirm with client: is `ndyhub.com` root domain's existing mail live?
   (blocks everything else)
2. Client sets up Google Workspace account + billing tier decision (does
   every user get one, or is it opt-in/paid) — also blocks engineering
   start, since the provisioning trigger depends on this.
3. Domain/subdomain verification + DNS (engineering + client's DNS
   access, likely the DigitalOcean-managed zone or wherever `ndyhub.com`
   is actually hosted — confirm).
4. Build the provisioning module + `User` model column + admin/error
   handling.
5. Build the "Your Email" launcher UI (§4.4 option 2).
6. Test end-to-end with 2-3 real test accounts before enabling for all
   users — confirm mail actually sends/receives correctly, confirm
   deprovisioning works, confirm the launcher deep-links correctly on
   both desktop and mobile.
7. Enable for new signups; decide separately whether to backfill
   mailboxes for existing users (a bulk-provisioning job) or only
   provision going forward.

### 4.6 Ongoing costs & ownership (be explicit with the client about this)

- Recurring per-mailbox billing, indefinitely, scaling with user count.
- Someone needs to own the Workspace admin console (billing, suspended
  accounts, abuse reports forwarded by Google, support escalations).
- This is a real, ongoing product commitment, not a one-time build.

## 5. What this plan deliberately does NOT include

- A custom-built webmail client (see §4.4 — scoped as an optional
  follow-up, not part of getting real mailboxes live).
- Self-hosted mail infrastructure (see §7 for why it's not the
  recommendation, kept here only for completeness).
- Migrating NDYMAIL's existing internal messages into the new real
  mailboxes — these stay two separate systems. NDYMAIL keeps working
  exactly as it does today for in-app NDYSPACE-to-NDYSPACE messaging;
  this plan adds real external email as an additional, separate
  capability.
- A decision on whether every user gets a mailbox automatically or it's
  opt-in/paid — flagged in §4.1/§4.5 as a required product decision
  before engineering can start, not an engineering decision.

## 6. Estimated effort (engineering only, once client-side decisions in §4.1/§4.5 step 1 are made)

- Domain/DNS verification: hours, mostly waiting on DNS propagation.
- Provisioning module + User model column + error handling: a few days
  of focused work.
- Launcher UI: under a day.
- End-to-end testing + rollout: a few days, mostly careful verification
  rather than raw build time.

Realistic total: **1–2 weeks** of engineering time for the recommended
(managed-provider, Gmail-webmail-launcher) path, assuming the client-side
account setup and domain-ownership questions in §2 and §4.1 are resolved
first. A custom in-app webmail client (§4.4 option 3) would roughly
double or triple that.

## 7. Appendix: self-hosted mail server (not recommended, included for completeness)

If the client specifically wants to own the mail server rather than pay
a managed provider:

- Realistic stack: **Mailcow** (a packaged, Docker-based mail server
  bundling Postfix, Dovecot, Rspamd, SOGo webmail, and a management UI) —
  far more approachable to stand up and maintain than hand-rolling raw
  Postfix/Dovecot, and it ships its own webmail (SOGo), which covers
  §4.4's "how do users actually read mail" question without extra work.
- Needs its **own dedicated server** (not sharing the existing app
  droplet) — mail servers have different security/hardening needs and
  you don't want a mail server compromise to be a path into the main app
  server, or vice versa.
- Needs a **static IP with clean reputation** (a fresh DigitalOcean IP
  has no history — good and bad: no existing blacklist entries, but also
  zero trust built up; PTR/reverse-DNS record must be set correctly,
  which requires coordination with the hosting provider).
- Realistic deliverability timeline: expect mail to land in spam
  folders at Gmail/Outlook for the first several weeks even with
  correct SPF/DKIM/DMARC, until sending volume and complaint rate build
  a track record. This is not a configuration problem to be solved —
  it's inherent to how every major provider's spam filtering works.
- Ongoing ownership: blacklist monitoring (multiple free services check
  this, e.g. mxtoolbox), backup strategy for the mail server's own
  storage (separate from the app's Postgres backups), security patching
  on a genuinely different cadence than the app server since mail
  servers are a common attack target, and someone on-call for "mail is
  down" the same way the app itself needs on-call coverage today.
- Cost is server-only (a modest VPS, well under managed-provider
  per-mailbox pricing at any real scale) but the *time* cost is
  substantial and ongoing — this is the trade being made, not a free
  alternative.

**Bottom line**: self-hosting is viable long-term for a company that
wants to fully own its infrastructure and is willing to invest in
learning/maintaining real mail server operations, but it is not a
faster or cheaper path to "working real email for our users" in the
near term. The managed-provider path is the recommended default.
