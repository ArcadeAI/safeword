---
id: AKZJXC
slug: ticket-relations
parent: VKNF1T-platform-uplift-epic
type: task
phase: intake
status: in_progress
created: 2026-06-10T04:00:49.011Z
last_modified: 2026-06-10T04:00:49.011Z
scope: |
  v1 of structured ticket relations — the data field + visibility + safety:
  - `depends_on: [<id>, …]` inline-array frontmatter: one canonical directed
    edge, parsed by a shared helper that splits the scalar value into ids
    (conforms to the hand-rolled scalar frontmatter parser — no yaml-package
    swap).
  - INDEX renders edges slug-first: `blocked by: <slug (id)>` on the dependent
    and the derived inverse `blocks: …` on each target (inverse computed across
    the corpus, never stored — single source of truth).
  - `safeword check` flags dangling refs (depends_on a nonexistent ticket) and
    cycles (A→B→A) — warn, not error (mirrors existing ID-resolution tolerance).
  - Unit guards for the parse helper, the inverse derivation, and both
    validators.
out_of_scope: |
  - The replan "blocker moved" staleness signal — most-coupled (reaches into
    replan-relevance.ts), advisory-only, needs its own trigger design; deferred
    to a fast-follow so v1 ships the data+visibility core. It consumes the
    field once it exists.
  - A soft `related:` edge; `duplicate` (safeword has status: superseded); any
    storage of the inverse `blocks` (always derived).
  - The Linear coordination mirror (THSPA5) — a different seam (coordination).
  - Re-ordering or gating tickets from the graph — surfacing only; sequencing
    stays a human call.
  - Cross-variant `blocks` back-references (active↔completed). INDEX derives the
    inverse within one variant; check validates the full corpus. An active→
    completed edge renders `blocked by:` (bare id) but no reciprocal `blocks:`
    on the completed side. Acceptable — edges are overwhelmingly active→active;
    an edge onto a completed ticket is the already-satisfied case. Fast-follow
    only if cross-status edges become common (quality-review 2026-06-12).
done_when: |
  - A ticket carrying `depends_on: [X, Y]` parses to two ids via the shared
    helper; missing/empty parses to [].
  - INDEX shows `blocked by:` on the dependent and the derived `blocks:` on each
    target, slug-first.
  - `safeword check` warns (non-fatal) on a dangling depends_on and on a cycle;
    a clean corpus stays silent.
  - `npx vitest run` passes for every touched test file from packages/cli/.
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
- 2026-06-11T24:10:00Z Revalidated (still-good — no commit since 8d0330ef touched index.ts/check.ts/replan-relevance.ts) + /figure-it-out. Load-bearing finding: `parseFrontmatter` (index.ts:59) is a hand-rolled SCALAR line parser (`Map<string,string>`), not YAML — a block-list wouldn't parse and `depends_on: [A,B]` arrives as a literal string. Decided: representation = inline-array `depends_on: [<id>,…]` split by a shared helper (conforms to the scalar parser everywhere; rejected swapping in the `yaml` package — touches every reader + risks leading-zero-ID handling, too big for one field). v1 scope = field + INDEX render (derive `blocks` across corpus) + check validation (dangling + cycles, warn-not-error). DEFERRED the replan "blocker moved" signal (most-coupled, advisory, separable) to a fast-follow → recorded in out_of_scope. Re-sized feature→task (deterministic infra, no user flow to discover — same shape as sibling ZRXM6Q). Building via TDD: shared module `src/utils/ticket-relations.ts` (parse + deriveBlocks + findDangling + findCycles) first.
- 2026-06-11T24:30:00Z v1 BUILT (3 commits). Shared module ticket-relations.ts — parseTicketIdList / deriveBlocks / findDanglingDependencies / findTicketsInCycles, 11 unit tests. INDEX renders `blocked by:` + derived `blocks:` slug-first, bare-id fallback for out-of-index targets (3 ticket-sync tests). `safeword check` emits zero-exit advisories on dangling refs + cycles via findRelationAdvisories over the full corpus (2 CLI subprocess tests, rebuilt dist). tsc + eslint clean. Live INDEX.md unchanged — no ticket carries depends_on yet, so both render guards stay false (no churn). Replan "blocker moved" signal deferred per out_of_scope. Next: /verify to close.

## Work Log

- 2026-06-10T04:00:49.011Z Started: Created ticket AKZJXC
