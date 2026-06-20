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

**Goal:** A `safeword sync-tracker` command that projects safeword's tickets **one-way (file → tracker)** into the customer's real tracker — **Linear and GitHub Issues** — as a **flat, groupable status board** (no dependency graph in v1), while the local files stay the source of truth. Two providers, one call site, a shared payload; no plugin interface.

> **v1 is the walking skeleton:** prove the whole pipe end-to-end — auth → corpus walk → payload → write → idempotent ref → re-run — on the **stable** `CreateIssue`/`UpdateIssue` surface. The **dependency-graph projection** (epic/parent → sub-issues, blocked_on/depends_on → tracker relations, issue-types, topo-sort) is the highest-cost / lowest-adoption / newest-API slice and is deferred to a **v2** ([relations-and-hierarchy projection](../M1FGRJ-tracker-relations-projection/ticket.md)). The graph already renders locally in the INDEX (AKZJXC), so deferring loses no visibility now.

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
  body: string; // minimal by default: links back to the canonical ticket (see egress)
  labels: string[]; // includes epic:<slug> and type:<type> so the board groups/filters
  assignee?: string;
  state: 'open' | 'closed';
};
function projectTicket(payload: IssuePayload, provider: 'linear' | 'github'): Promise<TrackerRef>;
```

### Two writers (the thin seam)

Both use only **stable create/update** endpoints — no relations/sub-issue APIs in v1, so both providers can even route through Arcade if convenient:

- **Linear** — `Linear_CreateIssue` / `UpdateIssue` via Arcade.dev MCP ([verified](https://docs.arcade.dev/en/resources/integrations/productivity/linear)); Arcade handles OAuth.
- **GitHub Issues** — create/update via the `github` MCP / `gh` (or Arcade's GitHub toolkit, which covers create/update/list — [verified](https://docs.arcade.dev/en/resources/integrations/development/github)). No sub-issue/dependency/issue-type calls in v1, so none of the new-API gotchas apply.

> **Note for v2:** Arcade's GitHub toolkit is create/update/list only — it lacks sub-issues/deps/types — so the v2 graph projection routes GitHub natively (`gh`, [dependencies CLI 2026-06-10](https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/)). Not a v1 concern.

### Coordination mapping (the payload builder)

`sync-tracker` walks the ticket corpus and maps each ticket to a **flat** `IssuePayload`:

| safeword | Linear         | GitHub Issues |
| -------- | -------------- | ------------- |
| ticket   | issue          | issue         |
| `status` | workflow state | open/closed   |
| `epic`   | `epic:` label  | `epic:` label |
| `type`   | `type:` label  | `type:` label |

Grouping/filtering by epic and type comes from **labels** (free, stable) — that's the roadmap's grouping without the sub-issue API. Ordering (the dependency graph) is v2.

### What goes in the body (egress default — `figure-it-out` 2026-06-20)

**Fail-safe default:** project **title + status + labels + a link back** to the canonical ticket — **never** the spec/work-log body. That's the whole flat board view; the body is pure nice-to-read. Saltzer & Schroeder fail-safe defaults — the default's worst case is "sparse issue," never "leaked internal reasoning to a world-readable tracker." ([principles](https://nocomplexity.com/documents/securityarchitecture/architecture/saltzer_designprinciples.html))

- Full body is **opt-in per project** (`ticketBridge.body: "minimal" | "full"`, default `minimal`).
- **Public-repo warning:** projecting `body: full` to a **public** GitHub repo emits a loud warning (egress notice). No ack-flag ceremony — the minimal default already makes the leak path opt-in.

### Idempotency (partial-failure-safe)

Re-running reconciles, never duplicates, via a per-ticket `TrackerRef` kept in a **sidecar `.safeword/tracker-map.json`** — _not_ ticket frontmatter, so the canonical files stay pure (no sync write-back into the source of truth). The map distinguishes "created + ref recorded" from "created but ref-write failed" so a crashed mid-corpus run resumes cleanly rather than double-creating. Rate-limited writes with backoff (a first sync is one call per ticket across the corpus).

### Configuration

```json
{
  "ticketBridge": {
    "provider": "none" | "linear" | "github",
    "body": "minimal" | "full",
    "target": { "workspace": "…", "team": "ENG", "repo": "owner/name" },
    "defaultAssignee": "oncall@example.com"
  }
}
```

Default `provider: none`, `body: minimal` — opt-in and minimal-egress.

## Out of scope

- **The dependency-graph projection** — epic/parent → sub-issues, blocked_on/depends_on → tracker relations, `type` → issue-type, and the topological-parent ordering they require. This is the **v2** ([relations-and-hierarchy projection](../M1FGRJ-tracker-relations-projection/ticket.md)), which `depends_on` this skeleton.
- A pluggable adapter interface, `custom` provider, dynamic adapter loading — deferred to provider #3.
- Two-way sync / read-back of human edits — terminal-state advisory pull is a later, separable follow-up.
- The **breach→issue** caller — deferred stub [K51FYZ](../K51FYZ-breach-issue-projection/ticket.md), blocked on signals (1W107W).
- Jira, Slack, and any third provider.

## Open questions

- **Non-interactive auth** — RESOLVED in principle: Arcade supports **Headers mode** for headless/CI (`Authorization: Bearer <ARCADE_API_KEY>` + `Arcade-User-ID: <email>`, [verified](https://docs.arcade.dev/en/get-started/mcp-clients/claude-code)); GitHub uses a `gh`/PAT token. **Caveat to document:** `Arcade-User-ID` is a _user identity, not a service account_ — if that user loses their Linear OAuth grant, CI sync fails silently. Decide whether to pin a dedicated service identity.
- **Cadence** — explicit command only, post-commit, or scheduled CI? Lean: explicit command + optional CI.

## Done when

- `safeword sync-tracker` projects the corpus one-way to the configured provider as **flat issues** (title, status→state, labels for epic+type, assignee, link-back).
- Both Linear and GitHub writers ship, behind one call site + shared `IssuePayload`, using **stable create/update only** (no relations/sub-issue/issue-type calls).
- Re-running is idempotent via the `.safeword/tracker-map.json` sidecar; **partial-failure resume** is tested (a crash mid-corpus does not double-create).
- **Body egress:** default `minimal` (no spec/work-log body); `full` is opt-in; `full`→public-repo emits a loud egress warning.
- Corpus writes are rate-limited with backoff.
- `.safeword/config.json` carries the `ticketBridge` block (default `provider: none`, `body: minimal`).
- Non-interactive auth path (Arcade Headers + the service-identity caveat) documented.
- Both writers covered by unit tests against mocked MCP/`gh` clients; no live tracker in tests.

## Work Log

- 2026-05-24T21:44:38.516Z Started: Created ticket JS5K5G.
- 2026-05-24T21:45:00.000Z Drafted: alert-routing scope.
- 2026-06-20T11:58:00Z Reframed alert-routing → generic ticket bridge.
- 2026-06-20T12:32:00Z Collapsed to `safeword sync-tracker` (per the simplify + Linear+GitHub figure-it-out). Dropped the adapter framework (two providers → thin two-writer seam, single call site + shared payload; extract an interface at #3). Absorbed THSPA5's coordination mapping (superseded it). Breach caller split to deferred stub K51FYZ. Removed epic membership (WG3Z2N deleted); slug ticket-bridge → sync-tracker.
- 2026-06-20T16:12:00Z Applied quality-review + figure-it-out fixes (egress default, sidecar TrackerRef, auth resolution, corrected the Arcade-GitHub fact).
- 2026-06-20T16:16:00Z **De-bloated to a walking skeleton** (`/figure-it-out`). Cut the dependency-graph projection — epic/parent→sub-issues, blocked_on/depends_on→relations, type→issue-type, topo-sort — to a **v2** (M1FGRJ), keeping v1 to flat issues on stable create/update. Rationale: the graph is the highest-cost / lowest-adoption / newest-API slice (GitHub deps API is 10 days old), and it already renders locally in the INDEX. `epic`+`type` become **labels** so v1 is still a groupable board. Flatness dissolved the Linear-first question (both providers ship, both stable). Simplified the public-repo guard from refuse+ack to a warning.
