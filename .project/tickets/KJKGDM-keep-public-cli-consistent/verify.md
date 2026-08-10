# Verification — Keep every public CLI command consistent for users and agents

## Verify Checklist

**Test Suite:** ✓ 7,283/7,283 tests pass (6 intentionally skipped); post-merge focused suite 104/104
**Gherkin:** ✅ The post-merge lane passed 1,349 scenarios with 3 intentional skips before the temp volume filled; all 10 ENOSPC-affected scenarios then passed 10/10 (425/425 steps) after removing disposable test fixtures
**Build:** ✅ Success for CLI and retro-relay packages
**Lint:** ✅ ESLint, Gherkin lint, formatting, and whitespace checks are clean
**Scenarios:** All 5 scenarios marked complete
**PR Scope:** ✅ Diff matches GitHub issue #2251 and retains every compatibility alias
**Dep Drift:** ✅ Clean; dependency-cruiser reports no diff-scoped violations, and the one full-tree orphan warning is pre-existing
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation; public commands use the existing typed catalog, policy, handler, and renderer boundaries
**Experience:** ✅ Help, capabilities, JSON recovery, quiet/offline behavior, alias rejection, and canonical docs tell one coherent story
**Surface Evidence:** ✅ 3/3 affected surfaces have recorded proof: human help/docs, machine JSON/capabilities, and retained alias parsing
**Evidence limits:** ✅ None

Audit passed — the final diff has no actionable correctness, security, test-quality, documentation, or maintainability findings.

## Evidence

- Full package tests after merging current `main`: retro-relay 167 passed / 1 skipped; CLI 7,116 passed / 5 skipped across 471 files.
- Acceptance coverage: the post-merge full lane passed 1,349 scenarios before the macOS temp volume reached ENOSPC; the 10 affected scenario names then passed 10/10 (425/425 steps) after 2,950 disposable Safe Word test directories were removed and 8 GiB was reclaimed. GitHub CI remains the clean-volume single-run acceptance gate.
- Merge verification: 104 focused catalog, wiring, documentation, help, machine-contract, renderer, convergence, CLI, plan/remove, and Claude profile tests passed on current `origin/main`.
- Static gates: build, typecheck, ESLint, Gherkin lint, dependency-cruiser, `bun audit`, generated Claude plugin contract at 0.74.4, and `git diff --check` passed.
- Experience walkthrough: help → capabilities → JSON relay recovery → retained alias help/rejection. The only deliberate friction is `retro-relay-discard --confirm`, which preserves irreversible-action safety; no new normal-flow step was added.
