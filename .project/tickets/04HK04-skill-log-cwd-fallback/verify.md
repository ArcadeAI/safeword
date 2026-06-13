# 04HK04 — Verify (task)

Skill-log injection falls back to the git root (not `$(pwd)`) when
`CLAUDE_PROJECT_DIR` is unset. Verified via the `/verify` skill (invocation
logged this session).

## Verify Checklist

**Test Suite:** ✓ 2213/2213 tests pass (1 skipped; 131 files) — full `bun run test` on HEAD `65766192` (the +1 over the prior 2212 is the hardened regression; the earlier flaky failure is gone).
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + `tsc --noEmit`)
**Scenarios:** ⏭️ N/A — task (no test-definitions.md; scenario gate is feature-only)
**Dep Drift:** ✅ Clean — no dependencies added
**Parent Epic:** N/A — standalone (Y2HCNJ-verify follow-up)
**Audit:** Audit passed — see /audit run this session (no architecture violations, no new duplication, no dead code; the SKILL.md change is markdown).

## Production dogfood (the fix proves itself)

Invoked `/verify` for this ticket with the shell `cd`'d into `packages/cli` (a
subdir). The `verify` entry landed in the **repo-root** `.safeword-project/skill-invocations.log`
(`2026-05-29T20:11:57Z`), and **no stray `packages/cli/.safeword-project`** was
created. That exact subdir-cwd scenario created a stray dir 3× earlier this
session (before the fix); now it resolves to the git root.

## What changed

- `verify/SKILL.md` + `audit/SKILL.md` (template + dogfood, 4 files): the
  `${CLAUDE_PROJECT_DIR:-$(pwd)}` resolution → `${CLAUDE_PROJECT_DIR:-$(git
rev-parse --show-toplevel 2>/dev/null || pwd)}`, covering both the log
  injection and the audit-checks `cd`.
- `skill-invocation-log.test.ts`: contract assertions (skill forms use the
  git-root fallback, not bare `$(pwd)`) + a behavioral regression run in an
  isolated temp `git init` repo (deterministic, independent of the live repo's
  parallel-mutable git state).

Command forms (bare `${CLAUDE_PROJECT_DIR}`, loud-fail variant) scoped out.
`git rev-parse` degrades to `$(pwd)` on bare/worktree-env edge cases — strictly
no worse than before (quality-review APPROVE). Task — no scenarios/skill-log
required by the done gate.
