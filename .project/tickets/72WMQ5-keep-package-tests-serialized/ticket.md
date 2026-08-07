---
id: 72WMQ5
slug: keep-package-tests-serialized
type: patch
phase: verify
status: in_progress
created: 2026-08-07T09:10:34.424Z
last_modified: 2026-08-07T10:00:34Z
---

# Keep package tests serialized after lock waits

**Goal:** Never run Vitest without the machine-wide test lock.

**Why:** The current wait-cap fallback can launch a concurrent test run and invalidate local verification.

## Work Log

- 2026-08-07T09:10:34.424Z Started: Created ticket 72WMQ5
