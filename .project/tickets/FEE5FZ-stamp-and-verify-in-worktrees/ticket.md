---
id: FEE5FZ
slug: stamp-and-verify-in-worktrees
type: patch
phase: intake
status: in_progress
created: 2026-10-05T00:12:51.658Z
last_modified: 2026-10-05T00:12:51.658Z
---

# Stamp reviews and run audit and verify on the right tree for worktree sessions

**Goal:** Review stamps, /audit and /verify resolve the project from the worktree they run in, not the launch checkout (#5361).

**Why:** In a worktree session CLAUDE_PROJECT_DIR stays at the launch checkout, so approved reviews on worktree tickets could not be stamped and audit/verify ran on the wrong tree.

## Work Log

- 2026-10-05T00:12:51.658Z Started: Created ticket FEE5FZ
- 2026-10-05T00:14:00Z Complete: stamp hook roots at the cwd's enrolled tree via resolveWorkingProjectDirectory; /audit and /verify PROJECT_DIR blocks prefer the cwd's enrolled git toplevel. Red/green proof: the worktree stamp test fails on the old rooting (`--ticket "WT0001" not found`), passes with the fix, and goes deny → stamp → allow through the real gate.
- 2026-10-05T00:14:30Z Reviewed: cross-agent (Codex) quality-review found 3 test-isolation/proof gaps in this diff, all fixed; 2 out-of-scope findings filed as #5373 and #5374.
- 2026-10-05T00:15:00Z Verified: CI green on 1f76bb3dc (lint, test node 22, test node 24); Cursor lifecycle fixtures refreshed.
