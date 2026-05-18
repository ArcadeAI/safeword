---
id: 151
type: task
phase: tdd
status: open
created: 2026-05-17T23:00:00Z
last_modified: 2026-05-17T23:00:00Z
scope:
  - Add PreToolUse Bash hook `pre-tool-git-bare-fix.sh` that resets `core.bare = false` before any `git *` command
  - Use config-level `if: "Bash(git *)"` filter so non-git Bash calls incur zero hook-process spawn
  - Ship via `packages/cli/templates/hooks/` + `packages/cli/templates/settings.json` so all safeword users benefit
  - Sync dogfooded copy into `.safeword/hooks/` and `.claude/settings.json`
  - Add release-gate test asserting hook resets a deliberately-flipped `core.bare`
out_of_scope:
  - Touching `.husky/pre-commit` — defense-in-depth retained for non-Claude commits
  - SessionStart hook variant (PreToolUse covers the actual observed in-session races; SessionStart adds zero coverage)
  - Filtering for `gh`/`bun` — no observed failures from those callers; will extend if/when seen
  - Fixing the upstream Claude Code bug itself (issue #58345 commented today with evidence)
done_when:
  - Hook resets `core.bare = false` when invoked with a git command on a parent whose config has `core.bare = true`
  - Hook is registered in templates settings.json and dogfooded in .claude/settings.json
  - Release-gate test passes (deliberately flips, runs hook, asserts reset)
  - Pair-parity holds: `.safeword/hooks/` matches `packages/cli/templates/hooks/`
---

# PreToolUse hook: reset core.bare before git commands

**Goal:** Defend ad-hoc git ops (status, mv, push) from Claude Code's parallel-worktree `core.bare = true` race, not just `git commit`.

**Why:** Surfaced repeatedly during ticket #147 — hit ~5 times in one session on non-commit git ops. The husky pre-commit reset (shipped v0.30.0) only fires inside `git commit`. Every `git status`, `git mv`, `git push`, `gh` shellout, IDE poll between commits hits the race unprotected. Filed upstream evidence on Claude Code issue [#58345](https://github.com/anthropics/claude-code/issues/58345); shipping this local hook for immediate relief.

## Design

- **Matcher**: `Bash` (per [Claude Code hooks docs](https://code.claude.com/docs/en/hooks), matcher = tool name only)
- **If**: `Bash(git *)` — permission-rule syntax, evaluated **before** hook process spawn, so zero overhead on non-git Bash calls
- **Hook script**: POSIX sh (`.sh`, not TS — avoid bun startup tax for a 2-line reset)
- **Body**: existing `.husky/pre-commit` reset logic, extracted

## References

- Upstream issue: anthropics/claude-code#58345 (commented today with three live reproductions)
- Ticket #141 (cancelled — was about _filing_ upstream, not local mitigation)
- Ticket #147 — surfaced this gap repeatedly during its execution
- Ticket #130 — original husky reset shipped here
