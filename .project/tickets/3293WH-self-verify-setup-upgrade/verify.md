# Verify — self-verify-setup-upgrade (3293WH)

## Verify Checklist

**Test Suite:** ✓ 2799/2799 tests pass (186 files, 1 skipped; full `bun run test`, exit 0)
**Build:** ✅ Success (`bun run build`, tsup + dts clean)
**Lint:** ✅ Clean (`eslint src tests && tsc --noEmit`, exit 0)
**Scenarios:** All 15 scenarios marked complete (45/45 R/G/R boxes checked)
**Dep Drift:** ✅ Clean — no new dependencies (extraction + one options param only)
**Parent Epic:** VKNF1T-platform-uplift-epic
**Reconcile:** ✅ No pattern deviation — reused the existing check-health core via extraction; no new pattern introduced

## Audit

- **Architecture:** no dependency violations (depcruise, 136 modules / 391 deps).
- **Dead code:** 0 introduced. `CheckHealthOptions` / `skipPackageChecks` are used by setup.ts + upgrade.ts. Knip's 2 unused exports (`MAX_CODE_LENGTH`, `MIN_NAME_LENGTH` in `personas.ts`) and the `eslint-plugin-*` package.json entries are pre-existing baseline noise, not this ticket.
- **Duplication:** 0 clones across the 4 changed files (jscpd). The extraction left `check.ts` at 148 lines delegating to `health.ts`; no health logic duplicated.
- **Test quality:** the added `skipped_install` test has specific assertions (exit 0, contains health line, no "Missing Packages"), fresh per-test temp dir, no timeouts, covers the deliberately-skipped-install edge case.

**Audit passed.**

## Done-when verification

- ✓ setup/upgrade with config-health issues report them and exit non-zero (broken-personas integration tests).
- ✓ clean setup/upgrade prints a single health success line, no update-check network call (fetch-spy seam test).
- ✓ post-upgrade failure output omits "run `safeword upgrade`" (context-aware repair hint).
- ✓ standalone `safeword check` behavior unchanged (existing check tests pass unmodified; `skipPackageChecks` defaults false).
- ✓ SAFEWORD.md pair + website cli.mdx present `check` as automatic-first (docs-demote test).
- ✓ (verify-phase addition) deliberately-skipped install no longer faults absent packages.

**Next:** Mark 3293WH done and start `add-time-version-guard (YTHG23)`.
