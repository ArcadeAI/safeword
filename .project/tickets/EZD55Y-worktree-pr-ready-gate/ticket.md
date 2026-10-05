---
id: EZD55Y
slug: worktree-pr-ready-gate
type: patch
phase: done
status: done
created: 2026-10-05T03:40:49.058Z
last_modified: 2026-10-05T03:40:49.058Z
---

# Let sessions in a worktree mark their verified PR ready

**Goal:** gh pr ready from a session inside .claude/worktrees/<name> is judged against that worktree's ticket, state, and readiness receipt

**Why:** CLAUDE_PROJECT_DIR stays at the launch checkout, so a done, verified worktree ticket was denied with 'Repair ticket <ID>' (PR #5376)

## Work Log

- 2026-10-05T03:40:49.058Z Started: Created ticket EZD55Y
- 2026-10-05T03:41:51.653Z Phase: intake → done
