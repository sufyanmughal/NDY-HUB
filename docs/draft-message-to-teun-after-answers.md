Hi Teun,

Here is the detailed update on everything from your decisions. Everything that
could be built without an input from you is done, verified, and committed.

## Verification evidence (so you don't have to take my word for it)

- API: builds clean (`nest build`).
- Tests: **117 passing**, 13 suites — including new suites for Trust, Signature,
  Context Broker and the NDYQR renderer.
- Web: production build succeeds (not just a type-check — a real Next build, which
  is what catches route/SSR problems), plus clean type-check.
- Lint: clean on every file I touched, in both apps (the repo enforces prettier
  plus a strict TypeScript-ESLint set).
- Schema/migrations: verified **drift-free** — every schema change has a matching
  migration, and no migration references something that isn't in the schema.

---

## 1. NDY Signature

**What it does now**
- Create a signature request for one or more signers. The document itself is
  never stored — only its **SHA-256 hash**, so we can prove *what* was signed
  without holding the contents.
- Each signer gets a **single-use link**. They sign in as themselves and either
  sign or decline.
- Each signature records: the NDY ID of the signer, when they signed, from which
  IP/user-agent, the content hash **copied at sign time**, and the consent wording.

**Key decisions, and one improvement I made**
- The consent statement is **server-owned**. The API returns the exact wording for
  the page to display and stores that same string with the signature. I changed
  this from "browser sends the text" because otherwise a caller could later claim
  we showed wording we never showed — which would make the stored record
  worthless as evidence.
- The wording matches your Q8 ruling precisely: it states this is a verified NDY
  digital attestation and **is not presented as a legally-binding electronic
  signature**. Stored words and on-screen words are the same string.
- Signing requires an authenticated account. The emailed token authorises *which
  signature slot*; the login determines *who fills it*, and the API refuses if
  they disagree.
- A declined signer closes the whole request as DECLINED (Q11).
- The evidence is deliberately **not** a foreign key to the account, so it
  survives account deletion (Q12). Retention is documented as configurable — I
  still need your default period (Q10) rather than inventing one.

**Routes:** create, list-mine, token preview, sign, decline, revoke, plus a
**public** `GET /signature/verify/:id` that returns only the hash, the signer's
NDY ID and the timestamp — nothing else — so a third party can verify without
trusting our database.

## 2. NDY Trust Score

**The locked model is implemented, in one place in code** so future tuning needs
no schema change:

- **Baseline 50** = neutral / insufficient history. Explicitly *not* "50%
  trusted". A brand-new clean account scores exactly 50, and there is a test
  asserting that.
- **Identity Assurance +18**, broken into email (+6), phone (+6), identity
  document (+6).
- **Account Security +12**: 2FA (+6), passkey (+4), recovery codes (+2).
- **Device Trust +6**: at least one known device (+3), and no device left pending
  approval (+3).
- **Verified Claims +8**: a non-self-asserted business claim (+5), plus an
  additional third-party credential (+3).
- **Account History +6**: older than 90 days (+3), and "sustained clean activity"
  (+3) defined as ≥10 successful sign-ins spread over ≥60 days with no flags.
- **Risk penalties:** stolen-token reuse −30; device revocation −3 each, capped at
  −9; a **suspended account floors to 0** rather than being partially trusted.
- **Penalties decay after 30 clean days**, per your decision that trust reflects
  current confidence rather than becoming a permanent record.

**Visibility:** the exact number is only ever returned on the member's own profile
(`GET /trust/me`). Nothing public exposes it — the tier remains the public signal.

**A real bug the tests caught:** the "all devices approved" signal was being
awarded to users with **zero devices**, which quietly pushed a brand-new account
from 50 to **53**. That breaches the principle you set, so it now requires an
actual device. This is exactly why the test exists.

**Failed logins (your Q6):** recorded now, against real accounts only, with IP and
user-agent, and visible in that account's security history. **Deliberately not
scored** — your locked penalty table doesn't include failed logins, and adding a
weight would break our rule about locking the formula together. I need a weight
from you when you want it active.

## 3. Context Broker (AI permission layer)

**Scoped to your confirmed first consumer** — the placeholder catalog is gone, and
the vocabulary is now the NDYMAIL AI set:

- **Action ingress** (what the agent may *do*): summarise email, draft a reply,
  rewrite/translate.
- **Data egress** (what may *leave* NDY): a **separately named** consent, so a
  member can see that "process my email outside NDY" is a different permission
  from "summarise my email".

**How enforcement works:** the agent is an ordinary OAuth client, flagged as an AI
agent. The Action Engine's existing Authorize step now performs one extra check
for agent-originated requests: does this member's consent record permit this agent
to invoke this action? An agent still passes membership, validation, risk tier and
audit exactly like a human — it gets **no special trust, just an extra check**.

**Fail-closed:** anything not mapped to a consent scope is **refused**, including
the old placeholder scopes. An agent cannot reach an action until a scope is
deliberately agreed for it.

**Where your boundary sits:** I built the consent half. The **provider allow-list**
— which providers may receive data — is a governance/legal decision, and I have
not invented it. AI/Agent Activity History is recorded on the roadmap (Q15).

## 4. NDYQR

- **Member-facing:** create, retarget (the code never changes — only where it
  points), activate/deactivate, scan analytics, campaign tags, browser download
  as PNG/SVG.
- **Server-rendered images (Q21):** `GET /q/:slug/image.png` and `.svg`, so mobile
  apps and print pipelines get a finished, branded code with no JavaScript. Every
  image is **decoded back with a real QR reader before it is returned** — an
  unscannable code fails loudly instead of being served. Fetching an image
  deliberately does **not** count as a scan, so analytics stay truthful.
