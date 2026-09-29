Hi Teun,

Short addendum to my last update — one new capability and a couple of small
things, all committed.

**NDY Signature now has real cryptographic proof.** In your own definition, NDY
Signature is "a verified NDY digital attestation/signature **with cryptographic
proof** and independent verification". The record was attributable and
independently checkable, but it wasn't yet *cryptographically signed* — so I
closed that gap.

Now, alongside each signature we store a signed token (a JWS, RS256) covering
that signature's exact claims: the content hash, the consent wording, which
request it belongs to, who signed, and when. Two things make this practical:

- It's signed with **NDY HUB's existing published signing keypair**, so a third
  party verifies it against the keys we **already publish** — no new key material
  to distribute, and no new rotation process.
- The public verification endpoint now returns that proof plus the address of our
  published keys, so someone outside NDY can verify a signature using **only the
  document they hold and the token** — without trusting our database at all.

**One scope point I want to be straight about,** because it matters if a
signature ever faces a third party: this proves **NDY HUB attested this record**.
It does **not** claim the signer personally held a private key — that would
require a per-user signing key and is a later assurance level. I've written that
scoping into the code itself so nobody later over-reads what the proof means.
(The underlying concern is genuine: overstating a signature's strength is exactly
what makes e-signature systems fail when challenged.)

It's also deliberately fail-soft — if signing ever fails, the signature is still
recorded rather than lost, because the signature has already happened.

**Also this week:**

- **Tests for the AI permission path itself.** The Context Broker had tests, but
  the enforcement *inside* the Action Engine didn't. Now covered: a normal
  member's action never touches the AI consent layer, an AI request without
  consent is refused *and* audited, granting consent doesn't itself block
  anything, and a non-member is stopped before the AI layer is reached.
- **The data-egress design** (the half you said engineering should enforce while
  the policy stays yours) — attached separately in my previous note. It sets out
  how provider permissions, context minimisation, and audit would work, and the
  five policy questions I need from you.

**Verification:** API builds clean, **122 automated tests pass**, web builds for
production, lint clean on everything I've touched.

**One housekeeping flag:** the project's API lint check is already failing in 13
files that have nothing to do with my work (34 errors). Mine are clean — I'm
flagging it only so it's clear it isn't new, and so someone can own it. I haven't
touched those files.

**Still waiting on:** a staging database (which unblocks applying and verifying
all eight migrations end to end), the retention default, the failed-login weight,
the provider allow-list, the email-normalisation decision, and the six founding
emails plus title wording. Nothing else is blocked on engineering.

Best,
