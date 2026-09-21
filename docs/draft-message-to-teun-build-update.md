Hi Teun,

Thank you for the clear decisions — having all of them in one place made this
fast to act on. Everything that can be done without a decision or an input from
your side is now done and verified. Here's the update.

**Verification, up front:** the API builds clean, **117 automated tests pass**,
and the web app builds for production. That last one matters — a production
build catches things a type-check doesn't, and all the new screens (NDYQR,
Signature, AI Agents, the public signing page) build clean.

---

## What I built from your decisions

**Trust Score — the locked model is in the code.**
- Neutral baseline **50**, exactly as you defined it: *insufficient history*, not
  "50% trusted". A brand-new clean account scores precisely 50.
- Your six categories and weights: Identity Assurance +18, Account Security +12,
  Device Trust +6, Verified Claims +8, Account History +6.
- **Penalties now decay** after 30 clean days, per your decision that trust means
  current confidence rather than a permanent record. A suspended account floors
  to **0** — not partially trusted.
- "Sustained clean activity" has your measurable definition: ≥10 sign-ins spread
  over ≥60 days with no flags.
- The exact score stays **private**; the tier stays public.
- The old provisional score is **gone** — superseded as you approved, so there
  aren't two competing formulas in the system.

**Failed-login capture (Q6) is in.** A failed password attempt against a real
account is now recorded, visible in that account's security history. One thing I
deliberately did **not** do: give it a score penalty. Your locked penalty table
doesn't include it, and inventing a weight would have broken our own rule about
locking the formula together — so it's captured and ready, and I'd like a weight
from you when you're ready to set one.

**NDY Signature — consent is now captured properly, and I made one improvement.**
- The exact consent wording is stored **verbatim** with each signature (Q9).
- Improvement: the statement is **server-owned**, not sent by the browser. If the
  client could supply the text, someone could later claim we showed wording we
  never showed — which defeats the whole point of storing it. Now the record
  proves what was actually displayed.
- The wording matches your Q8 position exactly: it states this is a verified NDY
  attestation and **not** presented as a legally-binding electronic signature.

**Context Broker — scoped to the real first consumer, both halves kept.**
- The consent vocabulary is now the **NDYMAIL AI** set (Summarise, Draft Reply,
  Rewrite/Translate) instead of the placeholder catalog — your "don't build a
  speculative catalog" instruction, applied.
- Both halves are represented: **action ingress** (what the agent may do) and
  **data egress** (what may leave NDY). The egress permission is now an explicit,
  separately-named consent so a member can see it — not buried.
- Everything not mapped now **fails closed**, including the old placeholder
  scopes. An agent can't reach anything until a consent scope is deliberately
  agreed for it.
- AI/Agent Activity History is on the roadmap as you asked (Q15).

**NDYQR — including the two things you just cleared.**
- **The real ND logo is now embedded** in server-rendered codes (Q21), so browser
  and server codes carry the same official identity. I verified it still scans
  after embedding — that's the check doing its job.
- **Service credentials** are built: a registered product authenticates
  server-to-server and creates codes on its own behalf with no logged-in user,
  and the single-owner rule is enforced by the **database itself**, not just
  application code. NDYSTAYS onboarding is documented as a 4-step admin action
  (Q22). The short domain stays low priority (Q23).

**NDY Admin — design document drafted** (Q16), attached separately. It's written
to be corrected in the sync call, not approved as-is: no database backdoor,
OIDC-only, read-mostly with **zero direct writes**, and six questions I
deliberately left for you, Hassan and Abdul.

**Founding IDs (Q19/Q20):** your mapping already matched what the script
expects, so nothing needed changing. It's ready to run — placeholders → dry run
→ review → apply → verify — and it stays blocked on purpose until you send the
six emails and confirm the title wording.

**Verification Core:** deferred, as agreed. No code touched.

---

## Two bugs the tests caught, worth knowing about

1. **The neutral baseline was quietly broken** — a user with *zero* devices was
   being awarded "all devices approved", which pushed a brand-new account from 50
   to 53. That is exactly the "new users must not be treated as suspicious"
   principle you set, so I'm glad the test was there to catch it.
2. **The QR gradient didn't scan** (from the earlier round) — the bright version
   and the separated-dot style both fail on a real reader. Preserved your
   magenta → violet → blue progression at a print-safe depth instead.

---

## What I need from you or the team

**Migrations.** Seven are written, all purely additive, and I've verified there
is no drift between the schema and the migrations (every change has one). They
need a database I can reach:

1. **A staging database (Q24)** — still the single biggest thing slowing me down.
   With it I can apply all seven and prove the flows end to end before anything
   touches production. I've written the apply plan, so it's one command.

**Decisions still open:**
2. **Retention period (Q10)** — you agreed it should be configurable and
   privacy-conscious; I need a default number to ship rather than invent one.
3. **Failed-login weight (Q6)** — captured, not scored, see above.
4. **Provider allow-list (Q14)** — agreed: who may receive data is your/legal's
   call. I've built the consent half; I won't invent the policy half.
5. **Commits (Q25)** — I've written the plan but not executed it, because several
   files I edited already contained other people's uncommitted work. Committing
   them would mean committing their work too. If someone commits or stashes that
   first, I'll follow with clean per-feature commits immediately.

And from before: the **six founding emails + title wording**, and the **Admin
sync date**.

Nothing is blocked on engineering anymore — only on inputs and access. The
moment staging exists, all seven migrations get applied and verified.

One Identity. One Passport. One Ecosystem. 🚀

Best,
