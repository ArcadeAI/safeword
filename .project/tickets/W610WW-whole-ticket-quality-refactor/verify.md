# Verify: Whole-ticket quality review + refactor before verify (W610WW)

Verified: 2026-06-20 (re-verified after the S1 unified-trigger fix)

## Verify Checklist

**Test Suite:** ✓ 3161/3161 tests pass (5 skipped, 210 files)
**Gherkin:** ✅ Acceptance lane passes (69/69; W610WW's 15 hook-gate scenarios tagged `@wip` — backed by vitest unit + integration, not the cucumber lane, per the gherkin-lane policy 7ES3GW)
**Build:** ⏭️ Skipped — no build step (test-plan build kind is empty for root)
**Lint:** ✅ Clean (eslint + gherkin-lint + tsc)
**Scenarios:** All 15 scenarios marked complete (46/46 ledger checkboxes incl. the cross-scenario row)
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation (impl-plan reconciled; one documented known deviation — `/quality-review` requirement resolved at the call site rather than via a static `PHASE_GATES` entry, with an uplevel follow-up noted)

## Audit

Audit passed — 0 errors, 0 warnings.

- **Architecture:** ✅ no dependency violations (depcruise)
- **Dead code:** ✅ knip flagged none of the W610WW exports; `getRequiredSkillsForPhase` is now unused by the hook but still consumed by its test (kept, out of scope to remove)
- **Duplication:** ✅ 0 clones in the changed source (jscpd); the two hook copies are byte-identical by the parity design, not a clone smell
- **Test quality:** specific assertions, `it.each` parameterization, boundary + negative cases (single-loop exemption, exactly-2 boundary, legacy exemption on BOTH halves, missing-review negatives)

## What shipped

The whole-ticket quality-review + refactor pass fires at implement-exit for any ticket the pass applies to (≥2 annotated RGR loops) — task or feature:

- **Unified trigger** (`ledger-validation.ts`): one predicate `wholeTicketPassApplies(content)` = `scenarios.length >= 2 && hasAnyAnnotation` gates BOTH halves of the pass — the cross-scenario refactor row and the `/quality-review` requirement. Single-loop and legacy unannotated tickets are exempt from both; a present row is always validated (back-compat).
- **Fence drop + shared-trigger skill gate** (`stop-quality.ts`, `skill-invocation-log.ts`): ledger validation runs for any build ticket with a `test-definitions.md` (the `isFeature` fence is gone); `requiredSkillsForDone(isFeature, wholeTicketPass)` adds `/quality-review` when the pass applies, while keeping single-loop tasks free of any requirement and not burdening tasks with verify+audit.
- **Docs**: `/quality-review` carries its invocation-log line; the step moved into `bdd/TDD.md` implement-exit; `bdd/VERIFY.md` and both test-definitions templates updated.

## Review history

Dogfooded on itself: this 15-loop ticket ran its own whole-ticket `/quality-review` (logged), and a session-wide review afterward caught a real regression (S1): the row and the review halves had used _different_ triggers, so a legacy unannotated ticket — exempt from the row — was wrongly forced to log `/quality-review`. Fixed by unifying both halves on `wholeTicketPassApplies`; `countRgrLoops` retired. Two integration tests that had encoded the bug were corrected, and unit + integration regression guards added. Re-verified green.
