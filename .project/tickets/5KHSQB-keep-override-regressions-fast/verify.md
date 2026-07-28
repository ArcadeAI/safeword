# Verify: Keep override regressions fast (5KHSQB)

_Final verification after the full audit, quality-review, and refactor passes,
including their suggested hardening and a clean merge of current `origin/main`._

## Verify Checklist

**Test Suite:** ✓ 5503/5503 runnable tests pass (5 skipped; 371 files).
The focused override-survival suite remains 10/10 green.
**Gherkin:** ✅ Acceptance lane passes — 497 scenarios (494 passed, 3 skipped)
and 15317 steps (15313 passed, 4 skipped).
**Build:** ✅ Success — tsup ESM and DTS builds completed successfully.
**Lint:** ✅ Clean — ESLint, Gherkin lint, formatting hooks, and
`tsc --noEmit` pass.
**Scenarios:** All 4 test-definition checklist rows marked complete.
**PR Scope:** ✅ Diff matches ticket scope: test helpers, focused contracts,
the override-survival integration suite, and ticket artifacts only.
**Dep Drift:** ✅ Clean — no dependency changes; dependency-cruiser has
0 errors. Its single `no-orphans` warning is on the pre-existing
`packages/cli/src/codex-plugin/hooks.ts`, outside this PR's diff.
**Parent Epic:** N/A.
**Reconcile:** ✅ No project-pattern deviation. The real CLI, reconciliation,
generated hooks, ESLint, and Ruff remain wired through the integration suite;
only subprocess-result boundaries are injected in contract tests.
**Experience:** ⏭️ N/A — this is internal test-harness work, not persona-facing.
**Evidence limits:** ✅ None.

**Audit:** Audit passed. Full lint, dependency validation, Knip, dependency
freshness, documentation checks, and duplication review completed. The one
scoped clone is an older repeated Python fixture block, not introduced here.

**Quality review:** APPROVE with no remaining actionable issues. Both
false-green paths are closed: failed upgrades throw, and Bun/Ruff
infrastructure warnings fail the suite. ESLint and Prettier are preflighted
before linking the repository toolchain.

**Refactor:** Full pass completed. Helper intent is explicit, fixture-upgrade
contracts are isolated, repeated TypeScript fixture setup is centralized, hook
result branches have direct coverage, and the stale scenario-document link is
repaired.
