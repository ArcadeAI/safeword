---
id: Z7WM31
slug: relay-concurrency-checks-under-load
type: task
subtype: bug-investigated
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/2289
created: 2026-08-09T01:07:26.017Z
last_modified: 2026-08-09T01:07:26.017Z
---

# Keep relay concurrency checks reliable under load

**Goal:** Make the real-subprocess lock qualification deterministic under host load.

**Why:** An unsynchronized wall-clock race makes unrelated delivery verification fail on healthy code.

**Scope:** Make the existing real-subprocess process-lock qualification deterministic by coordinating contender readiness, contention, and winner release explicitly.

**Out of Scope:** Production lock behavior, production timeouts, relay request scheduling, and unrelated timing-sensitive tests.

## Root Cause

The test launches 24 Node subprocesses against a shared future wall-clock time, then lets the winner release after one second. It never proves every subprocess has imported the bundle and reached the contention point before that release. A late contender can therefore acquire sequentially, or startup overhead can consume the five-second case deadline.

Confirmed by reproducing both failure shapes on current `main`: the same test first timed out and then reported two `acquired` results. PR #2278 has no retro-relay diff. A project-scoped zombie scan found no stale test processes.

Ruled out: a #2278 regression (the package is unchanged from `main`); simultaneous SQLite ownership (the second acquisition occurs after the uncoordinated release window); project-owned zombie processes (cleanup preview found none).

## Done When

- [x] All contenders report readiness before the parent opens the start barrier.
- [x] The winner holds the lock until every contender reports its acquisition outcome.
- [x] Exactly one contender acquires and every other contender is blocked.
- [x] Child failure, malformed output, and early exit remain visible.
- [x] The focused test passes repeatedly on the previously failing host.
- [x] Full retro-relay and repository verification pass.

## Tests

- [x] Real subprocess: coordinate 24 ready contenders and prove one acquisition during a single held-lock interval.
- [x] Repeat the focused qualification to prove the result is not wall-clock dependent.
- [x] Run the full retro-relay suite and repository verification.

## BDD Impact

No new Gherkin scenario: this changes only the synchronization mechanics of an existing internal qualification test and does not change shipped behavior.

## Work Log

- 2026-08-09T01:07:26.017Z Started: Created ticket Z7WM31
- 2026-08-09T01:10:00.000Z Investigated: Confirmed the wall-clock start and one-second release do not form a readiness barrier; recorded GitHub issue #2289.
- 2026-08-09T02:05:00.000Z Implemented: Replaced the future-time race with explicit ready/start/outcome/release coordination; production lock code remains unchanged.
- 2026-08-09T02:06:00.000Z Verified: Corrected focused test passed four consecutive runs; full retro-relay suite passed 167/167 with one intentional skip; affected-file ESLint, retro-relay TypeScript, and diff whitespace checks passed. Full repository ESLint was stopped after 19 minutes on the newly installed slow filesystem and remains delegated to PR CI.
- 2026-08-09T04:50:00.000Z Reverified: After merging current main and the Claude/Codex host-boundary isolation fix, the exact branch passed 471 test files (7,109 tests; 5 intentional skips), full lint, TypeScript, dependency audit, generated Claude plugin parity, and whitespace checks.
