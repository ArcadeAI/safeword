---
id: 6PYYY8
slug: repair-post-release-bdd-proofs
type: task
phase: intake
status: in_progress
created: 2026-09-06T15:25:52.475Z
last_modified: 2026-09-06T15:25:52.475Z
---

# Make post-release BDD proofs catch their claimed regressions

**Goal:** Replace semantically unrelated proof mappings and weak deployment assertions with executable behavior-specific evidence

**Why:** Several post-v0.83.1 features are marked as Vitest-proven even though their manifests point at tests that exercise different behavior, allowing false-green BDD completion.

## Tests

- The worker deployment proof asserts the complete CI dependency set rather than one member.
- Every changed `.bdd-proof.json` row names a test whose assertions exercise that scenario's actor boundary and observable result.
- The BDD provenance gate and every changed proof test pass from `packages/cli`.

## Work Log

- 2026-09-06T15:25:52.475Z Started: Created ticket 6PYYY8
- 2026-09-06T15:27:00Z Found: Structural provenance passes despite unrelated semantic mappings in the three post-release review-route manifests.
