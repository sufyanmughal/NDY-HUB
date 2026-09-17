Hi Teun,

One architecture decision I'd like your call on before I spend time on it —
because it's pure plumbing with no visible feature, and I'd rather not build it
speculatively.

## The question

Identity verification (the LEVEL_3 document check) currently lives *inside*
NDYHUB's own API. It works, it's deployed, and it drives the Trust tier.

The idea on the table is to split it out into its own small service —
**NDY Verification Core** — that other NDY products could call directly.

**My recommendation: defer it for now.** Reasons:

1. **Nothing user-facing changes.** Splitting the service doesn't make
   verification better, faster, or available anywhere new — it's the same logic
   in a new place. The benefit only appears later.
2. **The real benefit needs a trigger that doesn't exist yet.** There are two:
   - a **real document/liveness vendor** (Persona, Onfido, etc.) gets integrated — a
     vendor is genuinely cleaner isolated in its own service; or
   - a **second NDY product** wants to verify documents directly instead of
     going through NDYHUB.
   Until one of those is actually happening, we'd be moving working code for no
   present gain.
3. **It touches something already live.** The approval flow feeds the Trust
   tier. Moving it means a cutover of the LEVEL_3 → Trust recompute chain, and
   splitting the database. That's real risk against working functionality, for
   no benefit today.
4. **It's cheaper than it looks, so waiting costs us little.** When we do want
   it, NDYHUB already has a service-to-service auth pattern (the internal
   secret used for cross-service calls) that gets reused — so it's an extraction,
   not a rebuild. Roughly a week, whenever we choose to do it.

## What I need from you

1. **Now or later?** My recommendation is later — but if you'd rather have it
   done now for strategic reasons, say so and I'll start it.
2. **Is a document-verification vendor planned for the near future?** If we're
   likely to pick Persona/Onfido within the next couple of months, that changes
   my answer — I'd rather extract the service *as part of* that integration than
   do it twice.
3. **Is any second NDY product going to need verification soon?** If NDYSTAYS
   (or another product) is going to verify businesses/documents, that's the
   other trigger.

If the answer is "not yet on both" — which is my read — then I'd leave the
current in-process module exactly as it is (it's working and it's the LEVEL_3
gate), and we revisit the moment a vendor or a second consumer is named.

No rush on this one — it's genuinely blocking nothing.

Best,
