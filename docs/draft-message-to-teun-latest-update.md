Hi Teun,

Update on the work since my last message. Everything below is committed and
verified.

**Verification:** API builds clean; **126 automated tests pass** across 14
suites; lint is clean on every file I have touched; the web app builds for
production.

---

## 1. Signature proof status, validation and recovery — implemented

You asked for three specific things, and they are now implemented rather than
described:

- **Explicit status on every signature:** *pending*, *verified*, or *failed*.
  It defaults to *pending*, so a record that never obtained a proof cannot read as
  verified. Previously that state had to be inferred from whether a token was
  present, which is the ambiguity you flagged.
- **Verified is earned, not assumed.** After a proof is generated, it is verified
  against our own published key, with the required issuer and audience. Only then
  is it treated as a proof.
- **A failed or pending proof is never presented as cryptographic evidence.** The
  public verification endpoint returns the proof *only* when it is verified;
  otherwise it reports the status, and the token is withheld entirely. The
  product will follow the same rule.
- **Audited retry path.** Each attempt is recorded on the record itself — attempt
  count, last error, and the time of the successful attestation — and retrying is
  idempotent: an already-verified signature is left untouched, and a failed one is
  recoverable with the attempt recorded.
- The member's action is still preserved if proof generation fails. The signature
  happened; only the claim about the proof is withheld.

**Your three verification questions are now enforced in code, not just answered:**

1. **Document hash** — the hash is inside the signed payload, so a verifier
   compares their own SHA-256 of the document against the claim; a mismatch means
   a different document or a modified token, and verification fails. No trust in
   our database is required.
2. **Key selection after rotation** — the token names its key, and the verifier
   selects that key from our published set. The operational rule is that a key
   stays published while tokens signed with it may still need verifying.
3. **Wrong-purpose rejection** — issuer and audience are now *required* during
   validation, so a token genuinely signed by us for a different purpose (a login
   token, for example) fails verification. This is tested.

## 2. Launch capacity plan — delivered

The plan is written and attached. It covers: how to define "250,000 in a day" as a
testable peak rate rather than a headline figure; the traffic model per flow
(registration, login including 2FA and passkeys, messaging, NDYCIRCLES, NDYCORE);
what happens when a dependency slows — with the principle that **NDY ID remains
available regardless of what else is degraded**, and everything else degrades
gracefully; monitoring and service levels; and staged access as a deliberate
pressure valve rather than an emergency measure.

Each target is paired with the test that will prove it, including a **degradation
test** that injects latency and errors into non-identity dependencies and asserts
that identity flows still succeed. That test is the difference between a capacity
plan and a promise.

To put real numbers against it, I need your expected volumes, whether the target
is sign-ups or active users, any known peak window, and whether staged access is
acceptable at launch.

The Hyves launch is recorded strictly as a scale benchmark, with no inference
about how their waitlist was planned. The Prosus review remains a separate
deliverable.

## 3. AI permission tests

The consent enforcement inside the Action Engine is now covered: a normal member's
action never touches the AI consent layer; an AI request without consent is
refused *and* audited; granting consent does not itself block anything; and a
non-member is stopped before the AI layer is reached.

## 4. Data-egress questions

The five policy questions, with a recommended option for each, are in my previous
message. Once you decide, I will implement enforcement as described in the
egress design.

---

## Outstanding, and honestly not blocked on engineering

- **A staging database.** This is the main constraint: nine migrations are written
  and verified free of schema drift, but I have no database I can reach, so none
  of it has been exercised end to end against real data.
- **Retention period** for signature evidence.
- **Failed-login weight** for the Trust Score (captured, not scored — I would
  rather take a figure from you than invent one).
- **Provider allow-list** for data egress.
- **Email normalisation decision** — email is currently matched case-sensitively,
  so one person could end up with two accounts. This is the identity-integrity
  finding I raised; it touches authentication, so I have not changed it quietly.
- **Six founding email addresses** and title wording.
- **NDY Admin sync date.**
- **NDYVIXIT repository and branch**, so I can verify the `&` handling and give you
  a proper status update rather than an assumption.

Best regards,
