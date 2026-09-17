# Phase 8 — NDY Signature + NDY Trust v1 (Design Proposal)

**Status: proposal, not yet built.** Unlike every other phase in this
project, Phase 8 has no prior client spec or design doc behind it — it
exists only as a task title ("NDY Signature + NDY Trust v1"). This document
is a first-pass architecture proposal grounded in what the two names most
plausibly mean and in this codebase's existing conventions, written so it
can be reviewed and corrected before any schema or code is touched — the
same discipline every prior phase (Bridge, Business Center, Reward Engine)
followed by shipping a design doc with explicit open questions first.

**Do not build against this document until the open questions in §5 are
answered** — several of them change the data model, not just the UI.

---

## 0. Working definitions (inferred, not confirmed)

- **NDY Trust** — a per-user, per-claim trust/verification signal, shown
  publicly (likely on the Passport card) as something like a trust score or
  a set of verification badges. This is a natural extension of Phase 7's
  `PassportClaim`/`ClaimProvenance` work, not a new concept — Phase 7
  already built "is this claim self-asserted, NDY-verified, or backed by a
  third-party credential" as a per-claim fact. NDY Trust v1, under this
  reading, is the *aggregation and display* layer on top of claims that
  already exist, plus a small number of new trust-relevant claim types
  (e.g. "business verified," "long-standing account," "no security
  incidents").
- **NDY Signature** — a way for a user to cryptographically or
  procedurally "sign" something inside the ecosystem — most plausibly
  e-signing a document (a contract, a business agreement) or attesting to
  a statement, with NDY HUB acting as the identity behind the signature
  (leveraging the same permanent `ndyId`/`ndyCoreId` identity this entire
  system is built on). This is a different problem from Trust: Trust is
  "how much do we/others trust this identity," Signature is "this identity
  formally attested to X at time T."

These two could also plausibly mean something narrower — e.g. "Signature"
as just a verified digital business-card/email-signature block, or "Trust"
as literally just a numeric score with no claims involved. **This is
exactly the ambiguity §5 needs resolved before scope is locked.**

---

## 1. Why Trust builds on Phase 7, not from scratch

Phase 7 already has the right shape: `PassportClaim` (userId, claimKey,
provenance, issuer, verifiedAt, metadata) is a general per-user claims
ledger. Re-deriving a parallel "trust facts about a user" table would
duplicate exactly what this one already does. NDY Trust v1's real new work
is:

1. A small, fixed catalog of trust-relevant claim keys (see §3) that
   `PassportClaim` doesn't have any producer for yet — nothing today writes
   `claimKey: "business_verified"` or `claimKey: "no_fraud_flags"`.
2. A derived, cacheable **trust score or tier** computed from a user's
   claim set — new, since nothing aggregates `PassportClaim` rows today.
3. Public display of that score/tier on the Passport card and API.

## 2. Why Signature is a new, small domain — not an Action Engine action

Signing a document is tempting to model as just another `ActionDefinition`
(the Action Engine already has propose → authorize → validate → execute →
log). But a signature has different requirements a generic action doesn't:
it needs to produce a durable, independently-verifiable artifact (what was
signed, by whom, when, with what identity proof) that has to remain valid
evidence indefinitely — an `ActionLogEntry` is an internal audit trail, not
designed to be exported as proof to a third party (e.g. "here is
cryptographic proof this NDY user signed this document on this date").

So Phase 8 proposes `SignatureRequest`/`Signature` as their own small
domain, but explicitly **reusing** what already works rather than
reinventing it:
- The same denormalized-actor-snapshot pattern as `AuditLogEntry` /
  `ActionLogEntry` (signerUserId + signerNdyId, not just a live FK).
- The same single-use-token life-cycle shape as every invite/reset flow
  (`WorkspaceInvite`, `emailVerificationTokenHash`) for the "signing link"
  a document recipient uses.
- `NotificationService` (Phase 2) for "you have a document to sign" /
  "your document was signed" alerts.
- Optional: routed through the Action Engine as a single registered action
  (`signature.document.sign`, risk tier HIGH) purely for the approval/audit
  trail benefits, if `docs/action-engine-design.md`'s existing pattern is
  wanted here too — flagged as an open decision in §5, not assumed.

---

## 3. Proposed schema (draft — not final)

```prisma
// --- NDY Trust ---
// Builds on Phase 7's PassportClaim rather than duplicating it — see
// docs/phase8-signature-trust-design.md §1. New claimKeys this phase
// introduces a producer for; the aggregation/scoring is new.

enum TrustTier {
  UNVERIFIED   // LEVEL_0/1, no meaningful claims yet
  BASIC        // email + phone verified (existing LEVEL_2)
  VERIFIED     // + identity document (existing LEVEL_3, via IdentityVerificationRequest)
  TRUSTED      // VERIFIED + at least one additional trust claim (business verified, account age, etc.)
}

// Derived/cached, not the source of truth — PassportClaim rows remain
// authoritative; this is a materialized view recomputed whenever a
// relevant claim changes, same "cache a derived value, never trust it
// blindly" reasoning as considered (and rejected) for NDYBITS balance in
// Phase 5's design notes.
model TrustProfile {
  id          String    @id @default(uuid())
  userId      String    @unique
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tier        TrustTier @default(UNVERIFIED)
  score       Int       @default(0) // 0-100, exact formula TBD — see §5
  computedAt  DateTime  @default(now())
}

// --- NDY Signature ---
// A document/statement signed by an NDY-identified user. Deliberately
// separate from ActionLogEntry — see §2 for why a signature needs to be a
// durable, independently-verifiable artifact rather than an internal audit
// row.

enum SignatureRequestStatus {
  PENDING
  SIGNED
  DECLINED
  EXPIRED
  REVOKED
}

// A document/statement awaiting one or more signatures. contentHash lets
// the signed artifact be verified byte-for-byte later without NDY HUB
// necessarily storing the document itself (mirrors IdentityVerificationRequest's
// "don't store the sensitive artifact, store a reference/hash to it" choice).
model SignatureRequest {
  id              String                  @id @default(uuid())
  title           String
  contentHash     String                  // sha256 of the document/statement content
  contentRef      String?                 // pointer to where the actual document lives (a DriveFile id, an external URL) — never the raw bytes here
  createdByUserId String
  createdByNdyId  String
  status          SignatureRequestStatus  @default(PENDING)
  expiresAt       DateTime?
  createdAt       DateTime                @default(now())

  signers  SignatureRequestSigner[]
  signatures Signature[]
}

// One row per required signer — supports multi-party signing (e.g. two
// business workspace members both signing the same document) without a
// schema change.
model SignatureRequestSigner {
  id                  String            @id @default(uuid())
  signatureRequestId  String
  signatureRequest    SignatureRequest  @relation(fields: [signatureRequestId], references: [id], onDelete: Cascade)
  userId              String?           // null until resolved, if invited by email
  invitedEmail        String?
  tokenHash           String            @unique // same single-use-token shape as WorkspaceInvite
  signedAt            DateTime?
  expiresAt           DateTime

  @@index([signatureRequestId])
}

// The actual, immutable signature event — kept separate from the "signer
// slot" above so a re-sent/re-issued signer row never mutates a completed
// signature's own record.
model Signature {
  id                  String            @id @default(uuid())
  signatureRequestId  String
  signatureRequest    SignatureRequest  @relation(fields: [signatureRequestId], references: [id], onDelete: Cascade)
  signerUserId        String
  signerNdyId         String            // denormalized snapshot, same reasoning as AuditLogEntry
  contentHash         String            // copied from SignatureRequest at sign time — proves what was actually signed, even if the request row is later altered
  ip                  String?
  userAgent           String?
  signedAt            DateTime          @default(now())

  @@index([signatureRequestId])
  @@index([signerUserId])
}
```

## 4. Proposed services (draft)

- `TrustService.recomputeForUser(userId)` — reads the user's
  `PassportClaim` rows + `verificationLevel`, derives `TrustTier` + score,
  upserts `TrustProfile`. Called after any claim-affecting event (identity
  verification approved, business workspace approved, etc.) — same
  "recompute on write, never on read" pattern as considered for other
  derived values in this codebase.
- `SignatureService` — `create()` (propose, mint signer tokens, notify via
  `NotificationService`), `sign(token, ip, userAgent)` (validates token,
  writes `Signature`, marks signer resolved, flips `SignatureRequest.status`
  to SIGNED once every signer has signed), `decline()`, `revoke()`.
- `GET /passport/:ndyId` (existing, Phase 7-touched) gains a `trust` field
  in its response once `TrustProfile` exists.
- New `GET /signature/verify/:signatureId` — public, unauthenticated,
  returns the signature's contentHash + signerNdyId + signedAt only (no PII
  beyond what's already public via ndyId) so a third party can verify a
  signature independently, mirroring the existing public
  `/passport/:ndyId` verification pattern.

---

## 5. Open questions — need your answer before this is built

1. **Does "NDY Trust" mean a public score/badge system as described here,
   or something else** (e.g. a trust relationship *between* two users/
   businesses, like a vouching system)? This changes the data model
   significantly — §3's `TrustProfile` assumes a single-user score, not a
   graph.
2. **Does "NDY Signature" mean document e-signing** as proposed, or a
   narrower "verified signature block" (e.g. an email/document footer
   proving identity, no actual document-signing workflow)? If narrower,
   §3's `SignatureRequest`/`Signature`/`SignatureRequestSigner` three-table
   design is over-scoped and should shrink.
3. **Legal weight** — is this meant to be a legally-binding e-signature
   (which typically requires specific consent-language/audit-trail
   compliance, e.g. eIDAS/ESIGN Act requirements), or an internal
   attestation with no legal claim attached? This is a real scope/liability
   decision, not an engineering default to assume.
4. **Trust score formula** — what should actually move the score/tier?
   Proposed default: email+phone = BASIC, +identity doc = VERIFIED,
   +business verification or account-age threshold = TRUSTED. Confirm or
   replace before `TrustService` is built, since silently shipping a wrong
   formula is worse than not shipping a score at all.
5. **Does a Signature route through the Action Engine** (as a registered
   `signature.document.sign` action, gaining its approval/audit-trail
   machinery for free) or stay a fully separate domain as drafted in §3?
   Recommend separate (§2's reasoning), but flag since it's a real
   architectural fork.
6. Any real product surface already promised to a client/user for either
   feature that this document should be aware of? (i.e. was "NDY Signature"
   or "NDY Trust" mentioned in a client conversation not yet reflected in
   this repo's docs?)

---

## 6. What this document deliberately does not do

Per this project's own standing discipline (see every other phase's design
doc): no schema migration, no service code, and no controller has been
written against this proposal. Nothing here is committed. This is the
sign-off artifact, not the implementation.
