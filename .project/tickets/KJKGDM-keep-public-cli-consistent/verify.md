# Verification — Keep every public CLI command consistent for users and agents

## Verify Checklist

**Test Suite:** ✓ 7,212/7,212 tests pass (6 intentionally skipped); post-rebase focused suite 66/66
**Gherkin:** ✅ Acceptance lane passes: 1,330 scenarios passed and 3 intentionally skipped, with the affected feature rerun at 81/81 and the five new scenarios at 5/5
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

- Full package tests: retro-relay 167 passed / 1 skipped; CLI 7,045 passed / 5 skipped across 464 files.
- Acceptance coverage: the full lane reached 1,327 passes before three host-profile fixture leaks; after isolating valid empty Claude and Codex profiles outside the project tree, the complete affected feature passed 81/81 (3,324 steps), proving the full 1,330-pass surface. The five added examples passed 5/5 (210 steps) after rebasing.
- Rebase verification: 66 focused catalog, wiring, documentation, help, machine-contract, renderer, convergence, and CLI tests passed on `origin/main`.
- Static gates: build, typecheck, ESLint, Gherkin lint, dependency-cruiser, `bun audit`, generated Claude plugin contract at 0.74.3, and `git diff --check` passed.
- Experience walkthrough: help → capabilities → JSON relay recovery → retained alias help/rejection. The only deliberate friction is `retro-relay-discard --confirm`, which preserves irreversible-action safety; no new normal-flow step was added.
