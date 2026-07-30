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
- [17:40] RED confirmed: a leaf source header used for generated purpose prose
  was read three times during one project heal.
- [17:42] GREEN: `MonorepoArchitectureSnapshot` now carries directory-sorted
  leaves and their skeletons alongside the unchanged name-sorted root model;
  `shapeFingerprintOf` accepts the observed skeleton just as
  `monorepoFingerprintOf` accepts the observed model.
- [17:44] Regression check: 190 architecture tests and `tsc --noEmit` pass.
  Existing tests pin the released fingerprint digest, root/leaf bytes, polyglot
  discovery, nested workspaces, zero-leaf behavior, and unreadable managers.
- [17:46] Cross-scenario refactor recorded at `ed9aa3dc3`; the shared operation
  snapshot and `shapeFingerprintOf` seam replace repeated per-scenario helpers.
- [17:47] Invoked the required fresh-context quality review for this two-loop task.
- [17:49] Quality review requested changes: readable zero-leaf workspaces fell
  back to single-repo extraction, whose workspace-root guard probed the manager
  a second time. Existing read-count tests missed the `existsSync` boundary.
- [17:50] RED confirmed: a readable zero-leaf `go.work` was probed twice.
- [17:52] GREEN: the snapshot now carries `workspaceRoot`; skeleton extraction
  accepts that observed fact and skips its defensive re-probe. The test also
  pins the prior `noop` result and absence of a generated document.
- [17:54] Regression check: 191 architecture tests and `tsc --noEmit` pass.
- [17:54] Fresh second-pass quality review: APPROVE. No critical issues or
  suggested improvements; reviewer independently confirmed full tests, lint,
  typecheck, and dependency audit.
- [17:55] Audit found one change-scoped dead-code issue: the leaf snapshot
  interface was exported despite being orchestration-internal. Removed the
  export in `769b9a6aa`; Knip and TypeScript then passed cleanly.
- [17:56] Full verification passed: 5,631 Vitest tests (5 skipped), 499/502
  Cucumber scenarios (3 skipped), 15,444 executed steps (4 skipped), build,
  lint, typecheck, and `bun audit` with no vulnerabilities.
