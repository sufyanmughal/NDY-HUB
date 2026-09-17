# Self-Hosted Mail Server on DigitalOcean — Full Setup Guide

**⚠️ Read this whole section before starting.** This is a genuinely different undertaking than the Microsoft 365 setup — real deliverability risk, ongoing operational responsibility, and it directly changes what was previously agreed with Teun (who asked for Microsoft 365 in writing). Proceed deliberately, not because it's technically possible to start.

**Recommended stack**: [Mailcow](https://mailcow.email/) — free, open-source, Docker-based, bundles Postfix (SMTP) + Dovecot (IMAP) + Rspamd (spam filtering — current Mailcow has fully replaced SpamAssassin with Rspamd, see [the 2026-07 "Mooly" release](https://mailcow.email/posts/2026/release-2026-07/)) + ClamAV + DKIM + a web admin panel + webmail, all pre-integrated. Building each component by hand (raw Postfix + Dovecot config) is possible but meaningfully more error-prone and not worth it unless you have a specific reason to avoid Docker.

---

## 0. Critical: this needs its own, separate droplet

Your existing droplet (`198.199.67.21`, running NDYHUB) has **1.9GB RAM, already using 1.1GB** for the API, web app, Postgres, and nginx. A mail stack with spam/virus filtering needs 2-4GB **by itself**. Running both on the same droplet risks crashing your live production site under load, or the mail stack itself being unstable from memory pressure.

**Provision a new, separate droplet** for this — do not install it alongside NDYHUB.

## 1. Create the mail server droplet

1. In DigitalOcean, create a **new** droplet:
   - **Image**: Ubuntu 24.04 LTS (matches your existing droplet, same familiarity)
   - **Size**: minimum **4GB RAM / 2 vCPU** (Mailcow's own minimum recommendation — 2GB will run but Rspamd will struggle and mail can queue/delay under any real load)
   - **Region**: doesn't need to match your app droplet, but closer to your users is marginally better for latency (not critical for mail)
   - Cost: **~$24/month** for a 4GB/2vCPU droplet
2. Enable **backups** when creating it (+20% of droplet cost, ~$4.80/month) — losing this server without backups means losing every mailbox's mail permanently, unrecoverable.
3. Note the new droplet's IP address — call it `MAIL_SERVER_IP` for the rest of this guide.

## 2. Request port 25 be unblocked

DigitalOcean blocks outbound SMTP (port 25) by default on all new accounts/droplets, specifically to stop spam operations from spinning up freely.

1. Go to **https://www.digitalocean.com/support** (or your DO dashboard's support section)
2. Open a ticket: **"Request to unblock port 25"** (this is DO's own standard, named request type — search their support docs for "port 25" if the exact option isn't obvious)
3. Explain: you're running a legitimate mail server for a real business domain, not a bulk-mail/spam operation.
4. **Do this immediately, before anything else** — it can take a few days to be approved, and nothing below will actually send mail without it.

## 3. Point DNS at the new server (before installing Mailcow)

At your DNS provider for `ndyhub.com` (same place you'd have added Microsoft's records, if you'd gone that route):

| Type | Host | Value |
|---|---|---|
| A | `mail` | `MAIL_SERVER_IP` |
| MX | `@` | `mail.ndyhub.com`, priority `10` |
| TXT | `@` (SPF) | `v=spf1 mx ~all` (adjust once you know your final setup — Mailcow's own docs give the exact recommended value) |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@ndyhub.com` |

DKIM records come *after* Mailcow is installed (§6 below) — it generates the actual key.

**Same warning as the Microsoft path**: if `ndyhub.com` has any existing MX or SPF record, it must be replaced, not stacked alongside this one.

## 4. Install Docker and Docker Compose

SSH into the new mail server droplet:

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y
```

## 5. Install Mailcow

```bash
cd /opt
git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized
./generate_config.sh
```

When prompted:
- **Hostname (FQDN)**: `mail.ndyhub.com` — this must match the A record from §3.
- **Timezone**: your local timezone.

Then start it:

```bash
docker compose pull
docker compose up -d
```

First start takes a few minutes while it initializes. Once running, the admin panel is reachable at `https://mail.ndyhub.com` (self-signed cert initially — see §7 for real TLS).

## 6. Set up DKIM

1. Log into the Mailcow admin panel (`https://mail.ndyhub.com`) — default login is `admin` / `moohoo`, **change this immediately** under Configuration → Access → Admin Accounts.
2. Go to **Configuration → ARC/DKIM keys**
3. Add a DKIM key for `ndyhub.com`
4. Mailcow shows you the exact DNS TXT record to add — something like:

| Type | Host | Value |
|---|---|---|
| TXT | `dkim._domainkey` | *(exact value Mailcow generates — copy it precisely)* |

Add this at your DNS provider.

## 7. Get real TLS certificates

Mailcow includes automatic Let's Encrypt integration — once your DNS (§3) is live and pointing correctly, Mailcow's built-in ACME container requests and renews certificates automatically. No manual certbot setup needed if DNS is correct first.

## 8. Create the mailbox

1. In the Mailcow admin panel: **Configuration → Domains** → add `ndyhub.com` as a mail domain.
2. **E-Mail → Mailboxes** → add mailbox: `ndy-ceo-000001@ndyhub.com` — set a strong password.

## 9. Connect this to NDYMAIL

This is the part that connects back to what's already built. Two options:

**Option A — via the IMAP/SMTP adapter path** (the fastest to get working, since Mailcow exposes standard IMAP/SMTP): the `MailProviderType.IMAP_SMTP` value already exists in NDY Mail Core's schema, but **no IMAP adapter has been written yet** — only the Microsoft Graph adapter exists so far. This would need real development work: an `ImapMailAdapter` implementing the same `MailProviderAdapter` interface the Graph adapter does (OAuth doesn't apply here — IMAP typically uses username/password auth instead, which changes the connect-flow UI slightly too).

**Option B — the `NDY_NATIVE` adapter path**: also already reserved in the schema/enum, also **not yet built**. This would be the long-term "real" path if Mailcow becomes NDYHUB's permanent mail backend rather than a bridge — architecturally cleaner, but more work upfront.

**Either way: this needs new adapter code before NDYMAIL can actually talk to this server.** The Graph adapter that's live today only knows how to talk to Microsoft. Standing up Mailcow gets you a real mailbox that can send/receive email over the internet — but NDYMAIL itself won't be able to connect to it until one of these two adapters is written.

## 10. Deliverability reality check — read this before testing

Once everything above is running:

- **Expect early test emails to land in spam**, even with SPF/DKIM/DMARC all correctly configured. This is normal for a brand-new IP with zero sending history — every major provider (Gmail, Outlook.com, Yahoo) treats new mail servers with default suspicion.
- **Send low volume, consistently, for the first few weeks.** Don't send a burst of test emails — that looks like spam behavior to receiving servers and can get you blacklisted before you've even started.
- **Check your IP's reputation** at https://mxtoolbox.com/blacklists.aspx periodically — if a blacklist ever picks you up, delisting can take days per blocklist.
- Consider registering with **Google Postmaster Tools** (postmaster.google.com) once you have a Google-Workspace-domain-equivalent — it gives you visibility into how Gmail specifically is treating your mail, which is often the hardest provider to get consistently accepted by.

---

## Total cost summary

| Item | Cost |
|---|---|
| New droplet (4GB/2vCPU) | ~$24/month |
| Backups | ~$4.80/month |
| Domain | $0 (already own `ndyhub.com`) |
| Mailcow software | $0 (free, open-source) |
| **Total** | **~$29/month**, flat — regardless of how many mailboxes you create |

This is the actual economic case for self-hosting: it stays flat as mailbox count grows, unlike Microsoft's per-seat pricing. The tradeoff is the deliverability risk and ongoing operational responsibility (patching, monitoring, backups) described above — those don't have a price tag, but they're real.

## What still needs building before this is usable from NDYMAIL

1. Either an `ImapMailAdapter` or `NdyNativeMailAdapter` implementing `MailProviderAdapter` (neither exists yet — only Graph does)
2. A username/password-based connect flow in the UI if going the IMAP route (the current connect flow is OAuth-only, built for Graph)
3. Time for IP reputation to build before this is reliably usable for real external correspondence
