# Replies to Teun — four messages

Four replies, in order. Each is written to be sent independently.

---

## Reply 1 — Launch capacity planning

Hi Teun,

Agreed. Before committing to 250,000 sign-ups in a day, we should define precisely
what that figure means and verify it under test.

The plan will cover:

**1. Target definition.** Convert the headline figure into peak load per second.
250,000 sign-ups within a day differs materially from the same volume within a
30-minute window, and both differ from 250,000 active users on launch day.

**2. Traffic model per flow.** Registration; login, including 2FA and passkeys;
messaging; NDYCIRCLES; NDYCORE. Each has a different cost profile: identity
operations are database and compute intensive, messaging is throughput intensive,
and NDYCIRCLES and NDYCORE depend on external call volume.

**3. Degradation behaviour.** Defined per dependency. The required outcome is that
NDY ID remains available and members can always authenticate and manage their
identity, even when messaging or a downstream service is degraded.

**4. Monitoring and service levels.** Metrics, alert thresholds, and the service
levels we commit to, with load tests against staging covering both normal load and
the degradation paths.

**5. Staged access controls.** Per-flow rate limits, queueing for expensive
operations, and a waitlist or invite-gated mode that can be enabled deliberately
rather than as an emergency measure.

I will use the Hyves launch strictly as a scale benchmark, without inferring
anything about how their waitlist was planned.

To make the plan concrete, I need: expected volumes or your best estimate;
confirmation of whether the target is sign-ups, active users, or both; any known
peak window; and whether staged access is acceptable product behaviour at launch,
since that affects the design.

As requested, I will keep the two outcomes separate: the launch capacity plan, and
the Prosus review covering which AI service integrations are actually live versus
announced, and which are relevant to our roadmap.

Best regards,

---

## Reply 2 — Signature proof status, verification, and data-egress questions

Hi Teun,

Agreed on both points. Attestation status will be explicit in the API and the
product interface:

- Each signature will carry an attestation state: **verified**, **proof pending**,
  or **proof failed**.
- A signature will not be presented as cryptographically verified until the proof
  exists and has been validated. Both the API and the UI will reflect this.
- If proof generation fails, the member's action remains recorded and the failed
  state is visible.
- A failed proof will have an audited retry and recovery path, with every attempt
  recorded.

**Verification model**

1. **Document hash.** The verifier computes the SHA-256 hash of the document and
   compares it with the `contentHash` claim inside the signed token. Because the
   hash is part of the signed payload, a mismatch indicates either a different
   document or a modified token, and verification fails in both cases. No query to
   our database is required.

2. **Key selection and rotation.** The token header identifies the signing key by
   `kid`. The verifier retrieves our published key set (JWKS) and selects the key
   with the matching `kid`. Operationally, a key will remain published for as long
   as tokens signed with it may require verification; retiring a key at the same
   time as publishing its replacement would invalidate existing verifications.

3. **Purpose binding.** The token includes our issuer (`iss`) and an audience
   naming this specific use (`aud`, `ndy-signature`). Verification must require
   that audience and token type, so a token issued for a different purpose, such as
   a login `id_token`, is rejected despite being validly signed by us. This
   prevents a validly signed token from being accepted outside its intended use.

**Data-egress policy questions, with a recommended option for each**

1. **Which providers may receive NDY data at all?**
   Recommended: one named provider for NDYMAIL AI. An empty list for all others,
   meaning no egress permitted.

2. **Per-provider, or per-provider and data class?**
   Recommended: per-provider and data class. Approval for metadata does not extend
   to message bodies.

3. **Should any data class never be permitted to leave?**
   Recommended: attachments excluded in phase 1. Message bodies permitted only
   under an explicitly named consent.

4. **What may the provider retain?**
   Recommended: no retention and no training on message content. Metadata
   retention only where operationally unavoidable, and stated explicitly.

5. **Who may add a provider?**
   Recommended: a governed approval step with an audit record, rather than a
   routine configuration change.

Once you confirm these, I will implement the enforcement as described in the
data-egress design.

Best regards,

---

## Reply 3 — NDYVIXIT and the `&` character

Hi Teun,

I have not yet verified this and will not state a position until I have. The
NDYVIXIT codebase is not present in the environment I am working in; the only
reference I can locate is NDYVIXIT as a product type in the NDYQR code, which is
unrelated to NDYVIXIT's own implementation.

Please confirm the repository and branch, and I will verify it and report back
with evidence.

The areas I will review:

- **Registration:** whether `&` is accepted by validation and stored unmodified.
- **Profile links:** whether handles are percent-encoded (`&` as `%26`) when placed
  in a URL, and whether any path double-encodes.
- **Search:** whether handles containing `&` are matched correctly.
- **Mentions:** whether a handle containing `&` is parsed as a single token rather
  than being split.
- **NDY ID integration:** whether any generated URL or deep link assumes a
  URL-safe handle.

The specific risk is raw interpolation of a handle into a URL. In that case, links
work for simple handles and fail for handles containing `&`, which typically
passes casual testing and fails in production.

Best regards,

---

## Reply 4 — NDYVIXIT status update

Hi Teun,

I cannot provide an accurate status update on NDYVIXIT at present, because I have
not reviewed that codebase; it is not in the environment I am working in. I would
rather not describe it from assumption, as that is more likely to mislead shortly
before a build.

With repository and branch access, I will send an update covering:

1. **Complete and working** — what is implemented and demonstrably functional,
   with supporting evidence (tests or observed behaviour).
2. **In development** — what is partial, and what remains outstanding.
3. **Tested** — what has been verified, and explicitly what has not, distinguishing
   verified from assumed.
4. **Next milestone** — the minimum set of items that must be complete before a
   build is worth your time to test.

If preferable, I can coordinate directly with the owner of that repository.

Best regards,
