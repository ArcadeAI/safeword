---
id: 04HK04
slug: skill-log-cwd-fallback
type: task
phase: implement
status: in_progress
created: 2026-05-28T23:47:12.480Z
last_modified: 2026-05-29T19:37:00.000Z
scope:
  - Replace the `$(pwd)` fallback with `$(git rev-parse --show-toplevel 2>/dev/null || pwd)` in the `${CLAUDE_PROJECT_DIR:-…}` resolution used by `verify/SKILL.md` and `audit/SKILL.md` (both `.claude/skills/` and `packages/cli/templates/skills/` copies) — covers the log injection AND the audit-checks `cd`.
  - Update `tests/skill-invocation-log.test.ts` — assert skill forms use the git-root fallback (not bare `$(pwd)`), plus a behavioral regression that runs the expression from a subdir and asserts it resolves to the git root.
out_of_scope:
  - Command forms (`commands/verify.md`, `commands/audit.md`) use a bare `${CLAUDE_PROJECT_DIR}` (no fallback). Different failure mode (loud mkdir failure, not a silent stray dir) and legacy shims — left as a follow-up, not this ticket's proven bug.
  - Changing `CLAUDE_PROJECT_DIR` itself (harness concern) or the done-gate log-reading logic.
done_when:
  - No SKILL.md form contains a `${CLAUDE_PROJECT_DIR:-$(pwd)}` fallback; all use the git-root fallback.
  - The behavioral regression passes — the expression resolves to the repo root when run from `packages/cli` with `CLAUDE_PROJECT_DIR` unset.
  - template ↔ dogfood SKILL.md pairs in sync; full suite + lint green.
---

# Skill-log injection: fall back to git root when CLAUDE_PROJECT_DIR unset

**Goal:** Make the `[skill-invocation-log]` bash injection in `verify/SKILL.md` and `audit/SKILL.md` (both `.claude/skills/` and `packages/cli/templates/skills/` copies) write to the real project root even when `CLAUDE_PROJECT_DIR` is unset — by replacing the `$(pwd)` fallback with a git-root fallback, e.g. `PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"`.

**Why:** The injection already uses `${CLAUDE_PROJECT_DIR:-$(pwd)}`, but the harness doesn't always set `CLAUDE_PROJECT_DIR` (see `project_skill_env_fallback` learning). When it's unset and the shell is `cd`'d into a subdir (e.g. `packages/cli` after a build/lint step), `$(pwd)` writes the log to a stray `packages/cli/.safeword-project/skill-invocations.log`. That (a) hides the done-gate evidence from the root log and (b) trips the nested-config pre-commit guard, blocking commits. This recurred 3× while closing Y2HCNJ / 9P3VVH / 04NKDR (worked around by relocating the entry each time).

## Work Log

- 2026-05-28T23:47:12.480Z Started: Created ticket 04HK04
- 2026-05-29T19:37:00.000Z Re-validated on pickup (5JN5E4): bug present in all 4 SKILL.md forms; verified the git-root fallback resolves to repo root from `packages/cli` while `$(pwd)` resolves to the stray subdir. Found MORE than filed — an existing contract test (`skill-invocation-log.test.ts`) asserts the injection shape, and the injection also exists in command forms (bare `${CLAUDE_PROJECT_DIR}`, different/loud-fail variant → scoped out). Implemented: replace_all `$(pwd)`→git-root fallback in the 4 SKILL.md files (verify ×1, audit ×2 incl. the checks `cd`); updated the contract test + added a behavioral regression (19 tests green). Tight scope — proven silent-stray bug only.
