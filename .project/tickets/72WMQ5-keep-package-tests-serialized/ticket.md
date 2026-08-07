---
id: 72WMQ5
slug: keep-package-tests-serialized
type: patch
subtype: bug-investigated
phase: done
status: done
created: 2026-08-07T09:10:34.424Z
last_modified: 2026-08-07T17:31:00Z
---

# Keep package tests serialized after lock waits

**Goal:** Never run Vitest without the machine-wide test lock.

**Why:** The current wait-cap fallback can launch a concurrent test run and invalidate local verification.

## Work Log

- 2026-08-07T09:10:34.424Z Started: Created ticket 72WMQ5

## Root Cause

The package-test runner made stale-lock inspection and recursive deletion outside any shared state-transition lock. Two waiters could inspect the same stale owner, one could replace it, and the other could then delete that replacement. Separately, the six-hour timestamp fallback overrode a usable live PID, allowing a legitimately long-running owner to be reaped. Either path could start overlapping build/Vitest processes.

Confirmed by regression tests on current `origin/main`: an aged lock owned by the live test process was reaped, and eight simultaneous dead-owner recoveries produced a failed runner from competing state mutations. The current-main implementation was inspected after the branch caught up and contained the same stale-reaper logic. Ruled out the wait-cap change and relay timing assertion as causes; both are downstream and unrelated to stale-lock ownership transitions.
