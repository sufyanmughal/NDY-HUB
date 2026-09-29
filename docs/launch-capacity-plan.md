# NDY Launch Capacity Plan (draft for target sign-off)

**Status: draft.** The structure is settled; the target numbers are not, because
they depend on the client's expected volumes. Everything marked *[needs input]* is
waiting on that. The purpose of this document is to agree what we are measuring,
what must hold under pressure, and how we will prove it before launch.

---

## 1. Define the target before committing to it

"250,000 sign-ups in a day" is not yet a testable requirement. We need to fix:

- **Which figure:** sign-ups, active users, or both. A day can absorb a flat rate;
  a launch spike cannot.
- **The shape of the day:** steady load, or a spike within a short window. A
  30-minute spike is the number we must actually survive.
- **The conversion:** many visitors per sign-up, and login traffic typically
  several times the sign-up rate once people start returning.

From those we derive a **peak requests per second per flow**, and that is what we
design and test against. *[needs input: expected volumes, peak window,
visitors-to-sign-up ratio]*

## 2. Traffic model per flow

Each flow stresses a different part of the system, so a single "capacity" number
is meaningless:

| Flow | What it stresses | Notes |
|---|---|---|
| **Registration** | Database writes, email/verification delivery, ID generation | Highest write amplification; ID generation must stay collision-safe under concurrency |
| **Login** | Password hashing (CPU-bound), 2FA, passkeys | Deliberately expensive by design — the cost is the security property, so this flow needs capacity, not shortcuts |
| **Messaging** | Throughput, storage, provider rate limits | Degrades independently of identity |
| **NDYCIRCLES** | Calls into another service, read-heavy | Must not make identity unavailable if it is slow |
| **NDYCORE** | Event volume, downstream processing | Call-volume heavy; should be asynchronous where possible |

## 3. Behaviour under pressure

The governing principle: **NDY ID must remain available regardless of what else is
struggling.** If NDY ID is down, nothing else in the ecosystem can work, so it
cannot share a fate with any other component.

Per flow:

- **Identity (registration/login): highest priority.** Hardened against downstream
  slowness — it must not queue behind messaging or NDYCIRCLES.
- **Messaging / NDYCIRCLES / NDYCORE: degrade gracefully.** If a dependency slows,
  the affected feature queues, shows a clear state, and recovers; it does not take
  identity with it.
- **Fail-closed only where correctness requires it** (authorisation, billing). For
  everything else, degraded service beats an outage.

*[needs input: whether any feature may be fully disabled during peak, and whether
that is acceptable product behaviour]*

## 4. Monitoring and service levels

- **Metrics per flow:** request rate, error rate, latency percentiles, queue depth,
  database connection saturation, provider error rates.
- **Alerts** on error-rate and latency thresholds per flow, and on queue depth
  growing rather than draining — the early signal of saturation.
- **Service levels** stated per flow once the target numbers are fixed, with the
  explicit understanding that login may be allowed to be slower than browsing
  while remaining correct.

## 5. Staged access and limits

The pressure valve, chosen deliberately rather than improvised during an incident:

- **Per-flow rate limits**, tighter on the expensive and abuse-prone endpoints
  (already in place for auth paths).
- **Queueing** for expensive operations rather than rejecting them outright.
- **Waitlist / invite-gated registration** that can be switched on as a managed
  decision. This is the lever that makes an unknown launch day survivable: we
  admit at a rate we can serve instead of accepting everyone and failing them.

*[needs input: is staged access acceptable at launch, and who decides when to
enable it]*

## 6. Targets and the tests that prove them

Once §1 is fixed, this table gets real numbers, and each row gets a test:

| Target | Test |
|---|---|
| Peak RPS sustained on registration | Load test against staging at target rate |
| Peak RPS on login, including 2FA/passkey | Load test, measuring hashing saturation |
| Messaging throughput | Load test with provider stubbed at real rate limits |
| NDYCIRCLES/NDYCORE call volume | Load test with downstream latency injected |
| Identity available while a dependency is slow | **Degradation test**: inject induced latency/errors into each non-identity dependency and assert identity flows still succeed |
| Staged access engages correctly | Test that the gate admits at the configured rate and fails safe |

The degradation row is the most important one: it is the difference between a
capacity plan and a promise.

## 7. Benchmark note

The Hyves launch is used **only** as a scale reference — an example of what a
launch of that magnitude looks like in practice. We are not inferring anything
about how their waitlist was planned or improvised, and no design decision here
depends on that.

## 8. Separate deliverable

The Prosus review is a distinct piece of work: how they connect services through
AI, what is actually live versus announced, and which ideas are relevant to our
roadmap. It will be reported separately so the two conclusions are not blended.
