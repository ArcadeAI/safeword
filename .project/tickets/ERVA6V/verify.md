# Verify: ERVA6V — Plan-vs-actual reconciliation at implement exit

Date: 2026-06-12

## Verify Checklist

**Test Suite:** ✓ 2607/2607 tests pass (166 files; 1 pre-existing skip)
**Build:** ✅ Success (tsup + dts clean)
**Lint:** ✅ Clean (eslint + tsc --noEmit)
**Scenarios:** All 8 scenarios marked complete (R/G/R annotated; cross-scenario row skip-annotated with reason)
**Dep Drift:** ✅ Clean (no new dependencies)
**Parent Epic:** M6D315 (siblings: 2/4 done before this — XDNSZA ✓, K4BWTQ ✓; CNGBNT remains)
**Reconcile:** ✅ No pattern deviation (status gate extends the existing checkImplPlanArtifact; docs follow the established TDD.md step shape; own impl plan reconciled — 0 decisions changed, 0 deviations)

Audit passed — config in sync, depcruise clean of new violations, knip counts identical to the pre-existing baseline (no new exports), learnings conform.

## What shipped

- `packages/cli/templates/hooks/stop-quality.ts` (+ dogfood copy) — `checkImplPlanArtifact` extended: existence/validity now fires at implement/verify/done (the verify cell was unpinned new behavior, caught by gate review F1); from verify onward the plan's status must be `implemented`, with a block message naming the reconciliation step.
- `bdd/TDD.md` (canonical + dogfood) — "Implement exit: reconcile the plan": 4-step walk (Decisions / Arch alignment → Known deviations / Assessment triggers / status flip + work-log line) and a worked example showing a decision that changed mid-implementation. Doc-presence test over both copies.
- 7 gate integration tests (RSG001-007 in impl-plan-gate.test.ts, reusing XDNSZA's fixtures) + 2 doc-presence tests.
- Dogfooded by both K4BWTQ (manually, pre-hook) and ERVA6V itself (hook-enforced this time).

## Done-when reconciliation

- TDD.md documents the 4-step reconciliation at implement exit in both copies (doc-presence tested) — ✅
- Stop hook blocks new-flow features at verify/done while status is planned; implemented passes; grandfathered/tasks exempt — ✅
- Worked example shows a reconciled decision (planned choice changed mid-implementation) — ✅
