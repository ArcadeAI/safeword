---
id: Y1484A
slug: run-github-live-smokes-without-waiting-for-builds
type: task
phase: done
status: done
scope:
  - Keep the two source-only GitHub live smokes runnable during an unrelated locked package test.
out_of_scope:
  - General concurrent Vitest execution, process cancellation, and shared test capacity.
done_when:
  - The fixed live-smoke lane is BDD-specified and cannot accept arbitrary Vitest arguments.
created: 2026-08-11T00:00:00Z
last_modified: 2026-08-12T00:00:00Z
---

# Run GitHub live smokes without waiting for builds

**Goal:** Let maintainers run the two proven source-only GitHub smokes while an unrelated package test owns the normal build-and-Vitest lock.

**Feature:** `packages/cli/features/run-github-live-smokes-without-waiting-for-builds.feature`
