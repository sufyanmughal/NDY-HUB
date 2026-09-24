# Context Broker — Data Egress Design (proposal)

**Status: proposal.** This is the second half of the Context Broker. Action
ingress is built and enforced; this document covers what is needed for the
**egress** half — the part that decides whether context may leave NDY
infrastructure, to whom, and how much of it.

It exists because of the split the client set out (Q14):

- **The policy** — which providers are permitted, and what may leave — is a
  governance/business/legal decision. **His/legal's call; engineering does not
  invent it.**
- **The enforcement** — making that policy impossible to bypass in code — is
  engineering's job. This document proposes how.

Nothing here is built yet, deliberately: enforcement without a policy is dead
code, and a policy without a place to live would be a document nobody can
enforce.

---

## 1. What is already true (ingress)

For completeness, since it's easy to conflate the two:

- An AI agent is a registered OAuth client flagged as an AI agent.
- When an agent-originated action reaches the Action Engine's Authorize step, an
  extra check runs: does this member's consent record permit this agent to invoke
  this action?
- Anything not mapped to a consent scope is **refused** (fail closed).

That governs **what an agent may do**. It says nothing about **where data goes** —
which is this document.

## 2. The four things egress enforcement needs

To enforce a policy rather than describe one, four things must be answerable at
the moment an action would send data outward:

1. **Which provider would receive it.**
2. **Whether that provider is permitted at all.**
3. **How much context is leaving** — and whether the member consented to *that
   class* of data, not merely to "summarise my email".
4. **A record that it happened**, so it is auditable after the fact.

## 3. Proposed mechanism

### 3.1 The provider belongs to the agent

An AI agent processes data through a specific provider (a model vendor, an
inference endpoint). So the provider is a **property of the registered agent**,
not of each action — the same agent cannot plausibly egress to two different
providers via one consent.

→ Add a `dataProvider` identifier to the AI-agent client record.

*Why not per-action:* it would let one action silently route to a different
provider than the member consented to.

### 3.2 Allow-list, deny by default

A configuration value lists the permitted providers (comma-separated). **Empty
means nothing may leave** — the safe default, and the only default that doesn't
require inventing policy.

→ `AI_EGRESS_ALLOWED_PROVIDERS`, plus a hard-deny list for providers that are
never acceptable regardless of configuration.

### 3.3 Enforcement rides the existing Authorize step

No new pipeline. When an action declares it requires the **egress** consent scope,
Authorize additionally requires **both**:

- the member's egress consent (already built), **and**
- the agent's provider being on the allow-list.

Either missing → refused, audited through the existing reject path. Composes with
everything already there: membership, validation, risk tier, audit.

### 3.4 Context minimisation — the part I'd most like agreed

"Summarise my email" must not silently mean "send the full message body". My
recommendation is that the **egress consent names the data classes** it covers,
so the member sees the difference:

| Class | Meaning |
|---|---|
| `EMAIL_METADATA` | subject, sender, date — not the body |
| `EMAIL_BODY` | the message content |
| `EMAIL_ATTACHMENTS` | attachment content (I'd require this to be a separate, explicit grant) |

The member grants classes; the action declares which classes it needs; enforcement
checks the grant covers them. This is what makes the egress half meaningful rather
than a single blanket switch.

### 3.5 Audit

An action that egresses already writes an audit entry. Add the **provider** and
the **data classes** to that entry, so "what left, to whom, and under which
consent" is answerable later — including after a consent is revoked.

## 4. What I need decided (the policy — not mine to invent)

1. **The permitted provider list.** Which providers may receive NDY data at all?
2. **Is egress per-provider, or per-provider-plus-data-class?** (My
   recommendation: provider-plus-data-class — a provider trusted for metadata is
   not automatically trusted for message bodies.)
3. **Is any data class never allowed to leave** (a hard deny that no consent can
   override)? Attachments are my candidate.
4. **Retention at the provider** — if data leaves, what may the provider keep, and
   does that constrain who is allowed at all?
5. **Who owns adding a provider** — a config change by engineering, or an explicit
   governance step with an audit record?

## 5. What I'd build once those are answered

Deliberately small, because the enforcement point already exists:

1. `dataProvider` on the AI-agent client record (additive migration).
2. The allow-list / hard-deny configuration and a single check function.
3. The egress check added to the existing Authorize step — a few lines, not a new
   pipeline.
4. Data classes added to the egress consent vocabulary and to the audit entry.
5. Tests for the deny paths: unknown provider, non-allowed provider, missing data
   class, hard-denied class.

Nothing in that list requires new architecture — it is configuration, one check,
and the audit fields.

## 6. Why I'm not building it yet

Enforcement with an empty allow-list is "deny everything", which is correct but
indistinguishable from "not implemented" until a real consumer exists. And the
first consumer (NDYMAIL AI) is not yet integrated, so there is currently no call
site to gate.

The honest sequence is: **name the first egress-using action → agree the policy →
the enforcement above becomes live in one small change.** Building it before that
would be the same "architecture ahead of a caller" trap we've avoided elsewhere.
