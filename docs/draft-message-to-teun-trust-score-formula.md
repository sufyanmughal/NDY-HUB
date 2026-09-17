Hi Teun,

One quick decision I need from you before I finish a small piece of NDY Trust —
I don't want to guess at it, because a trust score is the kind of thing that's
hard to walk back once people have seen a number.

## Where NDY Trust is today

The **tier** half is live: every account resolves to UNVERIFIED → BASIC →
VERIFIED → TRUSTED, derived from facts we already hold:

- **UNVERIFIED** — nothing verified yet
- **BASIC** — email + phone verified
- **VERIFIED** — identity document verified (the LEVEL_3 review)
- **TRUSTED** — VERIFIED plus an additional trust signal (e.g. business verified)

That works and is already exposed on your own profile (`GET /trust/me`).

## What's missing: the numeric score

The design we agreed kept a **0–100 score** as a second, finer-grained signal —
but deliberately left the formula as an open question, because a number needs a
real definition, not an engineer's guess.

**What moves the score, and by how much?** My proposed starting point (a
proposal, not something I'll ship without your yes):

| Signal | Points |
|---|---|
| Email verified | 10 |
| Phone verified | 25 |
| Identity document verified | 40 |
| Business workspace verified | +15 |
| Account older than 90 days with zero security flags | +10 |
| **Cap** | **100** |

Three things I specifically need you to confirm or change:

1. **The inputs and weights above** — are these the signals you want, and are
   those the right amounts? (Everything listed is data we already have, so
   there's no extra work to add or remove one.)
2. **Should the score be public or private?** The tier is designed to show on
   the public Passport card. A precise number is a bigger call — do you want
   potential clients/partners to see "NDY Trust Score: 82", or should the exact
   figure stay private (visible only to the account holder and to admins) while
   the public side keeps showing the tier badge? My recommendation: **public
   tier, private number** to start — it's easier to open up later than to
   retract a number people have already been judged on.
3. **Can the score go down?** e.g. if a security flag appears on the account.
   Simple to support, but if you'd rather scores never decrease, I need to know
   that now so the logic matches the promise.

Once you confirm the formula (and 2 and 3), this is roughly half a day: it's a
one-line schema addition, one computation added to the existing recompute path,
and the score added to the profile response. Nothing structural — the plumbing
is already there and waiting.

Thanks brother 🙏

Best,
