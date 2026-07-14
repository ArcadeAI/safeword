---
id: EKK1HA
slug: stabilize-zombie-process-discovery
type: task
phase: verify
status: in_progress
subtype: bug-investigated
created: 2026-07-14T05:13:01.118Z
last_modified: 2026-07-14T05:13:01.118Z
---

# Stabilize zombie process discovery

**Goal:** Make the cleanup-zombies behavioral test reliably discover and terminate its project-scoped process.

**Why:** The current fixture sometimes fails process discovery before the preview can prove safe kill behavior.

## Work Log

- 2026-07-14T05:13:01.118Z Started: Created ticket EKK1HA
- 2026-07-14T05:15:00.000-04:00 Root cause: the fixture embeds Node's logical `/var/...` temporary path in the process command, while the script receives the physical `/private/var/...` path from `pwd`. The project-scoped `pgrep` requires an exact spelling and reports no process. Confirmed by the failing output and manual process inspection. Ruled out an unstarted victim (`kill(pid, 0)` succeeds) and a broken marker regex (the logical spelling matches manually). Teach the script to match both safe path spellings.

## Root Cause

On macOS, `/var` resolves through `/private/var`. The cleanup script compares
the physical project directory with a process command carrying the logical path,
so its safety-scoped lookup misses a process in the same directory.

Ruled out: the victim process is alive; the marker regex works when both sides
use the logical spelling.

## Work Log

- 2026-07-14T05:25:00.000-04:00 Implemented: cleanup-zombies now retains the safe `/var/...` alias when `pwd -P` resolves a project to `/private/var/...`, and searches either exact project spelling without widening the process scope.
- 2026-07-14T05:26:00.000-04:00 Verify: cleanup-zombies behavioral regression passes as part of 70/70 Rust and cleanup tests; lint and TypeScript typecheck pass. Advanced to verify.
