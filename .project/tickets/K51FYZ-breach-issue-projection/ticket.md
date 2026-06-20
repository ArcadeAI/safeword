---
id: K51FYZ
slug: breach-issue-projection
type: feature
phase: intake
status: in_progress
epic: ticket-anchor-external-bridge
depends_on: [JS5K5G, 1W107W]
paired_with: 5FBD29
created: 2026-06-20T11:56:44.779Z
last_modified: 2026-06-20T11:56:44.779Z
---

# Breach issue projection — signal breach → tracker issue via the ticket bridge

**Goal:** When a signal breaches its threshold, project that breach as a structured issue in the customer's tracker via the [ticket bridge](../JS5K5G-ticket-bridge/ticket.md) (JS5K5G), so breaches get triaged instead of firing into the void.

**Why:** This is the _alert-routing_ use-case that originally lived inside JS5K5G. It was split out so the bridge stays a generic, one-way adapter and breach-routing is just one event source feeding it. Arcade hardcodes Linear for breach routing; consuming the provider-agnostic bridge extends that to GitHub/Jira users without duplicating adapter logic.

> **Split from JS5K5G 2026-06-20.** Carries the signals couplings: `depends_on: [JS5K5G (bridge), 1W107W (build-signals provides the breach event)]`, `paired_with: 5FBD29` (arcade). Parent epic: [WG3Z2N](../WG3Z2N-ticket-anchor-external-bridge/ticket.md). Cross-linked to the signals epic **S4997T** (where the breach event originates).

## Scope

### Breach → IssuePayload mapping

Given a `BreachEvent` from the signals layer (1W107W), build the bridge's provider-neutral `IssuePayload`:

- Title: `Signal breach: <slug> — <signal name>`
- Body: link to spec, link to the signals file, breach details, and a `/debug` invocation hint.
- Labels: `signal-breach`.
- Assignee: on-call engineer (from `ticketBridge.defaultAssignee` or a breach-specific override).

Then call `bridge.createIssue(payload)` — the bridge owns provider mapping and auth.

### Skill integration

`/build-signals` (1W107W) wires each signal it creates to call this projection on breach, using the project's configured `ticketBridge` provider.

### Configuration

Reads the shared `ticketBridge` block (JS5K5G) plus breach-specific options:

```json
{
  "breachRouting": { "labelOnBreach": "signal-breach", "assignTo": "oncall@example.com" }
}
```

## Out of scope

- The adapter contract, provider mapping, and auth — owned by JS5K5G.
- Automated `/debug` execution on breach — v1 only embeds a hint.
- Throttling, deduplication, escalation — fire-and-forget per breach; smart routing is later work.

## Done when

- A `BreachEvent` maps to a valid `IssuePayload` and is created via the bridge against a mocked adapter in tests.
- `/build-signals` wires breach routing through the configured `ticketBridge` provider.
- `breachRouting` config block documented.
- Documentation shows the end-to-end path: signal breach → payload → `bridge.createIssue`.

## Open questions

- **Breach payload assignee** — reuse `ticketBridge.defaultAssignee`, or always require a breach-specific on-call? Lean: default to the bridge's, allow override.
- **Idempotency on repeated breach** — does a re-breach of the same signal create a new issue or update the existing one? Lean: v1 creates per breach (matches arcade's fire-and-forget); dedup is out of scope.

## Work Log

- 2026-06-20T11:56:44.779Z Started: Created ticket K51FYZ.
- 2026-06-20T12:02:00Z Split from JS5K5G (the old alert-routing scope) per the local-vs-external figure-it-out. Defined as a consumer of the ticket bridge: maps `BreachEvent` → `IssuePayload` → `bridge.createIssue`. Carries `depends_on: [JS5K5G, 1W107W]`, `paired_with: 5FBD29`; parented under WG3Z2N, cross-linked to signals epic S4997T.
