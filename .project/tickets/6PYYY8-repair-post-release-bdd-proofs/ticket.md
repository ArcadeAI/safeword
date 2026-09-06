---
id: 6PYYY8
slug: repair-post-release-bdd-proofs
type: task
phase: verify
status: in_progress
created: 2026-09-06T15:25:52.475Z
last_modified: 2026-09-06T16:20:03.000Z
scope:
  - Repair semantically false BDD proof mappings introduced after v0.83.1
  - Strengthen their Vitest assertions at public command and process boundaries
out_of_scope:
  - Implement the proposed trusted-executor enforcement from GitHub issue 2336
  - Rewrite pre-v0.83.1 feature suites or production review behavior
done_when:
  - Changed proof mappings name tests that exercise each scenario's observable behavior
  - Worker deployment asserts the complete required CI dependency set
  - Targeted review, deployment, and BDD provenance tests pass
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
- 2026-09-06T15:50:00Z Implemented: Replaced helper-only and unrelated mappings with public-command route, deadline, status, provenance, mutation, and failure evidence.
- 2026-09-06T16:13:00Z Verified: 291 targeted tests passed across seven files; two platform-specific tests skipped.
- 2026-09-06T16:20:03Z Verified: Full CLI suite passed — 9,203 tests across 557 files; 16 platform- or condition-specific tests skipped.
