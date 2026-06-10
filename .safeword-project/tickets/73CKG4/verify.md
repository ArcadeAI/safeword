# Verify — 73CKG4

## Verify Checklist

**Test Suite:** ✓ 2488/2488 tests pass (1 skipped) — this session's full `vitest run`; this change is markdown-only (skill prose in `SCENARIOS.md`), no code path affected, so the result is unchanged
**Build:** ✅ Success (tsup ESM + DTS, this session)
**Lint:** ✅ Clean (eslint + tsc --noEmit, this session)
**Scenarios:** All 0 scenarios marked complete — docs/skill-prose task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes on this branch
**Parent Epic:** 0AWSY8 (siblings: 4/7 done)
**Reconcile:** N/A — skill-prose, no new code pattern

## Audit Results

**Architecture (depcruise):** ✅ No violations (this session)
**Dead code (knip):** pre-existing baseline only (stack ESLint plugins + `templates/hooks/**` false positives + 2 `personas.ts` constants). None from this change.
**Outdated:** dev-only patches/minors + deferred eslint 9→10. None blocking.
**Parity (re-run for this change):** ✅ 120 pairs + 3 contracts in sync; template ↔ dogfood identical; markdownlint 0.

**Audit passed** — no findings attributable to this change.

## Done-When Verification

- ✅ The scenario-gate's **Deterministic** check is sharpened with a "Determinism risks" subsection — three named flaky patterns each with a mitigation (time-without-wait → poll, not `sleep`; order-dependent → sort / compare-as-set; unsequenced concurrency → assert the settled end-state). Grounded in Luo et al. (2014) — async-wait/concurrency/order are the top empirical flaky causes — and Fowler.
- ✅ Assertion-strength folded: a one-line pointer to `testing` Iron Law 2 (re-scope decision), not a standalone check.
- ✅ Each pattern carries its fix inline (compact worked-example form). Template + dogfood parity; markdownlint clean.

## Commits

- (this commit) feat(73CKG4) — add Determinism risks subsection to the scenario-gate
