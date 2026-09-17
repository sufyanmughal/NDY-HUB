# Step 3 of 3 — Add `ndyhub.com`'s DNS Records

**Goal of this step**: connect your real domain, `ndyhub.com`, to the Microsoft 365 tenant, so `NDY-CEO-000001@ndyhub.com` can actually send and receive real email — not just display the address inside NDYHUB.

**Requires**: Step 1 completed (tenant exists). Can be done independently of Step 2.

**Time needed**: ~20 minutes of your active time, but expect this to take up to 24-48 hours in total, since DNS changes take time to propagate around the internet, and Microsoft double-checks each record before considering the domain fully verified.

**You keep full control of the DNS the whole time** — I only ever confirm values with you before you enter them at your registrar. I never need or ask for access to `ndyhub.com`'s DNS settings.

---

## 3.1 Start the "Add domain" wizard

1. Go to **https://admin.microsoft.com** and sign in.
2. In the left-hand menu, go to **Settings → Domains**.
3. Click **+ Add domain**.
4. Type `ndyhub.com` exactly, click **Use this domain**.

Microsoft now shows you a **verification record** — usually a TXT record starting with `MS=ms` followed by a string of numbers. This proves to Microsoft that you actually control `ndyhub.com`.

**Copy this exact value** and send it to me before adding it — I'll confirm it looks right, then you add it at your DNS provider (wherever `ndyhub.com`'s DNS is currently managed — GoDaddy, Cloudflare, Namecheap, etc.).

## 3.2 Add the verification TXT record

At your DNS provider's control panel, add a new DNS record:

| Field | Value |
|---|---|
| Type | `TXT` |
| Host / Name | `@` (this usually means "the root domain itself," i.e. `ndyhub.com` with nothing in front — some providers want you to leave this blank instead of typing `@`, check your provider's own help text) |
| Value | the exact `MS=ms...` string Microsoft showed you |
| TTL | leave at default, or 1 hour if asked |

Save it. Back in the Microsoft 365 wizard, click **Verify**. This can take a few minutes up to a few hours to succeed, depending on how fast your DNS provider propagates changes — if it fails immediately, wait 15 minutes and try **Verify** again before assuming something's wrong.

## 3.3 Add the remaining records Microsoft shows you

Once verification succeeds, Microsoft's wizard will show you a full list of records to add — this is the important part, since these are what actually make mail send and receive correctly. **Do not skip any of these** — a domain that's only "verified" but missing the MX/SPF/DKIM records won't actually receive or send mail correctly.

Add each of these at the same DNS provider:

### MX record — makes `@ndyhub.com` receive mail (the most important one)

| Field | Value |
|---|---|
| Type | `MX` |
| Host / Name | `@` |
| Value / Points to | Microsoft will show something like `ndyhub-com.mail.protection.outlook.com` — **use the exact value the wizard shows you**, not this example |
| Priority | `0` |

**⚠️ Important**: if `ndyhub.com` currently has *any other* MX record already (e.g. pointing somewhere else for existing email), that old one needs to be **deleted, not left alongside this new one**. Two MX records for the same domain pointing at different mail systems causes mail delivery to become unreliable. Check your DNS panel for any existing MX records before adding this one — if you're not sure whether one exists or is safe to remove, send me a screenshot of your current DNS records first and I'll tell you.

### CNAME — autodiscover (lets Outlook/mobile apps auto-configure)

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host / Name | `autodiscover` |
| Value | `autodiscover.outlook.com` |

### TXT — SPF (tells other mail servers Microsoft is allowed to send as you)

| Field | Value |
|---|---|
| Type | `TXT` |
| Host / Name | `@` |
| Value | `v=spf1 include:spf.protection.outlook.com -all` |

**⚠️ Check first**: if `ndyhub.com` already has *any* TXT record starting with `v=spf1` (from a different email service, a marketing tool, etc.), you **cannot just add a second one** — a domain is only allowed one SPF record, and having two breaks SPF entirely. If one already exists, copy its exact current text and send it to me — I'll give you back one single merged value that covers both.

### 2× CNAME — DKIM (signs your outbound mail so it doesn't land in spam)

These aren't shown in the main domain wizard — you get them from a separate page:

1. Go to **https://security.microsoft.com** (Microsoft 365 Defender)
2. **Email & collaboration → Policies & rules → Threat policies → DKIM**
3. Select `ndyhub.com` from the list
4. It will show you two CNAME values to add — something like:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host / Name | `selector1._domainkey` |
| Value | *(exact value shown on this page)* |

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host / Name | `selector2._domainkey` |
| Value | *(exact value shown on this page)* |

5. After adding both at your DNS provider, go back to this same DKIM page and toggle **Enable** — this can only be switched on after both CNAMEs are live and detected.

### TXT — DMARC (tells receivers what to do if SPF/DKIM ever fail, and gives you visibility)

| Field | Value |
|---|---|
| Type | `TXT` |
| Host / Name | `_dmarc` |
| Value | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@ndyhub.com; adkim=s; aspf=s` |

Note: the `rua=mailto:dmarc-reports@ndyhub.com` part means DMARC reports get emailed to that address — that inbox doesn't need to exist yet for the record to work, but if you want to actually *read* those reports later, either create that mailbox eventually or tell me and I'll give you a version pointing at an address you already check.

We're deliberately starting at `p=quarantine` (suspicious mail gets flagged, not silently deleted) rather than `p=reject` — that's the safe, standard way to roll out DMARC. We can tighten this later once everything's been running cleanly for a couple of weeks.

## 3.4 Confirm everything is detected

Back in the Microsoft 365 admin center's domain page for `ndyhub.com`, it will show a checklist of each record and whether it's been detected correctly (green checkmark) or not yet found (still propagating, or entered incorrectly). This can take anywhere from a few minutes to 24-48 hours per record.

You don't need to get everything right in one sitting — add what you can, check back later, and Microsoft will re-check automatically.

---

## What to send me after this step

- The verification TXT value (§3.1), before you add it, so I can confirm it looks right
- If `ndyhub.com` already has an existing MX record or SPF TXT record, tell me what it currently says before you touch anything — I'll tell you exactly how to handle it
- Once everything shows as verified/detected in the admin center, just tell me — that's my cue to create the actual mailbox for `NDY-CEO-000001@ndyhub.com` and start the real end-to-end test

## What NOT to touch

- Don't remove or change any of `ndyhub.com`'s **other** DNS records (the ones pointing at your website, any other services) — only the mail-related records above are being added.
- Don't set DMARC to `p=reject` on day one — start at `quarantine` as shown above.

## Common issues

- **"Verify" keeps failing** — DNS changes take time to spread across the internet (this is normal, called "propagation"). Wait at least 30-60 minutes after adding a record before assuming it's wrong. You can check if a record has gone live yourself at **https://mxtoolbox.com** by searching your domain.
- **Not sure where to add DNS records** — this depends entirely on where `ndyhub.com` is registered/managed (GoDaddy, Cloudflare, Namecheap, your web host, etc.). Look for a section called "DNS," "DNS Management," "DNS Zone Editor," or similar in that provider's dashboard. If you're not sure which provider manages your DNS, tell me and I can help figure it out from the domain's public records.
