---
id: M1FGRJ
slug: tracker-relations-projection
type: feature
phase: intake
status: blocked
depends_on: [JS5K5G]
created: 2026-06-20T16:15:56.239Z
last_modified: 2026-06-20T16:16:00Z
---

# sync-tracker v2 — project the dependency graph (relations, sub-issues, types)

> **v2 of [sync-tracker (JS5K5G)](../JS5K5G-sync-tracker/ticket.md).** Blocked on the v1 skeleton — it extends the same command, payload, writers, and `tracker-map.json` sidecar. Do not start until v1's flat projection ships and the GitHub dependencies API has settled.

**Goal:** Extend `safeword sync-tracker` from a flat board to a **dependency-aware** projection: map safeword's `epic`/`parent` to tracker **sub-issues/parents**, `blocked_on`/`depends_on` to tracker **issue relations**, and `type` to native **issue-types** — so the external roadmap shows ordering and hierarchy, not just grouping.

**Why deferred from v1 (the figure-it-out):** this slice is simultaneously the **highest-cost** (sub-issue API, dependency API, topo-sort), **lowest-adoption** (board-level dependency viz is weak in practice — [evidence](https://www.quirk.com.au/jira-dependency-management-guide/)), and **newest-API** (GitHub's issue-dependencies CLI landed [2026-06-10](https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/), ~10 days before v1 was scoped). The graph already renders locally in the INDEX (AKZJXC), so v1 loses no visibility by deferring it. v2 builds it once the skeleton walks and the API has cooled.

## Scope

- Extend `IssuePayload` with `parent?: TrackerRef` and `relations?: { blockedBy; dependsOn }`.
- **GitHub board parity — Projects v2 placement.** On GitHub the board/roadmap lives in **Projects v2**, not the issues ([verified](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects)). This slice adds each issue to a configured Project and sets its Status field — turning v1's labeled list into an actual board. (On Linear the issue is already on the board, so this is a GitHub-specific add.) Note: writing the Project Status field re-touches status-ownership — define which fields safeword sets vs leaves to the team.
- **Linear:** `Linear_CreateIssueRelation` (blocks/blockedBy, [verified](https://docs.arcade.dev/en/resources/integrations/productivity/linear)); native project/parent for epics.
- **Jira (if/when in scope):** maps most natively of the three — native `parent` hierarchy, native issue links (blocks/relates), required issue types. The graph is cleanest here, not newest-API.
- **GitHub:** route **natively** (`gh` / GitHub API — Arcade's GitHub toolkit lacks these) for sub-issues, dependencies ([REST 2026-03-10](https://docs.github.com/en/rest/issues/issue-dependencies?apiVersion=2026-03-10)), and issue-types.
- **Topological-parent ordering:** the corpus walk sorts by `parent`/`epic` before writing, because the GitHub sub-issue API _links an existing issue_ — the parent ref must exist first.
- **GitHub issue-type prerequisite:** org-level type definitions; skip gracefully (fall back to the `type:` label from v1) when undefined.
- Promote `epic`/`type` from labels (v1) to native hierarchy/types where the provider supports them; keep labels as the fallback.

## Out of scope

- Everything v1 owns (command, auth, flat issues, idempotency sidecar, body egress).
- Two-way relation read-back.

## Done when

- `blocked_on`/`depends_on`/`epic`/`parent`/`type` project to each provider's native primitives, idempotently, reusing the v1 sidecar.
- Corpus is topologically sorted by parent before writing; GitHub issue-type absence falls back to the label.
- Covered by unit tests against mocked `gh`/MCP clients; no live tracker.

## Work Log

- 2026-06-20T16:16:00Z Created as the v2 split from JS5K5G — the dependency-graph projection deferred out of the v1 walking skeleton (cost/adoption/API-recency). `depends_on: [JS5K5G]`; status blocked until v1 ships.
