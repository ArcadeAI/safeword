# Verification: Keep default tests responsive

Verified on 2026-07-27 after merging current `origin/main` into PR #1470.

## Verify Checklist

**Test Suite:** ✓ 5556/5556 tests pass (5 skipped)
**Gherkin:** ✅ Acceptance lane passes (505 scenarios passed, 3 skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 25 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** S3T6JA (siblings: 2/7 done)
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal test-harness change
**Evidence limits:** ✅ None

## Focused evidence

- `tests/setup-or-throw.test.ts`, `tests/default-test-install-boundary.test.ts`,
  and `tests/integration/invisible-extension.test.ts`: 26/26 passed.
- `test:slow:install-proof`: 1/1 selected test passed in 6.59s.
- With `SAFEWORD_SKIP_INSTALL=1`, the same proof failed at the missing physical
  ESLint package artifact, confirming the proof detects disabled installation.
- Independent quality review: APPROVE; critical issues: none.
- Official Vitest configuration documentation confirms that `include` and
  `exclude` globs define lane membership relative to the configured root.
