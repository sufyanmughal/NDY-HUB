NDY Economy — Implementation Plan

Companion to the NDY Economy Claude Specification document. That document is an architecture/economics reference; this document turns it into a sequenced, engineering-grounded plan against the actual NDY HUB codebase as it exists today — what's already real, what's genuinely new, and in what order it's safe to build.


0. What already exists (read from the live codebase, not assumed)

This matters because the spec reads like a from-scratch economy, but two of its four layers are already partially real:

CRYNDY: a real presale pipeline already exists. Every purchase is tracked through a full status pipeline — Payment Pending, Payment Confirmed, Under Review, Verified, Allocated, Locked, Available, Distributed On-Chain (or Cancelled/Refunded) — driven by a webhook from an external presale provider. The dashboard already shows total CRYNDY sold and a daily sales trend.

NDYBITS: a real, append-only ledger exists, with idempotency built in (the same triggering event can never post a duplicate credit, even on webhook retries). No earning triggers beyond CRYNDY purchase rewards are wired up yet — referrals, NDYQUIZ, challenges, and the other earning sources listed in the spec don't exist as features yet.

NDYHUB identity: already has exactly the permanent-identity architecture the spec asks for in section 17 — a permanent internal UUID plus a permanent Core ID, with a public display layer (the NDY ID, formatted as NDY-TYPE-CoreID) on top. This was completed this week; section 17 is not new work.

Founder Mission Control: exists today but is a thin overview page, not the economic command center section 18 describes.

NDYBTC: does not exist at all. No model, no service, no UI, nothing. This is the one genuinely greenfield piece.

Treasury, multisig, vesting, wallet-role model: none of this exists. There is currently no on-chain wallet integration anywhere in this codebase — CRYNDY's "on-chain distribution" status is tracked as a database status today, not an actual blockchain transaction the app originates.

Implication: this plan is not "build a token economy from zero." It's "formalize the supply/allocation model around CRYNDY, build NDYBTC as a new asset following the same patterns, and build the treasury/vesting/monitoring layer the spec's later sections describe" — genuinely large, but built on real foundations, not starting from nothing.


1. What this plan deliberately does not do yet

Per the spec's own sections 19 and 23, legal/regulatory review and an independent smart-contract audit are required before any public token sale, listing, or on-chain deployment. This plan:

Builds the data model, internal tooling, and admin-facing visibility the spec describes.

Does not deploy any smart contract, does not enable public NDYBTC purchase, and does not connect real on-chain wallets to real funds, until legal review is confirmed complete.

Treats every euro figure in the spec as a reference value for internal planning and UI display only — never presented to end users as a guaranteed price, per the spec's own explicit instruction in sections 13 and 19.

This is a hard gate, not a suggestion — flagged clearly here so it isn't silently skipped under deadline pressure later.


2. Phased build order

Phase 1 — Formalize CRYNDY supply accounting (foundation, low risk)

CRYNDY already sells; it just has no concept of "total supply" or "circulating vs. locked vs. treasury." This phase adds that concept without changing any existing purchase-flow behavior.

