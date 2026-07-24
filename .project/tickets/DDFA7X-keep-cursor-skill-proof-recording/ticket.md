---
id: DDFA7X
slug: keep-cursor-skill-proof-recording
type: task
phase: done
status: done
created: 2026-07-22T06:34:45.732Z
last_modified: 2026-07-24T03:22:18Z
---

# Keep Cursor quality proof recording reliable

**Type:** Bug

**Scope:** Ensure Cursor records current-session proof when an installed skill invokes the supported relative `record-skill-invocation.ts` helper path.

**Out of Scope:** Changing Codex's packaged hook parser, altering the session-proof trust model, or supporting arbitrary helper lookalike paths.

**Done When:**

- [x] Cursor binds its conversation id for the supported relative helper command and the helper records the expected session-bound proof.
- [x] Absolute helper commands and invalid/lookalike paths retain their current behavior.

**Tests:**

- [x] Integration: Cursor `beforeShellExecution` plus the supported relative helper records a `verify` and `audit` proof that satisfies the feature done gate.
- [x] Unit: the shared parser recognizes exact relative helper paths but rejects lookalike paths.

## Work Log

- 2026-07-22T06:34:45.732Z Started: Created ticket DDFA7X
- 2026-07-22T06:34:58Z Revalidated on current `origin/main` from an isolated worktree. A real Cursor `beforeShellExecution` payload for `bun .safeword/hooks/record-skill-invocation.ts <project> verify` returned allow, but the helper then reported `no run identity` and wrote no log. The otherwise identical absolute helper path recorded `cursor-absolute verify` successfully. Focused existing hook and fallback tests passed, so they do not cover this documented relative Cursor form.

## Root Cause

`parseRecordSkillInvocationCommand` in the shared Cursor bridge accepts only paths ending in `/.safeword/hooks/record-skill-invocation.ts`. The exact documented relative path starts with `.safeword/`, so the Cursor adapter never arms its short-lived identity cache before the helper executes.

Ruled out: a general Cursor bridge failure (the absolute form records the supplied conversation id); a helper/log-format failure (the absolute form creates the expected session-bound log); and a Codex production-path failure (the packaged Codex hook recognizes the relative form through its separate parser).

- 2026-07-22T10:08:00Z RED/GREEN: Added parser and real Cursor `beforeShellExecution` regression coverage. Both failed before the matcher change, then passed after accepting only the exact bare-relative path alongside the existing slash-anchored absolute form. Focused suite: 28 tests passed.
- 2026-07-22T10:13:00Z Quality review: independent reviewer approved the minimal matcher expansion, real adapter → helper → done-gate wiring test, and template/dogfood mirror. Corrected an imprecise "documented" description to "supported" in the ticket, tests, and GitHub issue #1337; no code change required.
- 2026-07-22T10:16:00Z Verification: focused regression suite (28 tests), release parity (25 tests), ESLint, Gherkin lint, TypeScript typecheck, and `git diff --check` passed. Full Vitest suite remained idle for three minutes with 0% CPU and was stopped; this is an environment runner limitation, not a product-test failure.
- 2026-07-24T03:22:18Z Complete: GitHub issue #1337 was closed automatically when PR #1343 merged. Both Node CI matrices and lint passed; user confirmed administrative closure.
