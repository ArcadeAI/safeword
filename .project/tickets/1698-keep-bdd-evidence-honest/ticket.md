---
id: 1698
type: task
subtype: bug-investigated
phase: done
status: done
created: 2026-07-30T23:02:19Z
last_modified: 2026-07-31T03:56:10Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1698
---

# Keep BDD evidence honest for user-visible scenarios

**Goal:** Prevent implementation-level tests from being reported as proof of a
user-visible scenario they do not exercise.

**Why:** A green scenario should mean the named user action and observable
result were demonstrated, not only the underlying state transition.

## Root Cause

The earlier `bun run test` appeared idle because the test wrapper was waiting
for safeword's global package-test lock, which was legitimately owned by a test
run in another worktree. The wrapper serializes package tests across worktrees
and permits up to 20 minutes of lock waiting.

This was confirmed by reading the lock's `owner.json`, matching its live PID to
the other worktree's `run-vitest-with-build-lock.mjs` process, and observing
that run advance through changing Vitest worker PIDs until it released the
lock. Our queued command then built, ran, and passed normally.

Ruled out:

- A stale lock: its owner PID was alive and released the lock naturally.
- A frozen Vitest process: our command had not entered Vitest while it appeared
  idle.
- An open handle introduced by issue #1698: the full suite exited successfully
  after running the new tests.

## Work Log

- 2026-07-31T03:56:10Z Investigated: The apparent full-suite hang was global
  test-lock contention from another worktree. After the lock released,
  `bun run test` passed 5,645 tests with 5 skips across 377 files.
- 2026-07-31T01:19:43Z Refactored: Added explicit result-boundary
  characterization coverage, clarified test helper names and terminology, and
  reverified 1,244 done-gate tests plus 44 focused and adjacent tests.
- 2026-07-30T23:13:55Z Complete: Added the scenario proof-fidelity contract,
  RED/REFACTOR review checks, template parity coverage, and verification
  evidence.
- 2026-07-30T23:13:21Z Verified: Done-gate suite passed 1,242 tests; lint,
  Gherkin validation, and typecheck passed. The broader full suite remained
  idle past five minutes and was stopped without a failure result.
- 2026-07-30T23:06:15Z GREEN: Scenario proof-fidelity contract passed 4/4
  focused checks; refactored the checks into single-behavior cases.
- 2026-07-30T23:03:35Z RED: Contract test failed 4/4 because the fidelity rule
  and review checkpoints were absent.
- 2026-07-30T23:02:19Z Started: Agreed on a contract-boundary rule after
  comparing clause-fidelity guidance, metadata, and deterministic gates.
