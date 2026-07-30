# Work Log: Reuse monorepo topology during architecture healing

**Anchored to:** `.project/tickets/N3JTV5-avoid-repeated-monorepo-architecture-discovery/ticket.md`

## Session: 2026-07-29

- [17:00] Started from GitHub issue 1667; created task ticket N3JTV5.
- [17:05] Current call graph: `projectTargets` discovers leaves,
  `rootIndexTarget` rebuilds the model, and each `skeletonTarget` extracts nodes
  once for `shapeFingerprint` and again for rendering.
- [17:10] Figure-it-out options: pass only `MonorepoModel`; create an
  operation-scoped model + leaf-skeleton snapshot; or memoize existing helpers.
- [17:15] Research: Node documents filesystem race windows between separate
  calls; Bazel Skyframe models one evaluation as immutable input-derived values;
  Vitest supports spying on real module exports so filesystem-boundary counts
  can stay real-collaborator integration tests.
- [17:20] Decision: operation-scoped wrapper around the unchanged public model,
  with leaf skeletons precomputed once. Preserve target ordering by keeping the
  directory-sorted leaf list separate from the name-sorted package model.
- [17:25] Mikado ledger: (1) reuse one model for root rendering and leaf
  enumeration; (2) reuse each precomputed leaf skeleton for introspection,
  fingerprinting, matching, and rendering.
- [17:28] RED confirmed: one project heal read the root `package.json` twice.
- [17:30] GREEN: `projectTargets` now extracts one `MonorepoModel`, passes it to
  the root target, and derives a directory-sorted leaf list from the same model.
- [17:32] Regression check: 112 architecture project/model/document tests pass;
  target ordering remains directory-sorted and the unreadable-manager guard now
  reads the model's existing status.
- [17:35] Added focused unreadable-manager evidence: a malformed `go.work` is
  read once and still renders `## Coverage gaps`. The pre-refactor call graph
  read this path three times (leaf discovery, unreadable fallback, root model);
  the boundary test passes with one read after topology reuse.
