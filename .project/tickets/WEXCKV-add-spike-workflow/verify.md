# Verification: Add spike workflow

## Verify Checklist

**Test Suite:** ✓ 6120/6120 tests pass (5 skipped)
**Gherkin:** ✅ Acceptance lane passes (713 passed, 3 skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 46 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked the Safeword maintainer through the optional `/spike` flow; worst step = committing validated scenarios and ticket state before isolation; new steps vs before = 0 for routine features and 1 explicit choice for an eligible spike.
**Evidence limits:** ✅ None

Audit passed — diff-scoped architecture, config drift, changed tests, docs,
agent surfaces, and domain references are clean. Whole-repository Knip,
duplication, and dependency-freshness discovery were correctly outside this
feature-diff audit.

## Evidence

- Full Vitest: 404 files passed; 6,120 tests passed; 5 skipped.
- Full Cucumber: 716 scenarios; 713 passed and 3 skipped; 24,080 steps passed
  and 4 skipped.
- Spike feature: 28 scenarios and 960 steps passed.
- TypeScript typecheck: `tsc --noEmit` passed.
- Lint: `eslint .` passed.
- Audit scope: `origin/main` from merge base `eafe9d00ae4b2ee6e641d9a7f8dba4b6f3be0b8c`.
- Documentation sources checked: configured `README.md` and
  `packages/website/src/content/docs`; both expose `/spike` consistently.
- Canonical Claude spike template and dogfood copy are byte-identical; Codex
  generation and host-parity contracts passed.
