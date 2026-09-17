# ndyhub.com — Microsoft 365 custom domain setup for NDYMAIL

**Who this is for**: Teun, or whoever holds `ndyhub.com`'s DNS and will create the Microsoft 365 tenant. This is the exact checklist for docs/ndymail-architecture-design.md §10.1's decision (`ndyhub.com` as a real, receiving-and-sending custom domain — not a display alias).

**Status**: no tenant exists yet. Every value below except the actual DNS records (which Microsoft/Google generates per-tenant at setup time) can be prepared now; the exact record *values* only exist once the tenant itself is created — step 1 below.

---

## 1. Platform recommendation: Microsoft 365, not Google Workspace

Matches what's already built (`GraphMailAdapter` is the only implemented provider adapter — Phase A, already deployed) and the client's own instruction ("start with Microsoft Graph as the first provider adapter"). Google Workspace is architecturally just as supported later (the adapter interface doesn't care), but there's no reason to stand up a second tenant/platform for Phase 1 when Graph is already the one being built against.

## 2. What to create/purchase

1. **A Microsoft 365 tenant** if one doesn't already exist for NDJOYIT. Any plan that includes Exchange Online mailboxes works — **Microsoft 365 Business Basic** is the cheapest that includes a real mailbox per user; **Business Standard** if desktop Outlook access matters too. One license is enough to start (for the first mailbox, `NDY-CEO-000001@ndyhub.com`) — add more licenses per additional mailbox as they're provisioned.
2. **An Azure AD App Registration** inside that same tenant — this is what produces `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET`, the credentials the already-deployed code is waiting on. Steps:
   - Azure Portal → **Azure Active Directory** (now called **Microsoft Entra ID**) → **App registrations** → **New registration**.
   - Name: e.g. "NDYHUB NDYMAIL Integration".
   - Supported account types: **Accounts in this organizational directory only** (single tenant — NDYMAIL only ever needs to talk to NDJOYIT's own tenant, not act on behalf of arbitrary outside organizations).
   - Redirect URI: **Web** — `https://ndyhub.com/api/ndy-mail/accounts/callback` (must match `GRAPH_REDIRECT_URI` exactly, including scheme/path — this is already the route the deployed code listens on).
   - After creation: **Certificates & secrets** → **New client secret** → copy the *value* immediately (Azure only shows it once). That's `GRAPH_CLIENT_SECRET`.
   - **Overview** page shows **Application (client) ID** — that's `GRAPH_CLIENT_ID`.
   - **API permissions** → add (Microsoft Graph, **Delegated permissions**): `Mail.Read`, `Mail.Send`, `offline_access`, `User.Read`. These match exactly what `GraphMailAdapter` requests (see `apps/api/src/ndy-mail/adapters/graph/graph-mail.adapter.ts`'s `GRAPH_SCOPES`) — nothing broader.
3. Once you have the tenant, Client ID, and Client Secret: send those three values back and I'll set `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_REDIRECT_URI` in production — that's the one remaining blocker on the code side.

## 3. Adding `ndyhub.com` as a custom domain in the tenant

Inside the Microsoft 365 admin center (admin.microsoft.com) → **Settings** → **Domains** → **Add domain** → enter `ndyhub.com`. Microsoft will generate the *exact* verification/MX/autodiscover records for your tenant at this step — the values below are the standard *shape* every M365 custom domain needs, but the real hostnames/priorities are tenant-specific and only appear once you start this wizard. Do this step, then send me (or paste directly) whatever Microsoft's wizard shows — I'll confirm it matches what's expected before you apply it.

### 3a. Domain ownership verification (first step of the wizard)

Microsoft gives you **one** of these (usually a TXT record) to prove you control `ndyhub.com`:

| Type | Host | Value |
|---|---|---|
| TXT | `@` (root) | `MS=msXXXXXXXX` (exact value shown by the wizard) |

### 3b. Mail routing — MX record (this is what makes `@ndyhub.com` actually receive mail)

| Type | Host | Value | Priority |
|---|---|---|---|
| MX | `@` (root) | `ndyhub-com.mail.protection.outlook.com` (exact value shown by the wizard — the tenant-specific segment before `.mail.protection.outlook.com` varies) | `0` |

**This is the record that matters most** — it's what makes real inbound delivery to `NDY-CEO-000001@ndyhub.com` work per §10.1's decision, replacing whatever MX record `ndyhub.com` has (or doesn't have) today. If `ndyhub.com` currently has any other mail routing configured (e.g. forwarding through a different provider), that needs to be removed/replaced, not layered alongside this one — two MX records pointing at different mail systems for the same domain causes delivery to become unpredictable.

### 3c. Autodiscover (lets Outlook/mobile mail clients auto-configure)

| Type | Host | Value |
|---|---|---|
| CNAME | `autodiscover` | `autodiscover.outlook.com` |

### 3d. SPF (required — tells other mail servers Microsoft is allowed to send as `@ndyhub.com`)

| Type | Host | Value |
|---|---|---|
| TXT | `@` (root) | `v=spf1 include:spf.protection.outlook.com -all` |

If `ndyhub.com` already has an SPF TXT record from another service, they must be **merged into one record** (a domain can only have one SPF TXT record — multiple SPF records is itself an RFC violation that causes SPF checks to fail). Send me what's currently there if anything, and I'll give you the merged value.

### 3e. DKIM (required for good deliverability — signs outbound mail)

Two CNAME records, generated per-tenant inside **Microsoft 365 Defender** → **Email & collaboration** → **Policies & rules** → **Threat policies** → **DKIM** → select `ndyhub.com` → it shows two CNAME values to add, then you enable DKIM signing after they're added:

| Type | Host | Value |
|---|---|---|
| CNAME | `selector1._domainkey` | `selector1-ndyhub-com._domainkey.<tenant>.onmicrosoft.com` (exact value from the DKIM setup page) |
| CNAME | `selector2._domainkey` | `selector2-ndyhub-com._domainkey.<tenant>.onmicrosoft.com` (exact value from the DKIM setup page) |

### 3f. DMARC (required — tells receiving mail servers what to do if SPF/DKIM fail, and gives visibility into spoofing attempts)

| Type | Host | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@ndyhub.com; adkim=s; aspf=s` |

Recommend starting at `p=quarantine` (suspicious mail gets flagged, not silently dropped) rather than `p=reject` until DKIM/SPF have been running cleanly for a couple of weeks with real traffic — this is standard DMARC rollout practice, not a Phase-1-specific compromise. `rua=mailto:dmarc-reports@ndyhub.com` needs that inbox to actually exist to receive the aggregate reports — can point elsewhere (a mailbox you already have) if `dmarc-reports@` isn't provisioned yet.

## 4. Order of operations

1. Create the M365 tenant + first user license.
2. Create the Azure AD App Registration (§2.2) — send me Client ID + Secret, I wire it into production immediately, independent of DNS being done yet (lets connect-flow testing start against a test mailbox before `ndyhub.com` itself is fully verified).
3. Start "Add domain" wizard for `ndyhub.com` in M365 admin center — get the real verification TXT value.
4. Add the verification TXT record at your DNS provider → confirm verification in M365 admin center.
5. Add MX, autodiscover CNAME, SPF, DKIM CNAMEs, DMARC (§3b–3f) — M365's domain wizard will actually tell you when each is correctly detected, so this can be done incrementally and re-checked via the same admin page rather than needing to get everything perfect in one sitting.
6. Create the actual mailbox for `NDY-CEO-000001@ndyhub.com` inside M365 admin center (**Users** → **Active users** → assign/create with that exact address) — once this exists, I connect it through NDYMAIL's OAuth flow and this becomes the "first real mailbox activated end-to-end" milestone.

## 5. What I need back from you at each step

- After step 2: **Application (client) ID** and **Client Secret value**.
- After step 3: whatever exact verification TXT/MX/DKIM values the M365 wizard shows (paste them here or send a screenshot) — I'll double check them against what's expected before you commit them at your DNS provider, so there's a second pair of eyes before a live domain's mail routing changes.
- After step 6: just tell me the mailbox exists — I'll do the actual OAuth connect + verification from the NDYMAIL/NDYHUB side.

## 6. What NOT to do

- Don't remove any *existing* DNS records for `ndyhub.com` (A/CNAME for the website, any other TXT records) — only mail-routing-related records (MX, mail-relevant TXT/CNAME above) are being added/changed here.
- Don't set DMARC to `p=reject` on day one (§3f) — start at `quarantine`.
- Don't grant broader Azure AD API permissions than the four listed in §2.2 — the deployed adapter code only ever requests those four scopes; anything broader granted at the app-registration level is unused surface area, not a functional requirement.
