Hi Teun,

Update on the seven items we lined up. Four are built and verified, two are
blocked on a decision or an input from your side, and one I've deliberately
parked because it's pure infrastructure with no visible payoff yet.

Everything below is code-complete and tested (the API builds clean and 99
automated tests pass), but **none of it is deployed yet** — there are four
database migrations waiting to run, which I explain at the end.

---

## ✅ Done

### 1. NDY Signature
A member can now send a document or statement to one or more people to sign,
with each signature recorded against their NDY identity as a durable,
independently-verifiable record.

- Create a request (title + the document, which we hash — we never store the
  document itself, only a fingerprint of it).
- Each signer gets a single-use signing link; they sign in as themselves and
  approve or decline.
- Once everyone has signed, the request closes automatically.
- **`GET /signature/verify/:id` is public and needs no login** — that's the point:
  a third party can confirm "this NDY user signed this document on this date"
  without trusting our database.
- Signing requires being signed in, because a signature has to belong to a real
  account. The link authorises *which* signature slot; your login determines
  *who* fills it, and we refuse if they don't match.

**One decision still open (item 1 in your list):** is this legally-binding
e-signature, or an internal attestation? I built it as the latter and the screen
says so explicitly ("not presented as a legally-binding e-signature"). If you
need real legal weight, tell me and I'll add the required consent wording and
audit detail — better to decide before anyone relies on it, which is why I
didn't assume.

### 2. Trust score
The Trust **tier** was already live (UNVERIFIED → BASIC → VERIFIED → TRUSTED).
The missing piece was the numeric score, which needed a formula from you. I
built the version we discussed and it now appears on your own profile:

| Signal | Points |
|---|---|
| Email verified | 10 |
| Phone verified | 25 |
| Identity document verified | 40 |
| Business workspace verified | +15 |
| Account older than 90 days with no security flags | +10 |
| **Maximum** | **100** |

**Please confirm these weights** — they're in one place in the code, so changing
any of them is a five-minute job. Two related points I'd still like your call
on: **should the number be public** (my recommendation was public tier, private
number to start — right now the score is only visible to the account holder),
and **should a score ever go down** (e.g. if a security flag appears)? Right now
it does not go down for anything except losing the "clean account" bonus.

### 4. Context Broker (AI permission layer)
The gate that makes AI safe: an AI agent can only act on a member's behalf
within the specific scopes that member has explicitly granted, and every attempt
is audited exactly like a human's action.

- AI agents register as a special client type; requesters are ordinary OAuth
  clients otherwise.
- A new **AI Agents** screen lets a member grant or revoke access per agent,
  in plain language ("Your calendar", "Your contacts"…). Nothing is shared by
  default.
- Enforcement sits inside the existing Action Engine approval flow, so an AI gets
  **no special trust** — it still passes the same membership, validation, risk
  and audit checks a person does, plus the consent check.
- If an action has no defined consent scope, the AI is **refused** rather than
  allowed — we fail closed.

**One caveat:** the scope list is a placeholder until we name the first real AI
consumer. The moment we know what it is (Generative Media Core? a NDYCORE agent?
Hassan's app?), I'll trim it to exactly what's needed.

### 7. NDYQR image endpoint
NDYQR can now serve the branded code as a **ready-made image** — `.png` and
`.svg` — so mobile apps, print pipelines and other services don't have to run
any JavaScript to get one. Each image is **checked with a real QR reader before
it's returned**; if it somehow wouldn't scan, the request fails loudly instead
of handing back a broken code.

**⚠️ One thing you should know, because it affects the design you sent me:**

When I wired up the automatic scan-validation, it caught a genuine problem with
the QR design — the bright gradient you referenced **does not scan**. The light
blue end has too little contrast against white for a reader to lock on. The
rounded "separate dots" style has the same issue: the gaps break the grid a
scanner needs.

I kept the exact **magenta → violet → blue** progression you asked for, but at a
deeper, print-safe shade, and the modules now sit edge-to-edge with rounded
corners rather than as separated dots. It still reads unmistakably as NDY — but
it actually scans, which the bright version doesn't. I also corrected the
on-screen version, which had the same flaw. Worth knowing this is precisely the
"beautiful code that doesn't work" problem your readability requirement was
meant to prevent — the requirement did its job.

**Still to do here:** giving *other products' backends* the ability to create
codes without a logged-in user. That needs one small decision first — a code
currently must belong to a member account, so a service-created code has no
owner. Either a code can belong to a product instead of a person, or we keep
creation to members only. Small decision, but it changes the data model, so I
didn't guess.

---

## ⏸ Parked (my recommendation)

### 5. Verification Core as a separate service
Extracting identity verification into its own service. **My recommendation is to
wait**, and I've written you a separate note on this. Short version: it's pure
plumbing with no visible feature, the benefit only appears once a real
document/liveness vendor or a second product needs it, and doing it now means
migrating something that's already working. The good news is NDYHUB already has
the service-to-service authentication this needs, so when we do it, it's an
extraction — not a rebuild. **Just tell me if you'd rather I do it now.**

---

## 🔴 Waiting on you

### 3. NDY Admin
This one needs the design conversation first — you, Hassan, Sufyan and Abdul
aligned on exactly what the admin surface is. Building screens before that sync
would be the most wasted effort of anything on this list, so I haven't started
it. Happy to join that call whenever it's scheduled.

### 6. Founding NDY ID seeding
This is ready to go and takes minutes — it's waiting on **the six real email
addresses** of the founding team. Send them over and it's effectively instant
(the script is built to fail safe, so a bad address can't corrupt anything).

---

## Deploy note

Four database migrations are written but not yet applied (they're all additive —
new tables and columns, nothing existing is touched): NDY Signature, trust score,
Context Broker, and NDYQR. They can't be applied from my machine — I don't have
production database access — so they'll run as part of the next deploy. Everything
new stays invisible until that happens, and none of it endangers what's live now.

Net: **4 of 7 done**, 1 parked with a recommendation, 2 waiting on you. The two
Quickest wins on your side are the six email addresses and confirming the Trust
score weights — both unblock real work.

Best,
