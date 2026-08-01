---
id: CCYD5S
slug: explain-test-lock-waits
type: patch
phase: implement
status: in_progress
created: 2026-07-31T04:00:07.559Z
last_modified: 2026-08-01T15:29:25Z
---

# Make test-lock waits understandable for maintainers

**Goal:** Show who owns the package-test lock and how long a waiting test run has been queued.

**Why:** A single silent wait notice makes legitimate cross-worktree serialization look like a hung test suite.

## Work Log

- 2026-08-01T15:29:25Z Review follow-up: Restoring exact subprocess argument
  assertions, repairing scenario-ledger ownership and ordering, and extending
  safe fallback/recovery to blank maximum waits and unidentifiable owner JSON.
- 2026-08-01T15:29:25Z RED: Focused lock-runner coverage reproduced a blank
  maximum wait bypassing serialization and a stale `{}` owner reaching the
  zero-wait escape instead of mtime recovery.
- 2026-07-31T11:00:00Z Review follow-up: Restored the negative maximum-wait
  fallback, routed non-object owner metadata through mtime stale-lock recovery,
  and expanded the status proof across every emitted interval.
- 2026-07-31T08:33:00Z Review follow-up: Restored zero status interval's
  backward-compatible default fallback, replaced inverse elapsed-format parsing
  with deterministic output assertions, and added non-object metadata coverage.
  Focused runner suite passed 10/10.
- 2026-07-31T07:30:00Z Review follow-up: Restoring zero interval's existing
  invalid-value fallback, replacing a rounding-sensitive status assertion, and
  characterizing non-object owner metadata before closing fresh PR findings.
- 2026-07-31T07:00:00Z Refactored: Extracted lock creation from the wait loop
  without changing metadata, serialization, stale-lock recovery, or wait-cap
  behavior. Focused runner suite passed 9/9.
- 2026-07-31T07:00:00Z Refactor scout: Reopened the runner-maintainability
  follow-up with one leaf-first ledger entry: extract lock creation from the
  wait loop under the existing integration coverage.
- 2026-07-31T06:21:12Z Review follow-up: Consolidated owner-file and integer
  environment parsing, rate-limited status intervals to a 50 ms minimum, and
  updated runner tests for human-readable elapsed waits. Focused runner tests
  passed 9/9.
- 2026-07-31T05:14:21Z Done: Package-test lock owners now record their
  checkout root; queued commands report owner PID, checkout, and elapsed wait
  after one second and every thirty seconds. Focused tests, full Vitest, lint,
  Gherkin validation, typecheck, formatting, and diff checks passed.
- 2026-07-31T05:04:26Z GREEN: The lock-runner suite passed 8/8 after adding
  periodic status and incomplete-owner fallback behavior.
- 2026-07-31T05:02:55Z RED: Two focused integration scenarios failed because
  the wrapper emitted neither periodic status nor owner details.
- 2026-07-31T04:00:07.559Z Started: Created ticket CCYD5S
