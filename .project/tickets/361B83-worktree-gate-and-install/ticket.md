---
id: 361B83
slug: worktree-gate-and-install
type: task
phase: done
status: done
created: 2026-10-06T16:24:11.247Z
last_modified: 2026-10-06T17:16:00.000Z
---

# Let worktree sessions install and run checks without false blocks

**Goal:** Gate dependency readiness on the worktree a command runs in, and let safeword install run in a git worktree nested under the main checkout (#5478, #5479, #5318)

**Why:** Every .claude/worktrees session got blocked by the main checkout's stale deps after its own install succeeded, and could not sync templates with safeword install.

## Work Log

- 2026-10-06T16:24:11.247Z Started: Created ticket 361B83
- 2026-10-06T16:40:00.000Z Found: pre- and post-tool dependency-readiness hooks rooted at CLAUDE_PROJECT_DIR, which the host keeps at the launch checkout inside a worktree. `findEnclosingProject` walked past the worktree's own `.git` file to the main checkout's `.safeword/`.
- 2026-10-06T16:40:00.000Z Decided: reuse `resolveToolProjectDirectory` (already used by the PR-readiness gate, #5361) for both dependency hooks so they gate and stamp the tree the shell runs in; stop the enclosing-project walk at a git checkout root (`.git` file or directory). Out of scope: stop-quality's done gate still roots everything at the launch checkout — a broader change.
- 2026-10-06T16:40:00.000Z Verified: 5 new tests RED → GREEN (dependency-readiness + nested-install suites 200/200); `safeword install` now runs in this nested worktree and synced only the two changed hooks; eslint, prettier, tsc clean; 5 generated surfaces current.
- 2026-10-06T17:15:59.493Z Phase: intake → done
