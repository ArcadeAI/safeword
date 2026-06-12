# Verify: CNGBNT — Harness availability check with graceful degradation

Date: 2026-06-12

## Verify Checklist

**Test Suite:** ✓ 2609/2609 tests pass (167 files; 1 pre-existing skip)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + tsc --noEmit; markdownlint clean after MD001 heading fix)
**Scenarios:** ⏭️ Skipped — task-type ticket (rescoped from feature at the 2026-06-10 epic replan); single TDD cycle RED d3323bcd → GREEN 9f6d552f
**Dep Drift:** ✅ Clean (docs-only change)
**Parent Epic:** M6D315 (siblings: 3/3 other buildable children done — this closes the set)
**Reconcile:** ✅ No pattern deviation (doc section follows TDD.md's established step shape; doc-presence test mirrors siblings)

Audit passed — config in sync, depcruise unchanged, zero knip findings on the change, learnings conform. Quality review (web research) validated the degraded-path guidance against legacy-code TDD practice and added one grounded enrichment: characterization tests named as the canonical first move for untested code (f503157f).

## What shipped

- `bdd/TDD.md` (canonical + dogfood) — "Harness availability check (entry)": judge harness presence from existing signals (no config fields, per the replan's YAGNI cut); present → standard loop; absent → degrade to the service's existing test patterns (characterization tests for legacy code) with the same R/G/R discipline, work-log annotation (`Harness absent; using existing service test patterns…`), and a prompted (not auto-created) follow-up ticket. No gate blocks on absence — degradation is the intended path.
- Doc-presence test over both copies (tests/hooks/harness-degradation-documentation.test.ts).

## Done-when reconciliation (against the rescoped task)

- TDD.md documents both branches with the degraded-path copy — ✅
- Work-log annotation + follow-up recommendation documented — ✅
- Dropped by replan (recorded in ticket): `harnessCheck`/`harnessPath` config fields, per-language probe machinery, hook-side detection — superseded by 102b's universal lane scaffolding.
