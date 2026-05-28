---
id: 04HK04
slug: skill-log-cwd-fallback
type: task
phase: intake
status: in_progress
created: 2026-05-28T23:47:12.480Z
last_modified: 2026-05-28T23:47:12.480Z
---

# Skill-log injection: fall back to git root when CLAUDE_PROJECT_DIR unset

**Goal:** Make the `[skill-invocation-log]` bash injection in `verify/SKILL.md` and `audit/SKILL.md` (both `.claude/skills/` and `packages/cli/templates/skills/` copies) write to the real project root even when `CLAUDE_PROJECT_DIR` is unset — by replacing the `$(pwd)` fallback with a git-root fallback, e.g. `PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"`.

**Why:** The injection already uses `${CLAUDE_PROJECT_DIR:-$(pwd)}`, but the harness doesn't always set `CLAUDE_PROJECT_DIR` (see `project_skill_env_fallback` learning). When it's unset and the shell is `cd`'d into a subdir (e.g. `packages/cli` after a build/lint step), `$(pwd)` writes the log to a stray `packages/cli/.safeword-project/skill-invocations.log`. That (a) hides the done-gate evidence from the root log and (b) trips the nested-config pre-commit guard, blocking commits. This recurred 3× while closing Y2HCNJ / 9P3VVH / 04NKDR (worked around by relocating the entry each time).

## Work Log

- 2026-05-28T23:47:12.480Z Started: Created ticket 04HK04
