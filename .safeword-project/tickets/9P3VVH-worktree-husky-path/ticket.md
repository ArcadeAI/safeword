---
id: 9P3VVH
slug: worktree-husky-path
type: patch
phase: intake
status: in_progress
created: 2026-05-28T18:03:05.546Z
last_modified: 2026-05-28T18:03:05.546Z
---

# Worktree-robust .husky/pre-commit PATH

**Goal:** Make this repo's `.husky/pre-commit` prepend `node_modules/.bin` to `PATH` (e.g. `PATH="$PWD/node_modules/.bin:$PATH"`) so the bare `lint-staged` call resolves when committing from inside a git worktree.

**Why:** In a worktree, husky's expected `node_modules/.bin` PATH-prepend doesn't happen, so `lint-staged` isn't found and every commit fails until you manually prefix `PATH=...`. This bit every commit across the Y2HCNJ sessions. Repo-infra fix (safeword does not ship husky to customers); see `.agents/.../project_worktree_setup.md` learning.

## Work Log

- 2026-05-28T18:03:05.546Z Started: Created ticket 9P3VVH
