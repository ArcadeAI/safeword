# Verify: XDNSZA — Impl plan as first-class artifact

Date: 2026-06-10

## Verify Checklist

**Test Suite:** ✓ 2586/2586 tests pass (163 files; 1 pre-existing skip)
**Build:** ✅ Success (tsup + dts clean)
**Lint:** ✅ Clean (eslint + tsc --noEmit)
**Scenarios:** All 20 scenarios marked complete (R/G/R annotated; cross-scenario row skip-annotated with reason)
**Dep Drift:** ✅ Clean (no new dependencies introduced)
**Parent Epic:** M6D315 (siblings: 0/3 remaining done — XDNSZA is the first child built; K4BWTQ, ERVA6V, CNGBNT follow; VYRKBJ cancelled/folded in)
**Reconcile:** ✅ No pattern deviation (parser mirrors jtbd.ts cross-runtime-copy idiom; gate mirrors checkCumulativeArtifacts; template follows spec-template HTML-comment idiom)

Audit passed — depcruise 0 errors (2 pre-existing cucumber.mjs orphan warnings from the 102 lane), knip findings limited to the known hook-template false-positive baseline (`templates/hooks/**` not in knip's src graph) plus pre-existing unused-dep noise, learning files all carry `Covers:`, sync-config in sync.

## What shipped

- `packages/cli/templates/hooks/lib/impl-plan.ts` (+ dogfood copy) — pure parser: `**Status:** planned|implemented` lifecycle, five-section content-or-skip validation with named-section errors, HTML-comment stripping, uniform non-empty skip-reason rule (VYRKBJ folded in).
- `packages/cli/templates/hooks/stop-quality.ts` (+ dogfood copy) — `checkImplPlanArtifact`: hard-blocks new-flow features (spec.md present) at implement/done without a valid impl-plan.md; tasks, grandfathered tickets, and pre-implement phases exempt.
- `packages/cli/templates/doc-templates/impl-plan-template.md` (+ `.safeword/templates/` copy, schema-registered) — scaffold with guidance comments that parse as unfilled.
- `bdd/SCENARIOS.md` scenario-gate exit step 3 rewritten to author impl-plan.md (test layers + sequencing land in Approach); `bdd/TDD.md` entry follows the plan — both canonical and dogfood copies.
- Tests: 13 parser unit tests (tests/hooks/impl-plan.test.ts), 7 gate integration tests (tests/integration/impl-plan-gate.test.ts), doc-presence + template-scaffold guards.

## Done-when reconciliation

- Template exists and scaffolds cleanly; skip convention documented inline — ✅
- Hook blocks stop for features at implement/done without valid impl-plan.md; grandfathered exempt — ✅ (7 integration tests)
- SCENARIOS.md exit + TDD.md entry reference impl-plan.md; dogfood in sync — ✅ (doc-presence test over both copies)
- Tests cover parser (status, sections, skip variants) and gate (missing file, missing section, bare skip, whitespace reason, grandfathered) — ✅
