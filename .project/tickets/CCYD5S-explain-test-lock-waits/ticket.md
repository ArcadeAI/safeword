---
id: CCYD5S
slug: explain-test-lock-waits
type: patch
phase: done
status: done
created: 2026-07-31T04:00:07.559Z
last_modified: 2026-07-31T05:14:21Z
---

# Make test-lock waits understandable for maintainers

**Goal:** Show who owns the package-test lock and how long a waiting test run has been queued.

**Why:** A single silent wait notice makes legitimate cross-worktree serialization look like a hung test suite.

## Work Log

- 2026-07-31T05:14:21Z Done: Package-test lock owners now record their
  checkout root; queued commands report owner PID, checkout, and elapsed wait
  after one second and every thirty seconds. Focused tests, full Vitest, lint,
  Gherkin validation, typecheck, formatting, and diff checks passed.
- 2026-07-31T05:04:26Z GREEN: The lock-runner suite passed 8/8 after adding
  periodic status and incomplete-owner fallback behavior.
- 2026-07-31T05:02:55Z RED: Two focused integration scenarios failed because
  the wrapper emitted neither periodic status nor owner details.
- 2026-07-31T04:00:07.559Z Started: Created ticket CCYD5S
