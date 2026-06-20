---
id: JS5K5G
slug: ticket-bridge
title: 'Ticket bridge — one-way provider-adapter layer (Linear/GitHub/Jira via Arcade MCP)'
type: feature
phase: intake
status: in_progress
epic: ticket-anchor-external-bridge
created: 2026-05-24T21:44:38.516Z
last_modified: 2026-06-20T11:58:00Z
---

# Ticket bridge — one-way provider-adapter layer

**Goal:** A single, **one-way** (file → tracker) provider-adapter layer that lets safeword write/update issues in the customer's real ticket system — Linear, GitHub Issues, or Jira — routed through Arcade.dev's MCP servers (per-provider OAuth handled there). This is the shared spine the coordination mirror and the breach-router both build on; neither defines its own adapter.

**Why:** Local files are safeword's canonical execution anchor; the tracker is where humans coordinate. Today two tickets independently reinvent "write an issue to the customer's tracker": the [coordination mirror](../THSPA5-external-tracker-mirror/ticket.md) (THSPA5) and the old alert-routing scope. They are two **triggers** into the same machine. Define the machine once — a provider-agnostic, one-way adapter — and let each use-case be a consumer.

> **Reframed 2026-06-20:** was "pluggable alert-routing layer." Alert-routing is one _event source_, not the architecture — split into a separate breach-projection child. This ticket is now the generic bridge. Parent epic: [WG3Z2N](../WG3Z2N-ticket-anchor-external-bridge/ticket.md) (EXTERNAL half — the spine).

## Direction: one-way, file canonical

The bridge **writes outward only**. Safeword's files stay the source of truth; the tracker is a projection. No two-way sync (rejected in the epic's figure-it-out: two masters → conflict/data-loss, network in the agent loop). A read-only advisory pull of _terminal state_ (issue closed/cancelled + assignee) is a deliberate, separable follow-up — not v1.

## Scope

### Adapter contract

A provider-agnostic interface every adapter implements (the consumer supplies the payload; the adapter maps it to the provider's primitives):

- `createIssue(payload: IssuePayload): Promise<TicketRef>` — create an issue/card, return a stable reference.
- `updateIssue(ref: TicketRef, patch: IssuePatch): Promise<void>` — update state/fields on an existing issue (idempotent; safe to re-run).
- `mapStatus(status)` / `mapRelations(rels)` — translate safeword's `status` enum and `depends_on`/`blocked_on` edges to the provider's states + issue relations, degrading gracefully where the provider is flatter (GitHub Issues has no native relations/epics).
- `IssuePayload` carries provider-neutral fields: title, body (markdown), labels, assignee, optional parent/milestone, optional relations.

### Routing through Arcade MCP (auth)

Adapters call Arcade.dev MCP tools (`Linear_*`, GitHub, Jira) rather than bundling three API clients — Arcade handles per-provider OAuth. Carry forward THSPA5's load-bearing constraint: **non-interactive auth** for an unattended/CI sync (interactively-authed MCP servers can be absent in headless runs). Resolve the headless auth path in design.

### Configuration

`.safeword/config.json`:

```json
{
  "ticketBridge": {
    "provider": "none" | "linear" | "github" | "jira" | "custom",
    "target": { "workspace": "…", "team": "ENG", "repo": "owner/name" },
    "defaultAssignee": "oncall@example.com"
  }
}
```

Default `provider: none` — opt-in. (Old `alertRouting` block folds into this; the breach-router reads `ticketBridge` plus its own breach-specific options.)

### Custom adapter

Projects ship their own at `.safeword/adapters/<name>.ts`, loaded dynamically when `provider === "custom"`.

### Trigger discipline

The bridge is invoked by a `safeword sync-*` command and/or CI — **never** a per-turn hook. Keeping the network out of the execution loop is the whole point of the seam.

## Consumers (separate tickets — not built here)

- **Coordination projection** — [THSPA5](../THSPA5-external-tracker-mirror/ticket.md): one-way mirror of epics/status/relations.
- **Breach projection** — the signals use-case (split from this ticket): a signal breach → an issue via the bridge. `depends_on: 1W107W`, `paired_with: 5FBD29` (arcade).

## Out of scope

- The consumers above (coordination mirror, breach router) — they `depends_on` this contract.
- Two-way sync / read-back of human edits — terminal-state advisory pull is a later, separable follow-up.
- Shipping GitHub/Jira adapters in v1 — Linear adapter is the reference; others follow the contract.
- Throttling, deduplication, escalation.

## Done when

- Provider-agnostic adapter interface (`createIssue`/`updateIssue`/`mapStatus`/`mapRelations`) documented in safeword templates.
- Linear adapter ships against the contract, routed through Arcade MCP, and is the reference implementation.
- `.safeword/config.json` schema includes the `ticketBridge` block (default `none`).
- Non-interactive auth path for unattended sync decided and documented.
- Documentation shows how to write a custom adapter.
- At least one consumer (THSPA5 or the breach router) wires through the contract end-to-end against a mocked adapter in tests.

## Open questions

- **Non-interactive auth** — how does an unattended/CI sync authenticate through Arcade MCP's per-user OAuth? (Load-bearing; inherited from THSPA5.)
- **Provider parity floor** — define the lowest-common-denominator mapping (GitHub has no native epics/relations) + per-provider enhancements.
- **Client bundling** — Arcade MCP tool calls vs. bundling provider SDKs. Lean: MCP-only, no bundled SDKs (keeps install lean for non-users).
- **Test fixtures** — mocked-adapter-only in unit tests; real-instance integration is a project concern.

## Work Log

- 2026-05-24T21:44:38.516Z Started: Created ticket JS5K5G
- 2026-05-24T21:45:00.000Z Drafted: Scope (adapter contract, Linear default, config, custom adapters); linked to epic S4997T
- 2026-06-20T11:58:00Z Reframed from "pluggable alert-routing layer" → the generic one-way **ticket bridge** (per the local-vs-external figure-it-out). Alert-routing demoted to one event source → split into a breach-projection child carrying `blocked_on: 1W107W` + `paired_with: 5FBD29`. Generalized the contract (`createIssue`/`updateIssue`/`mapStatus`/`mapRelations`), folded `alertRouting` config into `ticketBridge`, absorbed THSPA5's Arcade-MCP routing + non-interactive-auth constraint so THSPA5 becomes a consumer. Re-parented from `epic: bdd-phase-three-merge` → `parent: WG3Z2N`; folder renamed JS5K5G → JS5K5G-ticket-bridge.
