---
id: ZXAC2Q
slug: codex-cursor-worktree-ready
type: task
phase: intake
status: in_progress
created: 2026-10-05T06:28:17.604Z
last_modified: 2026-10-05T06:28:17.604Z
---

# Let Codex and Cursor worktree sessions mark a finished PR ready

**Goal:** In a Codex or Cursor session working in a worktree, the Ready guard and readiness receipt use that worktree, as #5382 made them do for Claude Code.

**Why:** The Codex and Cursor adapters drop the host's cwd, so the shared hooks fall back to the launch checkout and refuse gh pr ready (#5392).

## Work Log

- 2026-10-05T06:28:17.604Z Started: Created ticket ZXAC2Q
