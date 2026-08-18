---
id: 2N1MQF
slug: relocate-bdd-lane-cleanly
type: task
phase: intake
status: in_progress
created: 2026-08-18T15:17:31.841Z
last_modified: 2026-08-18T15:17:31.841Z
---

# Let teams relocate the BDD lane without a stray default folder

**Goal:** When paths.features/paths.steps are configured, stop scaffolding and scanning the unused default features/ and steps/ directories

**Why:** paths.features/paths.steps currently only augment the defaults (never replace), so a team standardizing on e.g. behaviors/ still gets an orphaned, unused features/steps/ scaffold and double-scanning; arcade-monorepo's tests/behaviors convention surfaced this gap

## Work Log

- 2026-08-18T15:17:31.841Z Started: Created ticket 2N1MQF
