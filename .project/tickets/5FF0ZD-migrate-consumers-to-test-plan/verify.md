# Verify: 5FF0ZD — migrate consumers to test-plan

Pinned to branch `claude/safeword-product-audit-115lwo` (post security + CLI-resolution fixes).

## Verify Checklist

**Test Suite:** ✓ 3038/3038 tests pass (5 skipped) — full `bun run test` green
**Gherkin:** ✅ Acceptance lane passes (cucumber green; migrate-consumers feature incl.)
**Build:** ⏭️ Skipped — no build step at repo root
**Lint:** ✅ Clean (eslint + gherkin-lint + repo-wide typecheck)
**Scenarios:** All 11 scenarios marked complete
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** Q4FX8Y (siblings: BKTTZA done, 5FF0ZD this) — epic completes with this
**Reconcile:** ✅ impl-plan reconciled (status implemented); the `bash -c` child-shell refinement recorded

## Audit

- Architecture (depcruise): ✅ no dependency violations (148 modules).
- Dead code: ✅ none introduced (the migration deleted `nativeTestCommand`/`getJsTestCommands`/`pythonTestCommand`).
- Duplication: per-language test/build command knowledge now lives only in the resolver — the 2FVZ26 duplication is gone.
- Audit passed.

## Notes

Two post-implementation fixes from quality-review, both regression-tested:

- **Security (command injection):** `renderShellPlan` now single-quotes `cwd`; a maliciously-named directory can no longer inject via the eval'd `--format sh` script. Empirically reproduced and re-verified fixed.
- **CLI resolution:** `/verify` resolves a local test-plan-capable safeword (`node_modules/.bin/safeword` → dogfood source → bunx) instead of a bare `bunx safeword` that could hit the published CLI lacking `test-plan`.
