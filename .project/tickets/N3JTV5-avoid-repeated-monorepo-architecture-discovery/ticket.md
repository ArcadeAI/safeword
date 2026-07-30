---
id: N3JTV5
slug: avoid-repeated-monorepo-architecture-discovery
type: task
phase: implement
status: in_progress
created: 2026-07-30T00:00:10.960Z
last_modified: 2026-07-30T00:00:10.960Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1667
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

- [ ] Root and leaf architecture output remains byte-identical for unchanged projects.
- [ ] Readable workspace packages and unreadable workspace managers are discovered once per operation.
- [ ] Each leaf skeleton is extracted once and reused for its target fingerprint and rendering.
- [ ] Polyglot, nested, zero-leaf, and unreadable-workspace behavior remains covered.
- [ ] Package ordering, dependency edges, fingerprints, and coverage-gap reporting remain unchanged.

**Tests:**

- [ ] Integration: a readable workspace manifest is read once by one project heal.
- [ ] Integration: an unreadable workspace manager is read once by one project heal.
- [ ] Integration: a source header used for a leaf purpose is read once by one project heal.
- [ ] Regression: architecture project, monorepo, fingerprint, skeleton, and document suites remain green.

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
