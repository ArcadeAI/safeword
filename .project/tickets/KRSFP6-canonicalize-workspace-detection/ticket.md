---
id: KRSFP6
slug: canonicalize-workspace-detection
type: task
phase: intake
status: in_progress
created: 2026-07-31T03:22:03.664Z
last_modified: 2026-07-31T03:22:03.664Z
---

# Keep workspace detection consistent across architecture commands

**Goal:** Use one canonical workspace-discovery policy across architecture generation paths

**Why:** Duplicated discovery rules can make architecture outputs disagree as workspace layouts evolve

**Scope:** Compare workspace discovery in `architecture-skeleton` and
`architecture-monorepo`, define one shared policy, migrate both consumers, and
preserve generated architecture output for existing repository shapes.

**Out of Scope:** New workspace formats, changes to package-manager semantics,
or redesigning architecture document content.

## Done When

- [ ] Both architecture paths call one workspace-discovery implementation.
- [ ] Single-package, packages/*, apps/*, and mixed-layout fixtures retain their current output.
- [ ] No consumer reconstructs workspace roots independently.

## Tests

- [ ] Add characterization tests for every currently supported workspace layout.
- [ ] Run architecture generation, dependency-cruiser, typecheck, and package tests.

## Work Log

- 2026-07-31T03:22:03.664Z Started: Created ticket KRSFP6
- 2026-07-31T03:23:00.000Z Deferred: Release refactor review found this cross-architecture duplication; isolated follow-up avoids widening the v0.70 release diff.