- **The official ND logo is now embedded** in server-rendered codes, so browser and
  server output carry one identity. I verified by test that embedding the logo
  **does not break scannability**.
- **Service credentials:** a registered product authenticates server-to-server on
  its own behalf with no logged-in user, and creates codes attributed to itself.
  The rule "exactly one owner — a member OR a product, never both, never neither"
  is enforced by a **database constraint**, not just application code.
- **NDYSTAYS (Q22)** is documented as a 4-step admin action for when it's ready;
  no product-specific QR code is ever written. Short domain (Q23) noted as low
  priority.

**One brand note worth repeating:** the original bright gradient and the
separated-dot style **do not scan** — the light blue end lacks contrast against
white, and gaps break the module grid a reader depends on. I kept your exact
magenta → violet → blue progression at print-safe depth with rounded, edge-to-edge
modules. It reads as NDY and it scans.

## 5. NDY Admin

Design document drafted and ready for the sync with Hassan and Abdul (Q16). It's
written to be **corrected**, not rubber-stamped: standalone product, OIDC-only
authentication, **no database backdoor**, read-mostly v1 with **zero direct
writes**, sensitive writes later routed through the Action Engine, and six
questions deliberately left open for the call rather than decided by me.

## 6. Founding-team NDY IDs

Your mapping already matched the script exactly (CEO-000001, FND-000002,
EXE-000003, DEV-000004/5/6), so nothing needed changing there.

**A real bug I found and fixed while preparing it:** the script looked accounts up
by a lowercased email, but signup stores the address *exactly as typed* — so any
founding member who registered with a capital letter would have been **silently
missed** on an operation that assigns permanent IDs. It now matches
case-insensitively.

Everything is ready for your sequence: **fill placeholders → dry run → review →
apply → verify IDs → verify real login.** Waiting on the six email addresses (Q18)
and your final title/subtitle wording (Q20).

## 7. Verification Core

Deferred exactly as you decided (Q5). No code touched. The separation is designed
for (its own database when it happens), and NDYHUB already has the
service-to-service authentication it will need — so it stays an extraction, not a
rebuild.

---

## Bugs and findings worth your attention

1. **Neutral baseline was quietly broken** — zero-device accounts were earning
   "all devices approved" (50 → 53). Fixed. This directly breached the "don't
   treat new users as suspicious" rule you set.
2. **The bright QR gradient doesn't scan.** Fixed via print-safe colours, and the
   automatic readability check now enforces it on every rendered code.
3. **The founding-ID script would have missed mixed-case emails.** Fixed before it
   could affect permanent IDs.
4. **NEW — email case-sensitivity (needs your decision).** Email is matched
   case-sensitively at signup *and* login. So `Teun@ndyhub.com` and
   `teun@ndyhub.com` would create **two separate accounts for one person** — an
   identity-integrity problem in a system whose premise is *One Identity*. My
   recommendation: normalise to lowercase on signup and login, with
   case-insensitive uniqueness. Small change, but it touches authentication, so I
   flagged it rather than changing it quietly. **Worth settling before the
   founding accounts go in**, since those IDs are permanent.

## What's committed

Eight clean commits, one per feature, each message explaining the reasoning
(including the bugs above and the deliberate non-decisions):

```
chore: satisfy repo lint (prettier + strict eslint) across new features
docs: NDY Admin design, apply plan, and client updates
ndyqr: embed the official ND logo in server-rendered codes
auth: capture failed logins; fix founding-ID email lookup
context-broker: scope consent to the real first consumer
signature: store the exact consent wording, server-owned
trust: implement the locked v1 score model
db: broker consent scopes, signature consent text, failed-login event
```

I have **not pushed**. Committing was authorised; pushing publishes to the shared
remote and can trigger a deploy, so that's your call.

## Database migrations — written and waiting

Seven migrations, all additive, verified drift-free:

| Migration | Adds |
|---|---|
| `add_ndyqr` | NDYQR tables (codes + scans) |
| `add_ndy_signature` | Signature request/signer/signature tables + notification category |
| `add_trust_score` | `TrustProfile.score` |
| `add_context_broker` | `AI_AGENT` client type + `AiAgentConsent` |
| `add_ndyqr_service_owner` | Service-owner column + single-owner DB constraint |
| `add_signature_consent_text` | `Signature.consentText` |
| `add_login_failed_event` | `LOGIN_FAILED` security event type |

They're all widening/additive — nothing existing is narrowed or dropped, so they
are safe to run against a live database in order.

## What I need from you or the team

**First and most impactful: a staging database (Q24).** I currently have no
database I can reach, so while everything builds, type-checks, lints and passes
unit tests, none of it has been exercised end-to-end against real data. With
staging I can apply all seven migrations and prove every flow in one pass. The
apply plan, with exact commands and five verification steps, is already written
and committed.

Then, in priority order:

1. **Retention default** for signature evidence (Q10) — a number, so I'm not
   inventing policy.
2. **Failed-login weight** (Q6) — captured, not scored.
3. **Provider allow-list** for data egress (Q14) — your/legal decision.
4. **Email-normalisation decision** — the identity-integrity finding above.
5. **Six founding emails (Q18) + title wording (Q20)**, and the **NDY Admin sync
   date**.

Nothing is blocked on engineering any more — only on inputs and access. The moment
staging exists, all seven migrations get applied and verified.

One Identity. One Passport. One Ecosystem. 🚀

Best,
