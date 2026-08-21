# NDYHUB as Central Identity Authority — Hardening Plan

Response to the client's Aug 2026 review of `docs/MOBILE-INTEGRATION.md`
("One Identity. One Ecosystem. One Intelligence."). Six concrete
architecture points, a scoping principle, and a long-term AI-fabric
direction. This document turns that feedback into sequenced, buildable
phases against the actual current codebase — grounded in what already
exists, not a restatement of the vision.

---

## 0. Where things already stand (verified against the code, not assumed)

Two of the six points are **already correct today** — worth confirming
explicitly rather than re-building:

- **Point 1 (permanent internal UUID)**: `OAuthTokenService.issueTokenSet`
  already sets `sub: params.userId` — `User.id`, the internal UUID — as
  the OIDC subject claim, never `ndyId` or email. Every relying party
  already gets the permanent identifier. Nothing to change here beyond
  documenting it as a hard contract (§5 below formalizes "never break
  this").
- **Point 2 (Universal Links preferred)**: `docs/MOBILE-INTEGRATION.md`
  §0 already offers both custom schemes and App Links/Universal Links as
  options — this is a documentation *framing* change (state App Links as
  the preferred default, custom scheme as the fallback), not new code.

The other four are real gaps, verified directly against the running code:

- **Point 3 (refresh token security)**: `OAuthTokenService.rotateRefreshToken`
  already does one-time rotation (the old token is marked `revokedAt` the
  moment it's used) — but there is **no reuse detection**. Presenting an
  already-revoked refresh token today just throws "invalid or revoked,"
  the same generic error as an expired one. It does not distinguish
  "this token was already used once, someone else may have stolen it" and
  does not do anything about it (kill the session family, alert the user).
- **Point 4 (central session/device management)**: `Session` (NDY HUB's
  own dashboard login) already has `revokeSession`/`revokeAllSessions` —
  but this is completely disconnected from `OAuthRefreshToken` (tokens
  issued to NDJOYIT, NDYAPPS, etc.). Today, "sign out everywhere" on the
  `/security` page does not revoke a single OAuth-issued token to a
  connected app. No device fingerprinting/naming exists on either model.
- **Point 5 (generic event contract)**: only exists today as the NDY
  Economy-specific shape (`POST /ndy-economy/events/report`,
  `NdyEconomyEventLog`) — genuinely scoped to reward events, not a general
  ecosystem event bus.
- **Point 6 (granular scopes)**: `oauth/scopes.ts`'s `OIDC_SCOPES` has 5
  entries today (`openid profile email membership cryndy`) plus the one
  server-to-server capability scope (`ndybits:report-event`) — no
  `:read`/`:write` granularity on any of them.

---

## 1. Sequencing verdict

**Security fixes first, contract/scope work second, cross-cutting
session/device work third.** Reasoning:

- Point 3 (refresh token reuse detection) is the one item here with real
  exposure *today*, on every existing OAuth integration — it should ship
  before more OAuth clients (Hassan's app, others) go live, not after.
- Points 5 and 6 (event contract, granular scopes) are additive schema
  work with no migration risk to anything live — safe to build in
  parallel with Point 3, and they unblock the client's stated "future NDY
  products integrate without a new sync mechanism each time" goal fastest.
- Point 4 (central session/device management) is the largest of the four
  — it touches two existing models (`Session`, `OAuthRefreshToken`),
  needs a real device-identification strategy, and is the one most worth
  a design checkpoint with the client before implementation, since "kill
  a device across every NDY product" has real UX implications (what does
  a user see, on which product, when their session dies mid-use).

Point 2's documentation change ships immediately, standalone, no
dependency on anything else.

---

## Phase A — Refresh Token Reuse Detection (security-critical, ship first)

**Goal**: detect when an already-rotated (revoked) refresh token is
presented again — the standard signal that a token was stolen and the
attacker is now racing the legitimate client — and respond by revoking
every token in that refresh chain, not just the one presented.

**Schema**: add `familyId` to `OAuthRefreshToken` (a UUID shared by every
token descended from the same original grant — set once at
`issueTokenSet`, carried forward unchanged on every `rotateRefreshToken`
call, exactly the "token family" concept OAuth 2.1's own reuse-detection
guidance describes).

```prisma
model OAuthRefreshToken {
  // ...existing fields unchanged...
  familyId String   // shared across every token descended from one grant
  @@index([familyId])
}
```

**Service change** (`OAuthTokenService.rotateRefreshToken`): if the
presented token's hash matches a row where `revokedAt` is already set
(i.e., this exact token was already exchanged once before), that's reuse
— revoke every `OAuthRefreshToken` sharing that `familyId`, write a
`SecurityEvent` (new type: `OAUTH_TOKEN_REUSE_DETECTED`) for the user, and
notify them via the Phase 2 notification backbone (SECURITY category,
EMAIL channel — this needs to reach the user even if they're not looking
at any NDY product right now).

**Why this doesn't touch access tokens**: access tokens are already
short-lived (1 hour) and self-expire; the exposure window this closes is
specifically "a stolen refresh token lets an attacker mint new sessions
indefinitely." Killing the family also implicitly logs out the legitimate
user's session using that same chain — an acceptable, expected trade-off
identical to what every major OAuth provider does on detected reuse.

**Not in scope for Phase A**: rate-limiting or IP/device anomaly
detection beyond reuse itself — that's a fraud-signal problem worth its
own pass, not bundled into "detect literal token reuse."

---

## Phase B — Ecosystem Event Contract v1 (generalizes NDY Economy's pattern)

**Goal**: one reusable event-intake contract every NDY product reports
through, replacing "build a new sync mechanism per product." Directly
answers the client's example list (`identity.updated`, `profile.updated`,
`booking.created`, `quiz.completed`, `steps.goal_completed`,
`connection.created`, `membership.changed`, `reward.earned`,
`verification.changed`).

**Design stance, matching the client's own scoping principle**: NDYHUB
does not become a data warehouse for every product's internal records —
this event log is for *ecosystem-relevant* signals (the ones the
client's own message lists: identity, membership, rewards, connections,
verification), not a general "products dump all their data here" pipe.
NDYSTAYS keeps owning booking/property data; it *reports*
`booking.created` as a signal NDYHUB can act on (rewards, notifications,
future AI context) — the booking record itself stays in NDYSTAYS.

**Schema**: a new table generalizing `NdyEconomyEventLog`'s shape, not
replacing it (the Economy-specific log stays — it has reward-specific
fields like `ledgerEntryId` that don't belong on a generic event):

```prisma
model EcosystemEvent {
  id                 String   @id @default(uuid())
  eventType          String   // "quiz.completed", "booking.created", etc. — namespaced, dot-separated
  userId             String
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  reportedByClientId String?  // which registered OAuthClient reported this
  payload            Json     // event-specific data — opaque here by design, same reasoning as PassportClaim.metadata
  sourceEventId      String   @unique // idempotency, same contract as every other *EventId field in this schema
  createdAt          DateTime @default(now())

  @@index([userId, eventType, createdAt])
  @@index([eventType])
}
```

**Service**: `EcosystemEventService.report()` — validates `eventType`
against a registered catalog (same "add real ones as clients need them,
not speculatively" discipline as `oauth/scopes.ts`), writes the row
(idempotent), and — this is the extensibility point — looks up whether
any *reaction* is registered for that event type (initially: none are;
the table is a real, queryable log from day one, reactions come later).
`RewardEngineService.handleVerifiedEvent` becomes one *consumer* of this
log going forward rather than economy events living in a parallel system
— NDYBITS-relevant event types (`quiz.completed`, `booking.created`, etc.)
get both an `EcosystemEvent` row and, if a matching `RewardRule` exists,
the existing reward flow — no behavior change to Phase 5's reward system,
just a shared front door.

**Endpoint**: `POST /ecosystem/events/report` — same
`EconomyClientGuard`-style pattern (server-to-server, scope-gated), new
scope `ecosystem:report-event`. `NdyEconomyEventsController`'s existing
`POST /ndy-economy/events/report` stays as a thin, backward-compatible
alias that also writes the general log, so no existing integration
breaks.

**What ships disabled/inert**: nothing — this is a pure additive log +
intake endpoint, no activation gate needed (unlike the Economy phases,
there's no money movement here).

---

## Phase C — Granular Scopes v1

**Goal**: replace today's 5 coarse OIDC scopes with the client's proposed
`resource:action` shape, additive — existing scopes keep working
unchanged (`profile`, `email`, etc. stay valid), new granular ones are
added alongside for clients that want them.

**Scopes to add** to `oauth/scopes.ts`'s `OIDC_SCOPES`:

```
profile:read       — read name, NDY ID, bio, etc.
membership:read     — read current tier/status
wallet:read          — read NDYBITS/CRYNDY balances (replaces the ambiguous "cryndy" scope's implicit read-only meaning)
activity:read        — read the user's ecosystem activity feed (Phase B's EcosystemEvent log, user-scoped)
connections:read      — read which other NDY products/OAuth clients a user has connected
ecosystem:report-event — server-to-server, Phase B's event intake (see above)
```

**Not adding `:write` scopes yet** — every current OAuth-issued flow is
read-only from a relying party's perspective (a connected app reads
identity/membership, it never mutates it through this token). A write
scope implies a real mutation endpoint behind it; adding the scope name
without the endpoint would be exactly the "speculative scope" anti-pattern
`scopes.ts`'s own comment warns against. `profile:write` etc. get added
alongside whatever future endpoint actually needs them.

**Migration for existing clients**: none required — old scopes
(`profile`, `membership`, `cryndy`) remain valid indefinitely, this is
purely additive vocabulary.

---

## Phase D — Central Session & Device Management (design checkpoint needed)

**Goal**: "Sign Out All Devices" that actually means *all devices, all NDY
products* — today it only reaches NDY HUB's own dashboard session.

**What this needs before implementation, not just building blind**:

1. **A real device-identification strategy.** `userAgent`/`ip` (what
   `Session` and `OAuthRefreshToken` already loosely have) is a weak
   proxy for "device" — the same phone hits different IPs constantly, and
   user-agent strings collide across devices. A real device concept
   usually means a client-generated device ID persisted locally (a
   mobile app's install ID, a browser fingerprint or a first-class
   "remember this device" cookie) sent on every token request. This is a
   client-side contract change for every NDY product's app, not just an
   NDYHUB schema change — worth the client's explicit sign-off on the
   approach before every product needs to adopt it.
2. **What "compromised-device handling" means operationally** — does the
   user get a prompt to confirm/deny a new device (2FA-style), or is it
   purely reactive (device shows in a list, user manually revokes)? The
   client's message names the goal but not the UX; this is a real product
   decision, not an engineering default to assume.
3. **Cross-product session visibility** — once `OAuthRefreshToken` and
   `Session` are unified under one revocation path, does `/security`'s
   existing "Connected Websites" list (already shows OAuth grants) grow a
   third column ("last active device"), or does this become its own page?

**Proposed schema direction** (pending the above sign-off, not started):
a shared `Device` model both `Session` and `OAuthRefreshToken` FK into,
with a client-supplied `deviceId` + human label ("Sufyan's iPhone"),
letting `revokeAllSessions` become "revoke every Session AND every
OAuthRefreshToken tied to this user" — the actual "all devices, all
products" the client asked for. `SecurityEvent` gains
`SESSION_REVOKED_REMOTELY` / `DEVICE_COMPROMISED_MARKED` types for the
audit trail.

**Recommendation**: ship Phases A–C first (all three are unambiguous,
buildable now), then bring Phase D's three open questions to the client
as a short, specific follow-up before writing any Phase D code.

---

## Standing principles carried forward from the client's message

- **NDYHUB centralizes identity, permissions, memberships, security,
  wallets/rewards, ecosystem-relevant activity, consent, cross-product
  context — not every product's internal data.** Every phase above is
  written to respect this: `EcosystemEvent` logs signals, not NDYSTAYS'
  booking records or NDYQUIZ's game state.
- **Firebase Custom Token bridge stays the recommended path for
  NDYAPPS** — nothing in this plan touches or reduces that
  recommendation; Firebase remains valid for realtime/FCM/analytics under
  NDYHUB-as-identity-authority.
- **This plan is explicitly the identity/session/event layer only** — it
  does not attempt to scope NDYHUB AI / NDY Intelligence Fabric / Agents /
  Workflows. That's real future work sitting *on top of* what this plan
  hardens (a clean event contract and granular scopes are precisely the
  foundation an eventual agent/automation layer would need to act safely
  on a user's behalf), but scoping that layer is its own, separate
  conversation once this foundation is in place.

---

## Consolidated list of what's ready to build now vs. what needs sign-off

**Ready to build immediately, no new client decisions needed:**
- Phase A (refresh token reuse detection)
- Phase B (ecosystem event contract v1)
- Phase C (granular read scopes)
- Point 2's documentation reframing (Universal Links as preferred)

**Needs a short decision round-trip before building:**
- Phase D (central session/device management) — three concrete questions
  above (device-ID strategy, compromised-device UX, session-list
  placement)
