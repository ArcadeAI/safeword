---
id: JNVP4W
slug: worktree-auto-deps
type: task
phase: intake
status: in_progress
created: 2026-06-06T18:13:21.754Z
last_modified: 2026-06-06T18:13:21.754Z
---

# Auto-install deps in fresh worktrees via SessionStart hook

**Goal:** A freshly created git worktree auto-installs its dependencies on session start, so commits (and tests/lint) work immediately instead of failing at the pre-commit hook with "node_modules not installed."

**Why:** git worktrees don't share `node_modules`. Claude Code creates worktrees under `.claude/worktrees/<name>` with none installed, so the husky pre-commit guard (correctly) blocks every commit — even docs-only — until someone manually runs `bun install`. This recurs for every new worktree and interrupts flow. Hit 2026-06-06 while committing the 0AWSY8 replan.

**Decision (`/figure-it-out`, 2026-06-06):** a **SessionStart hook** that runs `bun install --frozen-lockfile` when the worktree has no `node_modules`; keep the existing pre-commit guard as the safety net.

- Strictly additive — safeword already chains SessionStart hooks; `session-bun-check.sh` is the precedent for a bash SessionStart guard.
- Covers the subagent / `isolation: "worktree"` case, which `WorktreeCreate` does not.
- Cheap — warm-cache `bun install` is ~5s and offline (Bun clonefiles/hardlinks from its global cache); verified this session (5.03s, no lockfile change).
- `--frozen-lockfile` so the automated install matches the branch's committed `bun.lock` and never silently rewrites it.

**Rejected:**

- `WorktreeCreate` hook — replaces git's worktree creation (must reimplement `git worktree add`, baseRef, `.worktreeinclude`, emit path on stdout) and misses subagent-created worktrees ([anthropics/claude-code#27744](https://github.com/anthropics/claude-code/issues/27744) requests a proper post-create hook; doesn't exist yet).
- Symlink / share `node_modules` — anti-pattern for Bun workspaces (broken `.bin` shims, Vite/Vitest resolution follows symlinks, lost branch isolation). Bun already shares at the cache level.
- Pre-commit auto-install — commit-time is latency-sensitive; mutating `node_modules` mid-commit invites partial state. The existing fail-with-message guard stays.

## Scope

- New SessionStart hook (bash, alongside `.safeword/hooks/session-bun-check.sh`): if `node_modules` is absent in the project root, run `bun install --frozen-lockfile`; route output to stderr/tty so it doesn't corrupt hook stdout, and don't hard-block session init.
- Register it in the `.claude/settings.json` SessionStart chain **and** the `templates/` copy (hook tests run against `templates/`; sync after — see `feedback_template_sync`).
- Degrade gracefully: if the install fails (e.g., no network, cold cache), print the actionable "run `bun install`" message rather than dying silently.

## Out of scope

- The pre-commit guard — already shipped (ticket 9P3VVH); keep as-is (defense-in-depth).
- A full `WorktreeCreate` VCS adapter and broader per-worktree env setup (env files, etc.) — separate if ever needed.
- Non-bun projects.

## Done when

- Creating a fresh worktree and starting a session leaves `node_modules` installed with no manual step — verified by a clean `git commit` of a trivial change that does **not** hit the "node_modules not installed" failure.
- The hook is a fast no-op when `node_modules` already exists.
- Hook lands in both the live hooks dir and `templates/`, with tests green.

## Work Log

- 2026-06-06T18:13:21.754Z Started: Created ticket JNVP4W
- 2026-06-06T18:14:00.000Z Drafted: Goal/Why/Scope/Done-when + /figure-it-out decision (SessionStart auto-install, --frozen-lockfile) and rejected alternatives. Sourced from the 0AWSY8 replan session where the block was hit.
