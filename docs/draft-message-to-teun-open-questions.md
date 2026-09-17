Hi Teun,

Alongside the status update, here is everything I currently need a decision on —
in one place. For each one I've written my recommendation, so in most cases you
can just say "agreed". The ones marked **BLOCKING** are stopping work right now;
the rest I can carry on around.

---

## Trust Score (item 2) — I'm holding until these are locked

**Q1. The neutral baseline. **BLOCKING** — Do we start a new, clean account at
**50** (neutral), so it is not treated as untrustworthy just for being new?
→ *My recommendation: yes, 50. This is the core of your own point, and it's the
one thing I don't want to assume.*

**Q2. The category weights.** The proposed split is Identity Assurance +18,
Account Security +12, Device Trust +6, Verified Claims +8, Account History +6,
risk penalties −0 to −40.
→ *My recommendation: accept as-is for v1 and tune once we see real accounts.*

**Q3. "Sustained clean activity" — what does it actually mean?** I invented this
as half of the Account History category and I don't want it to be vague hand-
waving. Any of these work:
→ *My recommendation: "at least 10 successful sign-ins spread over at least 60
days, with no security flags" — measurable and cheap. Or, if you'd rather keep
v1 simple, drop it and let Account History be age only.*

**Q4. Should risk penalties decay?** e.g. a stolen-token incident costs −30 —
does that come back after a clean period?
→ *My recommendation: yes, decay after 30 clean days. A permanent mark turns the
score into a punishment record and stops it meaning "current confidence". If you
want something never to decay, tell me which.*

**Q5. Public or private?** Should a member's exact number be publicly visible on
their Passport, or stay private to them (with only the tier badge public)?
→ *My recommendation: private number, public tier, to begin with. Much easier to
open up later than to retract a number people have already been judged on.*

**Q6. Do we add failed-login capture?** Right now we log successful security
events but **not failed login attempts**, so brute-force-style risk can't be
scored at all. It's the single most valuable missing signal.
→ *My recommendation: yes, capture it (small work), because without it the score
is an assurance score, not a risk score.*

**Q7. The provisional score already in the code.** It doesn't meet your new
requirement (it starts new accounts low). It's internal-only.
→ *My recommendation: mark it superseded and keep it non-public until we lock
the new model. Confirm and I'll do exactly that.*

---

## NDY Signature (item 1) — two decisions, then I can finish it

**Q8. Internal attestation or legally-intentioned, for v1? **BLOCKING** for the
final wording.**
→ *My recommendation: internal attestation for v1 (which is what the screen
honestly says today), built so it can be upgraded to a stronger legal tier later
without rebuilding — exactly as you described.*

**Q9. May I store the consent wording verbatim?** If we ever change the consent
text, we need to prove what a person actually agreed to at the time.
→ *My recommendation: yes. Cheap now, impossible to reconstruct later.*

**Q10. Retention.** You said "retention/privacy configurable". Who sets it, and
what's the default?
→ *My recommendation: default = keep the signature record and its audit metadata
for the life of the account plus the legal retention period; make it a per-
organisation setting later. I need a default to ship.*

**Q11. What happens if one signer declines?** Today the whole request closes as
DECLINED.
→ *My recommendation: keep it — a declined multi-party document should stop, not
silently continue. Confirm, or tell me you want it to carry on with the
remaining signers.*

**Q12. Should a signature survive account deletion?** A signed record is
currently detached from the account (not a foreign key), so it stays verifiable
even if the account is later deleted.
→ *My recommendation: yes, keep it — the whole point is that evidence outlives
the system. Confirm, because it's a privacy-relevant choice.*

---

## Context Broker (item 4)

**Q13. Confirm the first real consumer: NDYCORE / NDYMAIL AI? **BLOCKING** for
trimming the scope list.** The scope catalog is a placeholder until we name one.
→ *Your preference was already NDYCORE/NDYMAIL AI; I just need it confirmed plus
roughly which actions it needs first (summarise? draft? read calendar?), so I
can cut the placeholder list down to what's real.*

**Q14. For the DATA EGRESS half — who defines provider policy?** "May this
content leave NDY infrastructure, which provider, what minimum context" is
partly a legal/policy decision, not purely engineering.
→ *My recommendation: you (with legal input) own the policy — which providers
are permitted and what may leave — and I implement it as enforceable rules. I
shouldn't be inventing what's allowed to leave the ecosystem.*

**Q15. Do you want visibility of what an agent actually did?** Right now a
member can grant/revoke access, but can't see a history of the agent's actions.
→ *My recommendation: yes, eventually — an "activity" view per agent, since a
consent screen without a record of use is hard to trust. Happy to defer it, but
want it on the list deliberately.*

---

## NDY Admin (item 3)

**Q16. Scope for v1 — what is NDY Admin actually for, first?** Cross-ecosystem
user support? Managing connected products? Financials across products? Read-only
first, or write actions immediately?
→ *My recommendation: I draft the design doc with a proposed v1 scope, and the
sync call corrects it — which is faster than waiting for a blank-page discussion.*

**Q17. When is the sync call with Hassan and Abdul?**

---

## Founding-team NDY IDs (item 6) — BLOCKING, and the quickest win

**Q18. The six login email addresses** (you, me, Qurban, Hassan, Abdul, Abrar).
This is the only thing standing between us and a finished item.

**Q19. Confirm the ID numbers/classes per person.** I need the authoritative
mapping of who gets which NDY ID (e.g. CEO = 000001, and the class segment for
each of the six) so the seed is exact rather than inferred.

**Q20. Do these six also get founding-identity titles** (the title/subtitle
shown on the Passport)? If yes, I need the exact wording for each person —
otherwise I'll seed IDs only and leave titles blank.

---

## NDYQR™ (item 7) — working, two things to confirm

**Q21. Do we want the real ND logo image embedded in the server-rendered
images?** Right now the server-rendered version draws the "ND" mark (the browser
version can use the logo file; the server needs the asset hosted where it can
read it).
→ *My recommendation: yes eventually — confirm, and I'll host the asset so both
renderers use the real logo.*

**Q22. Which product consumes NDYQR first?** Whoever it is needs registering as
a client with the `ndyqr:create` scope. NDYSTAYS (room/guest pages) is the most
concrete example you gave.
→ *My recommendation: NDYSTAYS first, as the proof case.*

**Q23. Do we want a short domain (`q.ndyhub.com`)?** Printed codes are cleaner
on a short domain than on the API host. Purely cosmetic, needs DNS.
→ *My recommendation: reserve it, low priority.*

---

## Two things that affect me day to day

**Q24. Can I get a staging or scoped database?** Five migrations are finished and
waiting, and I currently **cannot run or verify anything against a database** —
no local Postgres available here, and no production credentials (correctly — I
shouldn't have those). A staging database would let me apply migrations and prove
things end-to-end before they touch production.
→ *This is the single biggest thing slowing verification down.*

**Q25. How do you want the work committed?** The repo currently has a lot of
uncommitted work in it — some mine, some from earlier sessions. I don't want to
bundle unrelated changes into one commit or overwrite someone else's in-progress
work.
→ *My recommendation: I commit my features in clean, separate commits (NDYQR,
Signature, Trust, Context Broker), and leave everything else exactly as I found
it.*

---

## Summary — the four that actually unblock things

1. **Q18** — the six email addresses *(instant win)*
2. **Q1/Q2/Q4** — the Trust Score lock *(frees the whole score item)*
3. **Q8** — internal attestation vs legally-intentioned *(frees the Signature
   finish)*
4. **Q24** — a staging database *(unblocks verification generally)*

Everything else I can work around or decide myself with your nod.

Best,
