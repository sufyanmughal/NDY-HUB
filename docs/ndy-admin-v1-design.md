# NDY Admin™ — v1 Design Proposal

**Status: proposal for review.** This is a draft to sharpen with Teun, Hassan and
Abdul before any code is written — deliberately written to be corrected rather
than approved as-is. Nothing here is built yet.

---

## 1. What NDY Admin is (and is not)

**It is** the cross-ecosystem management and coordination layer: one place to see
and act across the NDJOYIT products and the members who use them.

**It is not** a replacement for NDYHUB's existing Admin Center. That stays where
it is, for managing NDYHUB itself. NDY Admin is a *separate product* operating
above the individual products, exactly as the client directed.

Two hard rules from the client's direction shape everything below:

1. **No database backdoor.** NDY Admin authenticates through NDYHUB OIDC and
   reads/acts through published APIs. It never connects to NDYHUB's — or any
   product's — database directly.
2. **No second uncontrolled admin write path.** Sensitive writes go through the
   **Action Engine**, which already provides propose → authorize → validate →
   risk-tier → approve → execute → audit. NDY Admin gains no private write route
   of its own.

## 2. Why a separate product rather than more NDYHUB screens

- The blast radius is different. NDYHUB's Admin Center manages identity; NDY
  Admin would touch *many* products. Keeping them separate means a bug in the
  coordination layer cannot corrupt identity data.
- The consumers are different. NDYHUB's console serves NDYHUB operators; NDY
  Admin serves cross-ecosystem operators who may have no NDYHUB admin rights.
- It must not be able to do anything a normal OIDC client could not do. Being a
  separate client is what makes that structurally true rather than a promise.

## 3. Identity and access

- **Authentication**: NDY Admin registers as an **OAuthClient** in NDYHUB
  (authorization code + PKCE), the same mechanism any other ecosystem site uses.
  No special-casing.
- **Authorisation**: a new **OIDC scope set** on that client (the vocabulary is
  added as the first real screens need it — the codebase's own "add scopes as
  real clients need them" rule), instead of inventing a second permission system.
- **No user is an NDY Admin by default.** Access is granted per member on the
  NDYHUB side, and only a Founder/Super Admin can grant it — reusing the existing
  role model rather than a parallel one.

## 4. v1 scope — read-mostly, deliberately

Per the client's preference ("read-mostly first, followed by controlled write
actions through the Action Engine"):

### 4.1 Read (v1)

| View | Source of truth | Notes |
|---|---|---|
| **Cross-product activity** | Ecosystem Event log (`ecosystem:read-events`) | What is happening across products: bookings, quiz completions, identity changes. |
| **Member lookup** | NDYHUB member/identity API | Who a member is, their tier, verification level, trust tier — **not** their private trust score (that stays private per the Trust decision). |
| **Connected products** | OIDC client registry | Which products are integrated, their scopes, whether they are active. |
| **Verification queue (overview)** | Verification API | Counts/status only in v1; the actual review stays in NDYHUB where it already lives. |

Everything read-only, everything through published APIs, everything scoped.

### 4.2 Write (v1: none directly)

No direct writes in v1. The first candidate write actions, each proposed
individually and routed through the Action Engine, are:

- suspend / unsuspend a member **in a specific product** (not NDYHUB-wide),
- pin an ecosystem announcement,
- trigger a re-verification request.

Each would be a registered Action Engine action with its own risk tier and
approval requirement — which is the client's "controlled write actions through
the Action Engine" made concrete.

## 5. Architecture

```
                    NDYHUB  ── OIDC provider (authorization code + PKCE)
                      ▲
                      │  authorize / token / userinfo
                      │
              ┌───────┴────────┐
              │   NDY Admin    │  separate product, separate deploy,
              │  (own client)  │  own credentials, no DB access
              └───┬────────┬───┘
                  │        │
     read: ───────┘        └─────── write:
     NDYHUB APIs                    Action Engine
     (ecosystem events,             (propose → approve →
      members, clients)              execute → audit)
                  │
                  ▼
        Product APIs (NDYSTAYS, NDYCONNECT, …)
        via their own OIDC-scoped access
```

- **Deployment**: a separate app (its own workspace member / repo), separate
  credentials, separated from NDYHUB's deployment — consistent with the
  Development → Staging → Production separation the client asked for.
- **Failure isolation**: NDY Admin being down must not affect NDYHUB or any
  product. It is a *consumer* of their APIs, never on their critical path.
- **Data**: NDY Admin stores no copy of member data. It reads live, under scope.
  (If caching becomes necessary it must be explicitly scoped and short-lived —
  and that would be its own review.)

## 6. Security posture

- Every action is attributable: NDY Admin acts as a named operator via OIDC, and
  every write lands in the Action Engine's audit trail plus NDYHUB's audit log.
- Least privilege: the client's scopes are the ceiling of what NDY Admin can ever
  do, enforced by NDYHUB — not by NDY Admin's own goodwill.
- No shared database, no shared credentials with NDYHUB, no internal service
  token that bypasses scopes.
- Read access is scoped per view — a lookup view cannot page the whole member
  table unless a scope explicitly permits it.

## 7. Non-goals (v1)

- Managing NDYHUB's own identity data (that stays in NDYHUB's Admin Center).
- Any direct database access, anywhere, ever.
- Acting on behalf of a member (that is the Context Broker's domain, not this).
- A general-purpose product admin console for every product — v1 coordinates and
  observes; it does not replace each product's own tools.

## 8. Open questions for the sync call

These are the things I deliberately did not decide alone — they need the
conversation with Teun, Hassan and Abdul:

1. **Which products are in v1?** NDYHUB + NDYSTAYS only, or the wider set?
2. **Who are the v1 operators**, and what role do they hold in NDYHUB? (This
   determines the scope set.)
3. **What is the single most valuable first screen?** My guess is cross-product
   activity, but that is a product call, not an engineering one.
4. **Does NDY Admin need to see member-level detail** (a specific member's
   status across products), or is aggregate/oversight-level enough for v1? This
   materially changes the privacy surface.
5. **Where does NDY Admin live** — a new `apps/ndy-admin` workspace member, or
   its own repository? (Separate repo gives stronger isolation; the monorepo is
   lower friction. Genuine trade-off, worth deciding deliberately.)
6. **Is there an existing operator-facing need today**, or is this being built
   ahead of its first user? If the latter, it may be worth scoping v1 to the
   smallest useful screen rather than a full console.

## 9. Suggested build order (once §8 is answered)

1. Register NDY Admin as an OIDC client in NDYHUB with the agreed scopes.
2. Shell app: sign-in via OIDC, a session, and one read-only screen (question 3's
   answer). No writes.
3. Add the remaining read views.
4. Then, and only then, the first Action-Engine-routed write action — reviewed on
   its own as a separate, small change.

Nothing in steps 1–3 introduces a write path, so the riskiest part (writes) is
last and isolated.
