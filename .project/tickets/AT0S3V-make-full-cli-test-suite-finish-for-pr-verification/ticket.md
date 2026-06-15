---
id: AT0S3V
slug: make-full-cli-test-suite-finish-for-pr-verification
type: task
phase: intake
status: in_progress
created: 2026-06-15T13:52:10.781Z
last_modified: 2026-06-15T14:49:38Z
---

# Make full CLI test suite observable for PR verification

**Goal:** Make the full CLI test suite's long local runtime explicit enough that PR verification is not mistaken for a hang.

**Why:** CI runs `bun run --cwd packages/cli test` with `TEST_POETRY=1` before merging. Locally, the default reporter can stay silent for long stretches, which made a healthy full-suite run look hung during audit.

**Scope:** Reproduce the long-running local full-suite behavior, distinguish a real hang from expected runtime, and decide whether the follow-up should add reporting/progress guidance instead of changing React plugin code.

**Out of Scope:** Rewriting unrelated integration tests, replacing the CI test strategy, or blocking the React plugin migration on expected full-suite runtime.

**Done When:**

- [x] `TEST_POETRY=1 bun run --cwd packages/cli test` completes locally with an explicit Vitest pass/fail summary.
- [x] The original long-runtime cause is documented in this ticket.
- [ ] Any desired reporting or audit-guidance improvement is implemented in the follow-up ticket work.

## Work Log

- 2026-06-15T13:52:10.781Z Started: Created ticket AT0S3V
- 2026-06-15T13:52:44Z Intake: Audit found the full package test command did not finish after roughly 10 minutes and had to be interrupted with exit 130; focused React tests, related preset/schema tests, smoke-fast, and BDD passed.
- 2026-06-15T14:49:38Z Revalidated: `TEST_POETRY=1 bun run --cwd packages/cli test -- --reporter=verbose` completed with 198 test files and 2923 tests passed in 1361.30s, proving the suite progresses when Vitest prints per-test output.
- 2026-06-15T14:49:38Z Revalidated exact CI lane: `TEST_POETRY=1 bun run --cwd packages/cli test` completed with 198 test files and 2923 tests passed in 1662.58s. The default reporter stayed quiet for long stretches and emitted the existing `Ambiguous ticket ID "7K9M3P"` warning near the end.
- 2026-06-15T14:49:38Z Decision: This is not a React plugin PR blocker. Keep the follow-up focused on making long full-suite verification more observable or better documented for local audit runs.