- A new allocation model representing the supply split once approved (Public, Treasury, Community, Liquidity, Partnerships, Product Development, Strategic Reserve, Team — mirroring the spec's list; exact percentages are a client decision, not an engineering one — see section 3 below).
- A supply-reporting layer that shows: total supply (fixed at 21,000,000 per the spec), allocated-per-bucket, and circulating supply (derived from purchases already in Available or Distributed On-Chain status) — purely additive reporting, doesn't touch the purchase pipeline itself.
- Surfaced on Founder Mission Control (see Phase 4).

Phase 2 — NDYBTC data model (new asset, no sale mechanism yet)

Mirrors CRYNDY's existing shape rather than inventing a new pattern.

- An allocation model for NDYBTC, seeded from the spec's proposed table once percentages are confirmed (30/25/15/10/10/5/5 across Treasury, Growth, Community, Liquidity, Founders, Partners, and Launch Reserve).
- An append-only, idempotent ledger for internally tracking allocation and vesting movements. No public purchase flow in this phase — this is internal bookkeeping only, since NDYBTC isn't legally cleared for public sale yet.
- A fixed maximum supply of 1,000,000, enforced at the application layer for now (a true on-chain fixed cap only exists once an audited smart contract is deployed, exactly as the spec itself describes).

Phase 3 — Vesting and lock-up model

Needed before the Founders, Team, and Partners allocations from Phase 2 mean anything real — an allocation with no vesting attached is just a number.

- A vesting schedule model: linked to an allocation bucket or a specific holder, with a start date, cliff period, vesting duration, and release cadence.
- A calculation service that computes "vested to date" versus "locked" for any schedule — pure calculation, no automatic fund movement, since there's no wallet integration to move funds yet.
- This is where the spec's requirement that no founder, partner, or developer can release their entire allocation immediately becomes an actual enforced rule rather than a policy statement.

Phase 4 — Founder Mission Control: economic command center

This is where everything above becomes visible, per the spec's section 18. Extends the existing (currently thin) Founder page rather than a rebuild.

- NDYBITS issued, total and trend.
- CRYNDY: total supply, circulating supply, per-bucket allocation, treasury balance.
- NDYBTC: max supply, circulating, locked/vested versus available.
- Vesting schedule visibility — who or what is vesting, how much unlocks and when.
- Wallet and treasury balances — only once real wallet integration exists (Phase 6 or later); until then this section honestly shows "not yet connected" rather than fabricated numbers, consistent with how this platform already handles other not-yet-real metrics elsewhere.
- Security alerts and major transactions feed, scoped to economy-relevant events.

Phase 5 — Treasury security architecture (policy and access control first)

The spec asks for multisig, hardware keys, cold storage, role-based permissions, transaction limits, and audit logs. Sequencing matters here:

- Role-based permissions and audit logging are buildable now, using the exact same permission and audit-log architecture already in place elsewhere in the platform.
- Multisig, hardware keys, and cold storage are not software this app builds — they are operational, custodial infrastructure (for example, a multisig wallet product, hardware security keys held by multiple real people) that exists outside this codebase. This app's role is recording and displaying treasury state, and controlling who is allowed to propose an action — not custodying funds directly. Flagging this distinction clearly so "build treasury security" isn't mistaken for "this app becomes a crypto wallet."

Phase 6 and beyond — Everything gated on legal review (not started until confirmed)

- Real on-chain wallet integration (blockchain selection is itself still an open decision per the spec's own roadmap).
- Public NDYBTC purchase flow, mirroring CRYNDY's existing pipeline shape, once legally cleared.
- Smart contract deployment and independent audit.
- Any conversion mechanism between NDYBITS, CRYNDY, and NDYBTC — explicitly optional per the spec, and explicitly gated behind separate legal review even if eventually built.


3. Decisions that are the client's, not engineering's

Flagged now so they don't become silent guesses later:

1. Exact CRYNDY and NDYBTC allocation percentages — the spec gives a proposed split; needs explicit sign-off before Phase 1 and 2's data is finalized as anything other than a placeholder.

2. Blockchain selection — the spec itself lists this as an open roadmap item, not a decision already made.

3. Whether NDYBITS, CRYNDY, and NDYBTC get any conversion mechanism at all — the spec says this must not be assumed.

4. Legal review scope and timeline — blocks all of Phase 6, and realistically should start in parallel with Phases 1 through 5 given how long securities and crypto legal review typically takes, not after engineering finishes.

5. Custodial setup for the real treasury wallets — who holds keys, which multisig provider — an operational decision outside this codebase entirely.


4. Suggested immediate next step

Phase 1 (CRYNDY supply accounting) is the lowest-risk, highest-context starting point: it's purely additive reporting on top of a pipeline that already works correctly, needs no new legal exposure, and directly unblocks Phase 4's Founder Mission Control dashboard work — likely the most immediately visible progress for the client to see.

Recommended to start there once the allocation percentages in section 3, item 1 are confirmed — even as a placeholder split, clearly labeled non-final, so the data model isn't blocked on a business decision that can be revisited later.
