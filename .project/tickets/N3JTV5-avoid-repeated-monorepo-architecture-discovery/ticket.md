---
id: N3JTV5
slug: avoid-repeated-monorepo-architecture-discovery
type: task
phase: done
status: done
created: 2026-07-30T00:00:10.960Z
last_modified: 2026-07-31T06:38:12.000Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1667
external_prs: [https://github.com/ArcadeAI/safeword/pull/1685]
---

# Reuse monorepo topology during architecture healing

**Goal:** Build one monorepo model per architecture operation and reuse it for root and leaf work without changing output.

**Why:** Repeated discovery adds filesystem work and can observe inconsistent snapshots during one heal.

**Type:** Refactor

**Scope:** Reuse one operation-scoped monorepo architecture snapshot for root-index
rendering, leaf-target enumeration, and leaf skeleton rendering/fingerprinting.

**Out of Scope:** Redesigning workspace discovery, supporting new workspace layouts,
changing generated architecture bytes, or changing released fingerprint recipes.

**Done When:**

- [x] Root and leaf architecture output remains byte-identical for unchanged projects.
- [x] Readable workspace packages and unreadable workspace managers are discovered once per operation.
- [x] Each leaf skeleton is extracted once and reused for its target fingerprint and rendering.
- [x] Polyglot, nested, zero-leaf, and unreadable-workspace behavior remains covered.
- [x] Package ordering, dependency edges, fingerprints, and coverage-gap reporting remain unchanged.

**Tests:**

- [x] Integration: a readable workspace manifest is read once by one project heal.
- [x] Integration: an unreadable workspace manager is read once by one project heal.
- [x] Integration: a source header used for a leaf purpose is read once by one project heal.
- [x] Regression: architecture project, monorepo, fingerprint, skeleton, and document suites remain green.

## Work Log

- 2026-07-30T00:00:10.960Z Started: Created ticket N3JTV5
- 2026-07-30T00:12:00.000Z Found: `projectTargets` discovers leaves, `rootIndexTarget`
  independently extracts the model, and `skeletonTarget` independently extracts
  nodes after `shapeFingerprint` already extracted them.
- 2026-07-30T00:15:00.000Z Decided: use an operation-scoped wrapper containing the
  unchanged `MonorepoModel` plus precomputed leaf skeletons; reject path-keyed
  memoization because it adds invalidation state.
- 2026-07-30T00:28:00.000Z Complete: project target construction now extracts one
  model and reuses it for the root target and directory-sorted leaf enumeration;
  112 focused architecture tests pass.
- 2026-07-30T00:42:00.000Z Complete: the operation snapshot now carries each
  precomputed leaf skeleton through introspection, fingerprinting, matching, and
  rendering; the seeded-source boundary read dropped from three to one and 190
  focused tests plus TypeScript pass.
- 2026-07-30T00:50:00.000Z Fixed: independent review found readable zero-leaf
  workspaces re-probed their manager during the single-repo fallback; the known
  workspace-root fact now flows into skeleton extraction and the noop behavior
  remains pinned.
- 2026-07-30T00:54:00.000Z Reviewed: fresh second-pass quality review approved
  the complete diff with no critical issues or suggested improvements.
- 2026-07-30T00:56:55.000Z Verified: 5,631 tests and 499 executable acceptance
  scenarios pass; build, lint, typecheck, dependency, and audit gates are green.
  Ticket remains in progress pending user confirmation.
- 2026-07-30T16:32:18.000Z Resolved: latest PR review comments now enforce
  precomputed skeletons at the type boundary and remove the complete test-only
  monorepo compatibility chain from production. A fresh independent review
  approved both fixes; 191 focused architecture tests and the full verification
  and audit gates remain green.
- 2026-07-31T06:38:12.000Z Closed: user confirmed completion after PR #1685
  admin-squash-merged as `df31c884f`; merged-main CI run 30608828332 passed
  Dogfood parity, lint, Node 22, Node 24, acceptance, and release gates. The
  session retro filed Safeword follow-ups #1701, #1702, and #1703.
