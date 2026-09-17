Hi Teun,

Great questions on both QR messages — and yes, I checked the codebase before
answering. Short version: the *functionality you're describing doesn't exist
yet*, so you're not duplicating anything. What exists today is two narrow,
single-purpose QR usages, not a central service. And I didn't just plan it — I
built the first working version of NDYQR™ so you have something real to look at.

## 1. What exists in NDYHUB today (so we don't duplicate)

Only two things use a QR code right now:

- **QR / deep-link login** — the code on the login screen that NDYAPPS scans to
  approve a sign-in. It's a single-use, expiring, session-bound code. Excellent
  at what it does, and security-sensitive, so I left it exactly as is.
- **NDY Passport QR** — the Passport page and its PDF render a plain QR of the
  public passport URL, with the ND badge drawn on top of it.

Neither one is reusable, neither lets you change where a code points, and
neither tracks scans. So none of your NDYQR idea is already built — it's a
genuinely new capability, not something we'd be duplicating.

## 2. Your technical question: build it now as a central service?

My view: **build it as a central NDYQR™ service inside NDYHUB**, exactly as you
described — one API the whole ecosystem calls, so no product ever builds its own
QR system. That matches the architecture we already agreed on ("one system of
record; everything reuses it"). A QR is an identity-adjacent object, so it
belongs next to the NDY Passport rather than in each product.

I've built the first version so the direction is concrete:

- **Create once, change the destination any time.** A code's short link is
  permanent; only its destination is editable. So a printed menu, badge or sign
  never has to be replaced when the target changes — the core of your idea.
- **Scan analytics** — every scan records time, device, and location, and feeds
  a per-code analytics view. That's the `NDYQR → Analytics → NDYINSIGHTS` link
  you drew, working today.
- **Types for each product** — NDYSTAYS, NDYCONNECT, NDYQUIZ, NDYVIXIT, NDYXTRA,
  NDYPAY, plus Passport and Login — so codes are already organised by product
  and campaigns are taggable.
- **Central permissions** — any member can create their own codes, and operators
  (with a new `MANAGE_QR_CODES` permission) can see every code in the ecosystem.
- **One shared renderer** that applies the NDY brand standard, so individual
  products never design their own QR.

## 3. On the branding (your second message) — agreed, and it's the default

I took your direction literally: the NDY standard is the *default*, not
something each product opts into. Every code is generated through one central
renderer that enforces:

- **Pink → purple → blue NDY gradient** (the exact gradient from the Passport
  card), with **rounded modules and rounded corner markers**.
- **The official ND logo permanently centered — and, crucially, the centre area
  is *reserved*, not covered.** You were right to call this out: the renderer
  omits the modules underneath the logo before drawing it and uses **high error
  correction**, so the code stays reliably scannable instead of looking nice and
  failing at the till.
- **White background with a proper quiet zone**, **PNG and SVG export**.
- **Automatic readability validation before a code can be published** — exactly
  the check you asked for. When someone goes to download a code, we decode it
  back with a real QR reader and confirm it scans to the right URL; if it
  doesn't, we refuse and say so, rather than handing over a beautiful code that
  doesn't work.

Products can set their own destination and, if they want, tint the gradient —
but the logo, shape, background, quiet zone and error correction stay standard,
so any NDYQR is instantly recognisable as ours.

## 4. What's next

The service, the branding, and the analytics are in place. The two things I'd
add next, in order: (a) a server-side image endpoint so non-web callers (mobile,
print) get the same branded image directly, and (b) a short domain like
`q.ndyhub.com` for cleaner printed codes. Then NDYSTAYS/NDYCONNECT etc. just call
the API — no QR code in any product should ever be hand-rolled again.

**One code. Endless connections.** Happy to walk you through it live whenever
you want. 🙏

Best,
