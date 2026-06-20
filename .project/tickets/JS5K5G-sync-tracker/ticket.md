---
id: JS5K5G
slug: sync-tracker
title: 'safeword sync-tracker — one-way projection to Linear + GitHub Issues'
type: feature
phase: intake
status: in_progress
created: 2026-05-24T21:44:38.516Z
last_modified: 2026-06-20T12:32:00Z
---

# safeword sync-tracker — one-way projection to Linear + GitHub Issues

**Goal:** A `safeword sync-tracker` command that projects safeword's coordination view **one-way (file → tracker)** into the customer's real tracker — **Linear and GitHub Issues** — so teams get a board/roadmap/notifications while the local files stay the source of truth. Two providers, one call site, a shared payload; no plugin interface.

**Why:** Local files are safeword's canonical execution anchor; the tracker is where humans coordinate. These are different layers, not competitors. Ship the projection for the two trackers we actually need (Linear + GitHub) and let the design stay honest to that — two concrete writers, not a speculative adapter framework.

> **History:** absorbs the former "alert-routing layer" (JS5K5G), the "ticket bridge" reframe, and the coordination-mirror ([THSPA5](../THSPA5-external-tracker-mirror/ticket.md), now superseded by this). The breach→ticket use-case is split to a deferred stub ([K51FYZ](../K51FYZ-breach-issue-projection/ticket.md)) — it's a future _caller_ of this command, blocked on the unbuilt signals layer (1W107W).

## Decisions carried forward (load-bearing — do not relitigate)

- **One-way, file canonical.** The command writes outward only; the tracker is a projection, never a second master. Two-way sync was rejected (two masters → conflict/data-loss, network in the agent loop). A read-only advisory pull of _terminal state_ (issue closed + assignee) is a deliberate, separable follow-up — **not v1**.
- **Off the per-turn loop.** Invoked by the `sync-tracker` command and/or CI — **never** a per-turn hook. Keeping the network out of the execution loop is the whole point of the seam.
- **No plugin framework.** Two providers earn a _thin_ seam, not an `Adapter` interface. Rule of three: extract a formal interface at provider #3, from concrete code. ([Metz: duplication is far cheaper than the wrong abstraction.](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction))

## Scope

### Single call site + shared payload

All projection funnels through **one** function with a provider-neutral payload — so the eventual provider #3 extraction is a refactor of one place, not a scatter of `if provider ===` conditionals:

```ts
type IssuePayload = {
  title: string;
  body: string; // markdown: links to spec, ticket, work-log
  labels: string[];
  assignee?: string;
  state: 'open' | 'closed';
  parent?: TrackerRef; // epic / sub-issue parent
  relations?: { blockedBy: TrackerRef[]; dependsOn: TrackerRef[] };
};
function projectTicket(payload: IssuePayload, provider: 'linear' | 'github'): Promise<TrackerRef>;
```

### Two writers (the thin seam)

- **Linear** — via Arcade.dev MCP (`Linear_CreateIssue`/`UpdateIssue`); Arcade handles per-provider OAuth.
- **GitHub Issues** — via the `github` MCP / `gh` (Arcade does not expose GitHub). GitHub now has **sub-issues, issue types, and issue dependencies** ([CLI-manageable since 2026-06-10](https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/)) — so the projection is near-parity with Linear, not a degraded LCD.

> **Transport differs per provider** (Linear→Arcade MCP, GitHub→github MCP) — which is exactly why a two-writer seam is right and a "uniform Arcade layer" is wrong.

### Coordination mapping (the payload builder)

`sync-tracker` walks the ticket corpus and maps each ticket to an `IssuePayload`:

| safeword                    | Linear          | GitHub Issues        |
| --------------------------- | --------------- | -------------------- |
| `epic` / `parent`           | project/parent  | sub-issue parent     |
| ticket                      | issue           | issue                |
| `status`                    | workflow state  | open/closed (+ type) |
| `blocked_on` / `depends_on` | issue relations | issue dependencies   |
| `type`                      | label           | issue type           |

Updates are **idempotent** (re-running reconciles, doesn't duplicate) via a stored `TrackerRef` per ticket.

### Configuration

```json
{
  "ticketBridge": {
    "provider": "none" | "linear" | "github",
    "target": { "workspace": "…", "team": "ENG", "repo": "owner/name" },
    "defaultAssignee": "oncall@example.com"
  }
}
```

Default `provider: none` — opt-in.

## Out of scope

- A pluggable adapter interface, `custom` provider, dynamic adapter loading — deferred to provider #3.
- Two-way sync / read-back of human edits — terminal-state advisory pull is a later, separable follow-up.
- The **breach→issue** caller — deferred stub [K51FYZ](../K51FYZ-breach-issue-projection/ticket.md), blocked on signals (1W107W).
- Jira, Slack, and any third provider.

## Open questions

- **Non-interactive auth** (load-bearing, inherited from THSPA5) — how does an unattended/CI `sync-tracker` authenticate through Arcade MCP's per-user OAuth, and through `gh` for GitHub? Interactively-authed MCP servers can be absent in headless runs.
- **TrackerRef storage** — where does the per-ticket issue reference live so updates are idempotent? Lean: a `tracker:` frontmatter field on the ticket (write-back to the local file is still file-canonical).
- **Cadence** — explicit command only, post-commit, or scheduled CI? Lean: explicit command + optional CI.

## Done when

- `safeword sync-tracker` projects the corpus one-way to the configured provider.
- Both Linear and GitHub writers ship, behind one call site + shared `IssuePayload`.
- `status`/`epic`/`blocked_on`/`depends_on`/`type` map to each provider's primitives; re-running is idempotent.
- `.safeword/config.json` carries the `ticketBridge` block (default `none`).
- Non-interactive auth path decided and documented.
- Both writers covered by unit tests against mocked MCP/`gh` clients; no live tracker in tests.

## Work Log

- 2026-05-24T21:44:38.516Z Started: Created ticket JS5K5G.
- 2026-05-24T21:45:00.000Z Drafted: alert-routing scope.
- 2026-06-20T11:58:00Z Reframed alert-routing → generic ticket bridge.
- 2026-06-20T12:32:00Z Collapsed to `safeword sync-tracker` (per the simplify + Linear+GitHub figure-it-out). Dropped the adapter framework (two providers → thin two-writer seam, single call site + shared payload; extract an interface at #3). Absorbed THSPA5's coordination mapping (superseded it) and carried its one-way + non-interactive-auth decisions. Recorded the stale-training correction: GitHub now has sub-issues/types/dependencies → near-parity with Linear, transports still differ (Linear→Arcade MCP, GitHub→github MCP). Breach caller split to deferred stub K51FYZ. Removed epic membership (WG3Z2N deleted); slug ticket-bridge → sync-tracker.
