---
id: G45291
slug: refactor-v1-release-candidate-work
type: task
phase: intake
status: in_progress
created: 2026-09-24T11:43:32.632Z
last_modified: 2026-09-24T11:43:32.632Z
---

# Keep v1 release changes easy to maintain

**Goal:** Refactor authored code changed since v1.0.0-rc.1 without changing behavior.

**Why:** The release candidate added several large modules and new generation paths that warrant a focused maintainability pass.

## Work Log

- 2026-09-24T11:43:32.632Z Started: Created ticket G45291
- 2026-09-24T11:45:00.000Z Scoped: Compared v1.0.0-rc.1 with HEAD (13 commits, 253 changed paths); generated mirrors and test fixtures are excluded from refactoring targets.

## Refactor ledger

- [ ] Deferred: checklist row parsing in `packages/cli/src/review/job.ts`. A single-pass rewrite hit the complexity lint rule; reverted it. The two scans have subtly different escape handling, so a larger extraction is not justified by current evidence.
- [x] Reuse ablation response verdicts in `packages/cli/scripts/lib/data-architecture-eval.ts` instead of evaluating the same rubric repeatedly. Verified: 81 evaluation tests pass.
- [x] Audited the RC1 diff: 41 authored source files, no dependency boundary violations. Knip highlighted unused exports in changed internal modules; reviewed references before narrowing them.
- [x] Reuse guide-path discovery across Claude, Codex, and OpenCode delivery checks. Verified: 20 delivery tests pass.
- [x] Keep evaluation helper types/functions and the rubric runner module-private. Verified: 83 evaluation and 17 generator tests pass.

## Verification

- Focused suites passed after each refactor; pre-commit lint and template parity checks passed for each commit.
- Full suite: 9,915 passed, 13 skipped, 8 failed. Six failures came from child processes resolving Bun 1.4.0 instead of the pinned 1.3.14; pinning Bun first on PATH removed those. Two remaining failures reproduce in isolation: BDD proof discovery includes existing `.claude/worktrees/**` copies, and the Codex plugin artifact scan reads a directory as a file. Neither path was changed by this refactor.
- Final code audit: 0 dependency boundary violations across 583 modules and 1,105 dependencies.
- No generated mirrors changed.
