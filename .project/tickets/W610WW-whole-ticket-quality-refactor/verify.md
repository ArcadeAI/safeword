# Verify: Whole-ticket quality review + refactor before verify (W610WW)

Verified: 2026-06-20

## Verify Checklist

**Test Suite:** ✓ 3141/3141 tests pass (5 skipped, 210 files)
**Gherkin:** ✅ Acceptance lane passes (69/69; W610WW's 14 hook-gate scenarios tagged `@wip` — backed by vitest unit + integration, not the cucumber lane, per the gherkin-lane policy and formatter-aware-lint-hook precedent)
**Build:** ⏭️ Skipped — no build step (test-plan build kind is empty for root)
**Lint:** ✅ Clean (eslint + gherkin-lint + tsc)
**Scenarios:** All 14 scenarios marked complete (43/43 ledger checkboxes incl. the cross-scenario row)
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation (impl-plan reconciled; one documented known deviation — `/quality-review` requirement resolved at the call site rather than via a static `PHASE_GATES` entry, with an uplevel follow-up noted)

## Audit

Audit passed — 0 errors, 0 warnings.

- **Architecture:** ✅ no dependency violations (depcruise)
- **Dead code:** ✅ knip flagged none of the W610WW exports; `getRequiredSkillsForPhase` is now unused by the hook but still consumed by its test (kept, out of scope to remove)
- **Duplication:** ✅ 0 clones in the changed source (jscpd); the two hook copies are byte-identical by the parity design, not a clone smell
- **Test quality:** specific assertions, `it.each` parameterization, boundary + negative cases (single-loop exemption, exactly-2 boundary, legacy exemption, missing-review negatives)

## What shipped

The whole-ticket quality-review + refactor pass now fires at implement-exit for any ticket with ≥2 RGR loops — task or feature:

- **Loop-count gate** (`ledger-validation.ts`): the cross-scenario refactor row is required only at `scenarios.length >= 2` (annotated), or when a row already exists; single-loop and legacy tickets are exempt. New `countRgrLoops` derives the count from the same parse.
- **Fence drop + loop-aware skill gate** (`stop-quality.ts`, `skill-invocation-log.ts`): ledger validation runs for any build ticket with a `test-definitions.md` (the `isFeature` fence is gone); `requiredSkillsForDone` adds `/quality-review` at the done gate for ≥2-loop tickets while keeping single-loop tasks free of any requirement.
- **Docs**: `/quality-review` carries its invocation-log line; the step moved into `bdd/TDD.md` implement-exit; `bdd/VERIFY.md` and both test-definitions templates updated.

Dogfooded on itself: this 14-loop ticket ran its own whole-ticket `/quality-review` (logged), which surfaced doc drift + two coverage gaps (fixed in the cross-scenario commit), and is gated by the very rule it ships.
