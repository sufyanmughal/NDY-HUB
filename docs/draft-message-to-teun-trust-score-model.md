Hi Teun,

Here's the Trust Score model you asked for — the strongest first version I can
build from signals we **genuinely have today**, with no new data collection. I'm
sending it before implementing it, as you asked, so we lock it together.

Two framing points first, because they change the design:

**1. We keep the separation you described.** Passport Claims stay *verified
facts*. The Trust **tier** stays the factual answer to "is this identity
verified, and how far" (UNVERIFIED → BASIC → VERIFIED → TRUSTED). The **score**
is the new thing: a dynamic *confidence* number for the account, which can move
both ways. So the score never contradicts the tier — the tier says what's
proven, the score says how much assurance we have in the account *right now*.

**2. A new legitimate user is not "untrustworthy".** This is the one design
decision I'd most like you to agree with, because it's the difference between a
trust system and a punishment system. The score **starts at a neutral 50**, not
at zero. A brand-new, clean account is *neutral* — not suspicious. Trust has to
be earnable from a fair starting point, and the top half is earned by real
assurance. Anything that *reduces* the score is a genuine risk signal (see §3),
never merely "you are new".

---

## 1. The six categories (maximum 100)

Starting point: **50 (neutral)**. The five positive categories can add up to
**+50**; risk signals subtract from there.

| # | Category | Signal we already have | Points |
|---|---|---|---|
| 1 | **Identity Assurance** | email verified (LEVEL_1) | +6 |
| | | phone verified (LEVEL_2) | +6 |
| | | identity document verified (LEVEL_3) | +6 |
| 2 | **Account Security** | 2FA enabled (TOTP or SMS) | +6 |
| | | passkey registered | +4 |
| | | recovery codes generated | +2 |
| 3 | **Device Trust** | at least one known device | +3 |
| | | all registered devices approved (none pending/unrecognised) | +3 |
| 4 | **Verified Claims** | business verified (NDY- or third-party-backed claim) | +5 |
| | | an additional third-party credential on file | +3 |
| 5 | **Account History** | account older than 90 days | +3 |
| | | sustained clean activity (a real usage history, not just age) | +3 |
| 6 | **Risk / Security Signals** | (subtractions — see §3) | −0 to −40 |

A fully verified, well-secured, long-standing account reaches **100**. A
new-but-clean account sits at **50**. An unverified account that never logs in
still isn't *punished* for it — it simply doesn't earn the upper half.

## 2. Why this isn't "collect verifications, receive points"

Three things make it dynamic rather than a static checklist:

- **Signals expire where they should.** A verified claim contributes while it's
  valid; if a claim is revoked or a verification lapses, the points leave with
  it. The score is recomputed from current facts, never accumulated forever.
- **Behaviour matters, not just paperwork.** Account Security and Device Trust
  are about how the account is actually protected and used, not only what's been
  certified.
- **It moves down, and heals.** See below.

## 3. Decreases — and why they should fade

| Risk signal | Effect |
|---|---|
| OAuth refresh-token reuse detected (the standard stolen-token signal) | **−30** |
| Account currently suspended | **floor the score to 0** (an account that can't be trusted isn't partially trusted) |
| Device revoked (beyond normal use) | **−3** each, capped at −9 |

**Proposed: risk penalties decay.** After a clean period (I suggest 30 days with
no further flags), the penalty is removed over time rather than held forever. My
reasoning: a permanent mark for a resolved incident turns the score into a
punishment record, discourages users from reporting problems, and stops the
number from meaning "current confidence" — which is exactly what you said it
should mean. If you'd rather some signals never decay (e.g. a confirmed
compromise), that's a decision I'd rather you make than assume.

## 4. What we genuinely do NOT have yet (so I won't fake it)

To be straight with you about the ceiling of a first version:

- **No failed-login / attempt-velocity data.** We log successful security events
  and known device changes, but we don't currently record failed login attempts,
  so brute-force-style risk can't be scored yet. Worth capturing — it's the
  single most useful missing signal.
- **No geo/IP risk scoring.** We capture IP on sessions and events, but there's
  no anomaly model behind it.
- **No liveness/document vendor data** until NDY Verification Core exists — so
  identity assurance today is "a human approved the document", which is honest
  but not strong KYC.
- **No behavioural/phishing signals.**

A first version built on the table above is solid and defensible, but I'd call
it v1 of an assurance score — not a fraud score. It will get materially stronger
once failed-login capture and (later) vendor verification land.

## 5. On the "current session/action" part

You described the score as confidence for the *current user/session/action*. My
proposal: the **stored** number is the account's assurance (what's above). Any
per-session or per-action confidence should be **derived at the moment it's
needed** (account score + context such as device recognition and how sensitive
the action is), not stored as another number. That keeps one source of truth and
avoids two scores drifting apart. If you want a per-action risk signal, the
Context Broker's policy layer is the right place for it — not a second Trust
number.

## 6. One thing I need to flag honestly

Because of the earlier go-ahead, I had already shipped a **provisional** score
(the "email 10 / phone 25 / identity 40 / business +15 / clean account +10"
version). That model is **not** this one and does **not** meet your "don't treat
new users as untrustworthy" requirement — it starts a new account at a low
number. My recommendation:

- keep it **internal only** (it is — visible just on `GET /trust/me`, never
  public), and
- treat it as a placeholder to be **replaced** by whatever we lock here, rather
  than something we build on.

I'd rather tell you that plainly than quietly leave two competing formulas in
the system.

## What I need from you

1. **The neutral-baseline idea (start at 50)** — agreed? It's the core of your
   "new users aren't untrustworthy" point, and it's the one thing I don't want to
   guess.
2. **The weights above** — adjust any that feel wrong; they're all in one place.
3. **Should risk penalties decay?** (My recommendation: yes, 30 days clean.)
   And is anything in that list meant to be permanent?
4. **Public or private once locked?** My recommendation stands: public tier,
   private number to begin with.

Once you confirm, this is roughly a day's work to implement and test — and I'll
mark the provisional score as superseded at the same time.

Best,
