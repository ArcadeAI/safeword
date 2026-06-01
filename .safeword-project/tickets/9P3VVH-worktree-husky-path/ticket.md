---
id: 9P3VVH
slug: worktree-husky-path
type: patch
phase: done
status: done
created: 2026-05-28T18:03:05.546Z
last_modified: 2026-05-28T18:12:00.000Z
---

# Worktree-robust .husky/pre-commit PATH

**Goal:** Make this repo's `.husky/pre-commit` resolve `lint-staged` when committing from inside a git worktree. Shipped fix: invoke `node_modules/.bin/lint-staged` by the explicit relative path the hook's own guard already validates — not a `PATH` prepend (the figure-it-out winner over `export PATH=…` and `bunx`, which add coupling/network).

**Why:** In a worktree, husky's expected `node_modules/.bin` PATH-prepend doesn't happen, so `lint-staged` isn't found and every commit fails until you manually prefix `PATH=...`. This bit every commit across the Y2HCNJ sessions. Repo-infra fix (safeword does not ship husky to customers); see `.agents/.../project_worktree_setup.md` learning.

## Work Log

- 2026-05-28T18:03:05.546Z Started: Created ticket 9P3VVH
- 2026-05-28T18:12:00.000Z Done: Verified root cause — husky `_/h` prepends a _relative_ `node_modules/.bin` to PATH; with `core.hooksPath=.husky/_` in the main repo's config, that entry doesn't resolve bare `lint-staged` when committing from the worktree (binary exists on disk; needed a manual PATH prefix every commit). `/figure-it-out` chose Option A (call `node_modules/.bin/lint-staged` by the same explicit path the line-35 guard validates) over Option B (`export PATH="$PWD/…"`, duplicates husky logic + `$PWD` coupling) and Option C (`bunx`, auto-installs from npm on miss → undermines the fresh-clone guard). Fix in `.husky/pre-commit` (commit 4112dce4). Self-validating: that commit was created **without** the manual PATH workaround and the hook resolved lint-staged unaided (`→ lint-staged could not find any staged files…`). The `PATH="$PWD/node_modules/.bin:$PATH"` workaround is now obsolete for this repo's worktrees.
