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

- **Linear** — via Arcade.dev MCP (`Linear_CreateIssue`/`UpdateIssue`, and `Linear_CreateIssueRelation` for blocks/blockedBy — both [verified present](https://docs.arcade.dev/en/resources/integrations/productivity/linear)); Arcade handles OAuth.
- **GitHub Issues** — via the `github` MCP / `gh`. **Rationale (corrected):** Arcade _does_ expose a GitHub toolkit, but it's create/update/list only — it **lacks sub-issues, issue dependencies, and issue types** ([verified](https://docs.arcade.dev/en/resources/integrations/development/github)). Those primitives — which our `epic`/`blocked_on`/`type` mapping needs — are reachable through GitHub's own API / `gh` (sub-issues + dependencies + types, [CLI-manageable since 2026-06-10](https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/)). So GitHub routes natively.

> **Transport differs per provider** for a real reason: Arcade's GitHub toolkit is too thin for the relation primitives we map. Not "Arcade has no GitHub" (it does) — the toolkit just doesn't cover sub-issues/deps/types. This is why the two-writer seam is right and a "uniform Arcade layer" is wrong.
>
> **GitHub gotchas to handle:** (1) `issue type` requires **org-level type definitions** — fall back gracefully (skip the type) when the org hasn't defined them. (2) The sub-issue API **links an existing issue** as a child; it does not create parent+child atomically — so the corpus walk must be **topologically sorted by parent** before writing, or the parent ref won't exist yet.

### Coordination mapping (the payload builder)

`sync-tracker` walks the ticket corpus and maps each ticket to an `IssuePayload`:

| safeword                    | Linear          | GitHub Issues        |
| --------------------------- | --------------- | -------------------- |
| `epic` / `parent`           | project/parent  | sub-issue parent     |
| ticket                      | issue           | issue                |
| `status`                    | workflow state  | open/closed (+ type) |
| `blocked_on` / `depends_on` | issue relations | issue dependencies   |
| `type`                      | label           | issue type           |

### What goes in the body (egress default — `figure-it-out` 2026-06-20)

**Fail-safe default:** project **title + status + labels + dependency-links + a link back** to the canonical ticket — **never** the spec/work-log body. That's the whole coordination view (board/roadmap/graph); the body is pure nice-to-read. Saltzer & Schroeder fail-safe defaults — the default's worst case is "sparse issue," never "leaked internal reasoning to a world-readable tracker." ([principles](https://nocomplexity.com/documents/securityarchitecture/architecture/saltzer_designprinciples.html))

- Full body is **opt-in per project** (`ticketBridge.body: "minimal" | "full"`, default `minimal`).
- **Public-repo guard:** projecting `body: full` to a **public** GitHub repo is refused without an explicit `--allow-public-body` ack. Visibility is re-checked **every** sync run (a repo can be flipped public after the first projection).

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

- A pluggable adapter interface, `custom` provider, dynamic adapter loading — deferred to provider #3.
- Two-way sync / read-back of human edits — terminal-state advisory pull is a later, separable follow-up.
- The **breach→issue** caller — deferred stub [K51FYZ](../K51FYZ-breach-issue-projection/ticket.md), blocked on signals (1W107W).
- Jira, Slack, and any third provider.

## Open questions

- **Non-interactive auth** — RESOLVED in principle: Arcade supports **Headers mode** for headless/CI (`Authorization: Bearer <ARCADE_API_KEY>` + `Arcade-User-ID: <email>`, [verified](https://docs.arcade.dev/en/get-started/mcp-clients/claude-code)); GitHub uses a `gh`/PAT token. **Caveat to document:** `Arcade-User-ID` is a _user identity, not a service account_ — if that user loses their Linear OAuth grant, CI sync fails silently. Decide whether to pin a dedicated service identity.
- **Cadence** — explicit command only, post-commit, or scheduled CI? Lean: explicit command + optional CI.

## Done when

- `safeword sync-tracker` projects the corpus one-way to the configured provider.
- Both Linear and GitHub writers ship, behind one call site + shared `IssuePayload`.
- `status`/`epic`/`blocked_on`/`depends_on`/`type` map to each provider's primitives; re-running is idempotent via the `.safeword/tracker-map.json` sidecar.
- **Body egress:** default `minimal` (no spec/work-log body); `full` is opt-in; `full`→public-repo is refused without explicit ack; visibility re-checked each run.
- **Partial-failure recovery** is defined and tested: a crash mid-corpus resumes without double-creating.
- **Corpus is topologically sorted by parent** before writing (so sub-issue/parent refs exist); writes are rate-limited with backoff.
- **GitHub issue-type prerequisite** (org-level definitions) is documented, with graceful skip when undefined.
- `.safeword/config.json` carries the `ticketBridge` block (default `provider: none`, `body: minimal`).
- Non-interactive auth path (Arcade Headers + the service-identity caveat) documented.
- Both writers covered by unit tests against mocked MCP/`gh` clients; no live tracker in tests.

## Work Log

- 2026-05-24T21:44:38.516Z Started: Created ticket JS5K5G.
- 2026-05-24T21:45:00.000Z Drafted: alert-routing scope.
- 2026-06-20T11:58:00Z Reframed alert-routing → generic ticket bridge.
- 2026-06-20T12:32:00Z Collapsed to `safeword sync-tracker` (per the simplify + Linear+GitHub figure-it-out). Dropped the adapter framework (two providers → thin two-writer seam, single call site + shared payload; extract an interface at #3). Absorbed THSPA5's coordination mapping (superseded it). Breach caller split to deferred stub K51FYZ. Removed epic membership (WG3Z2N deleted); slug ticket-bridge → sync-tracker.
- 2026-06-20T16:12:00Z Applied quality-review + figure-it-out fixes. **Corrected a verified factual error:** Arcade _does_ expose GitHub — the real reason to route GitHub natively is its toolkit lacks sub-issues/deps/types (verified Arcade docs). Confirmed `Linear_CreateIssueRelation` exists. Set **body-egress default = minimal** (title/status/labels/link only) + full opt-in + public-repo guard (Saltzer fail-safe defaults). Moved `TrackerRef` to a `.safeword/tracker-map.json` **sidecar** (keeps files canonical, no sync write-back) + partial-failure resume. Added topological-parent ordering (GitHub sub-issue API links existing issues), org-level issue-type prerequisite + graceful skip, rate-limit/backoff. Resolved non-interactive auth → Arcade Headers mode, flagged the user-identity-not-service-account caveat.
