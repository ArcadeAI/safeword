---
id: AKZJXC
slug: ticket-relations
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-10T04:00:49.011Z
last_modified: 2026-06-10T04:00:49.011Z
---

# Structured ticket relations (depends_on/blocks), absorbed from Linear's model

**Goal:** Add a lightweight, structured `depends_on:` relations field to ticket frontmatter — absorbing Linear's first-class issue-relations _concept_ (not the SaaS) — so cross-ticket dependencies become machine-readable: rendered in the INDEX and reasoned over by replan.

**Why:** Cross-ticket couplings live only as **prose** today. This session alone produced three — "audit is the pivot" (263422 ↔ 9BDDGP ↔ C2F601), 469YSR → 3293WH (the output fix gates the self-verify's clean output), and the brainstorm/elicit/figure-it-out trio. The agent re-derives them from English each time, the INDEX can't show the dependency graph, and replan can't reason "a blocker moved → this ticket may be stale." A structured field fixes all three, with **zero external dependency** — we absorb the data-model idea, not Linear.

> Status: **intake**. From the file-vs-Linear `/figure-it-out` (2026-06-10): the seam is **execution (local, hook-gated) vs coordination (Linear-projectable)**. This ticket is the high-value "absorb Linear's _relations_ concept" half. The paired "extract coordination → Linear (one-way mirror)" half is a **conditional sibling** (team-gated) — noted below, deliberately not its own ticket yet.

## Proposed shape

- **Frontmatter:** `depends_on: [<id>, …]` as the one canonical, directed field. Derive the inverse (`blocks`) at render time — avoid storing both (two-place consistency). [Linear models blocking/blocked-by/related/duplicate](https://linear.app/docs/issue-relations); we start with the load-bearing directed edge.
- **INDEX:** render the edges slug-first (`blocked by: <slug (id)>`, `blocks: …`) so the graph is visible at a glance.
- **replan:** when a `depends_on` target's files change or its status flips, extend the existing replan-on-resume heads-up with a "blocker moved" staleness signal (advisory, opt-in — consistent with replan's design).
- **`safeword check`:** flag dangling refs (depends_on a nonexistent ticket) and cycles (A → B → A).

## Open questions (converge before spec)

- **Which relations?** Lean: `depends_on` (directed — drives sequencing + replan) only for v1; maybe a soft `related:` later. Skip `duplicate` (safeword has `status: superseded`).
- **Distinct from `parent`/`epic`?** Yes — `parent` is _containment_ (epic → children); `depends_on` is _sequencing_ (independent of containment, can cross epics). Keep both; don't conflate.
- **Missing/cross-branch targets.** A `depends_on` may point at a ticket on another branch or in `completed/`. Validation must **warn, not error** (mirror the existing ID-resolution tolerance).
- **Replan depth:** surface "blocker changed" only, or actually re-order/gate? Lean: surface (advisory) — re-ordering is a human call.

## Conditional sibling — the Linear coordination mirror (not now)

The other half of the figure-it-out: a one-way `file → Linear` mirror of the **epic/portfolio view** (initiatives + status + what's-next) so a PM gets a board/roadmap/notifications, file staying source of truth. **Only worth building if safeword targets teams, not solo devs.** Now filed and made provider-agnostic (Linear / GitHub / Jira via Arcade.dev MCP) as [external-tracker-mirror](../THSPA5-external-tracker-mirror/ticket.md) (THSPA5).

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md).
- Consumers: the replan mechanism (`replan-relevance.ts`) and the INDEX generator (`ticket-sync/index.ts`).
- The file-vs-Linear `/figure-it-out` this came from — this ticket is the "absorb" half; the Linear mirror is the conditional "extract" half.

## Work Log

- 2026-06-10T04:00:49.011Z Started: Created ticket AKZJXC.
- 2026-06-10T04:02:00Z Framed from the file-vs-Linear /figure-it-out. Seam = execution (local) vs coordination (Linear-projectable). This ticket absorbs Linear's relations concept (`depends_on:` frontmatter → INDEX graph + replan staleness), justified by this session's three prose-only couplings. Lean: one canonical directed `depends_on`, derive `blocks`; warn (not error) on dangling/cross-branch refs; replan surfaces "blocker moved" advisory-only. Linear coordination-mirror logged as a team-gated conditional sibling, not a ticket. Parented under VKNF1T.

## Work Log

- 2026-06-10T04:00:49.011Z Started: Created ticket AKZJXC
