---
id: JNVP4W
slug: worktree-auto-deps
type: task
phase: intake
status: backlog
created: 2026-06-06T18:13:21.754Z
last_modified: 2026-06-06T18:13:21.754Z
---

# Auto-install deps in fresh worktrees via SessionStart hook

**Goal:** A freshly created git worktree auto-installs its dependencies on session start, so commits (and tests/lint) work immediately instead of failing at the pre-commit guard with "node_modules not installed."

**Why:** git worktrees don't share `node_modules`. Claude Code creates worktrees under `.claude/worktrees/<name>` with none installed, so the husky pre-commit guard (correctly) blocks every commit — even docs-only — until someone manually runs `bun install`. This recurs for every new worktree and interrupts flow. Hit 2026-06-06 while committing the 0AWSY8 replan.

**Decision (`/figure-it-out` 2026-06-06; corrected after quality-review):** a **SessionStart hook** that runs `bun install --frozen-lockfile` when the worktree has no `node_modules`; keep the existing pre-commit guard as the safety net.

- Strictly additive — safeword already chains SessionStart hooks; `session-bun-check.sh` is the precedent for a bash SessionStart guard.
- Runs after the worktree already exists and reuses the existing chain, without reimplementing git's worktree creation (the `WorktreeCreate` alternative would — see Rejected).
- **Blocking, not async** — SessionStart blocks session init, so run synchronously and order this hook **early** (right after `session-bun-check.sh`). That guarantees `node_modules` exists before the rest of the chain (`auto-upgrade`, `lint-check`) and before the first commit — the whole point. Async would start instantly but race those; the degrade branch bounds the worst case so blocking can't wedge startup.
- Cheap — `bun install` is ~5s from a warm cache and offline _from that cache_ (Bun clonefiles/hardlinks from `~/.bun/install/cache`; a cache miss still hits the network); verified this session (5.03s, no lockfile change).
- `--frozen-lockfile` so the install matches the branch's committed `bun.lock` and never silently rewrites it.

**Rejected:**

- `WorktreeCreate` hook — it _does_ fire for `--worktree` and `isolation: "worktree"` (the earlier "misses subagents" reason was wrong), but it **replaces** `git worktree add` (a VCS adapter: you reimplement creation + baseRef + emit the worktree path on stdout) and **drops `.worktreeinclude` processing**. Wrong tool for post-setup. [anthropics/claude-code#27744](https://github.com/anthropics/claude-code/issues/27744) (open) requests a real post-create hook; until it lands, SessionStart is the additive choice.
- Symlink / share `node_modules` — anti-pattern for Bun workspaces (broken `.bin` shims, Vite/Vitest resolution follows symlinks, lost branch isolation). Bun already shares at the cache level.
- Pre-commit auto-install — commit-time is latency-sensitive; mutating `node_modules` mid-commit invites partial state. The existing fail-with-message guard stays.

## Scope

- New SessionStart hook (bash, alongside `.safeword/hooks/session-bun-check.sh`): gate on `[ ! -d "${CLAUDE_PROJECT_DIR:-$(pwd)}/node_modules" ]` (match `session-bun-check.sh` — the harness doesn't always set the env var), then run `bun install --frozen-lockfile`; route output to stderr/tty so it doesn't corrupt hook stdout. Synchronous (SessionStart blocks init — deliberate) and ordered early in the chain.
- Register it in the `.claude/settings.json` SessionStart chain **and** the `templates/` copy (hook tests run against `templates/`; sync after — see `feedback_template_sync`).
- Degrade gracefully: on any install failure (no network, cold cache, or a `package.json`/lockfile mismatch), print the actionable "run `bun install`" message and **exit 0** — never `exit 2` — so a failed install can't wedge session start.

## Out of scope

- The pre-commit guard — already shipped (ticket 9P3VVH); keep as-is (defense-in-depth).
- A full `WorktreeCreate` VCS adapter and broader per-worktree env setup (env files, etc.) — separate if ever needed.
- Non-bun projects.

## Done when

- Creating a fresh worktree and starting a session leaves `node_modules` installed with no manual step — verified by a clean `git commit` of a trivial change that does **not** hit the "node_modules not installed" failure.
- The hook is a fast no-op when `node_modules` already exists.
- A failed install prints the actionable message and exits 0 (the session still starts).
- Hook lands in both the live hooks dir and `templates/`, with tests green.

## Work Log

- 2026-06-06T18:13:21.754Z Started: Created ticket JNVP4W
- 2026-06-06T18:14:00.000Z Drafted: Goal/Why/Scope/Done-when + /figure-it-out decision (SessionStart auto-install, --frozen-lockfile) and rejected alternatives. Sourced from the 0AWSY8 replan session where the block was hit.
- 2026-06-06T22:55:00.000Z Corrected (quality-review + /figure-it-out): fixed the WorktreeCreate rationale — it DOES fire for isolation:"worktree"; real reasons to reject are VCS-adapter/replaces-git + drops .worktreeinclude (#27744 open). Recorded the blocking-not-async decision (SessionStart blocks init; order early so the chain + first commit see node_modules), degrade-exits-0, and the CLAUDE_PROJECT_DIR gate. Softened "offline" → "offline from a warm cache." Still build-deferred.
- 2026-06-10T20:18:00.000Z Status → backlog (was in_progress since filing): build stays deferred; in_progress was polluting active-ticket detection for the whole Phase-1 session. Plan is converged — pick up from the figure-it-out decisions above.
