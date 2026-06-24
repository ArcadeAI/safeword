---
id: GJGSS3
slug: quiet-expected-negative-path-test-output
type: task
phase: intake
status: in_progress
created: 2026-06-24T14:49:00.471Z
last_modified: 2026-06-24T14:51:30.000Z
---

# Quiet expected negative-path test output

**Goal:** Keep passing full test runs quiet when negative-path fixtures intentionally print errors.

**Why:** Expected CLI and tool diagnostics in successful tests make long `dot` reporter runs harder to scan for real failures.

## Problem

During the PR #387 revalidation run, `bun run test -- --reporter=dot` passed, but the successful output included expected negative-path diagnostics such as:

- `go: warning: "./..." matched no packages`
- `no packages to test`
- `Already configured. Run safeword upgrade to update.`
- `CLI v0.55.0 is older than project v99.99.99.`
- `Not configured. Run safeword setup first.`
- `Ambiguous ticket ID "7K9M3P": 7K9M3P, 7K9M3P-spurious`

Those messages are useful assertions inside their tests, but noisy in a successful full-suite run.

## Acceptance Criteria

- [ ] Tests that intentionally exercise error or edge paths capture expected stdout/stderr instead of leaking it into passing test output.
- [ ] Assertions still verify the important user-facing messages for those negative paths.
- [ ] The full CLI suite with `bun run test -- --reporter=dot` is quiet aside from Vitest progress/summary and intentionally documented unavoidable output.
- [ ] Any helper used to silence output is opt-in and does not hide unexpected failures.
- [ ] Focused tests cover the output-capture helper or the highest-volume noisy fixtures.

## Related Files

- `packages/cli/tests/`
- `packages/cli/tests/utils/`
- `packages/cli/scripts/run-vitest-with-build-lock.mjs`

## Root Cause

Several tests invoke real CLI or external tool flows and assert failure behavior, but the expected stdout/stderr is not consistently captured around those calls.

## Work Log

- 2026-06-24T14:51:30Z Filed: Captured noisy-but-passing full-suite diagnostics from PR #387 revalidation.
- 2026-06-24T14:49:00.471Z Started: Created ticket GJGSS3
