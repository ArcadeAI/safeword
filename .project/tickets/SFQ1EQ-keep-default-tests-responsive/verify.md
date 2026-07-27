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

## Final audit and refactor evidence

Audit passed on 2026-07-27: dependency-cruiser found no violations; Knip and Go
dead-code checks were clean; config drift checks were in sync. Repository
duplication remained within the intentional template/generated baseline.
Optional Python import-cycle, dead-code, and outdated-dependency checks were
unavailable in this environment. The only outdated JavaScript dependency was
the unrelated `markdownlint-cli2` 0.23.1 → 0.23.2 patch, deferred from this PR.

Refactor ledger:

- Applied: isolated the physical install proof in
  `non-git-install-proof.slow.test.ts` and selected it by file instead of mutable
  test-title text.
- Applied: made every changed slow install case explicitly opt into dependency
  installation with `INSTALL_DEPENDENCIES_ENV`.
- Applied: replaced the stale 10-minute install timeout in the config-only
  invisible-extension suite with the shared two-minute setup timeout.
- Applied: replaced regex source inspection with TypeScript import/call analysis
  that resolves direct, aliased, and namespace helper calls; adversarial
  alias/namespace coverage passes.
- Rejected by test evidence: moving the four framework-detection cases into the
  no-install default lane changed their behavior and failed three assertions, so
  they remain in the install-backed slow lane.
- Deferred: making no-install behavior global in the default Vitest config needs
  a separate audit of intentional install-backed default tests.

Post-refactor verification:

- Full Vitest: 374 files passed; 5556 tests passed and 5 skipped.
- BDD: 505 scenarios passed and 3 skipped.
- Focused boundary test: 9/9 passed, including alias and namespace bypass cases.
- Focused physical install proof: 1/1 passed.
- ESLint, Gherkin lint, TypeScript typecheck, Prettier, and CLI build passed.
