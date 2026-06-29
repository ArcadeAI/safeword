# Verify: Let projects track feature surfaces during BDD

## Verify Checklist

**Test Suite:** ✓ Current generated verify plan is `bun run test`; CI passes with 3933/3937 Vitest tests passing and 4 skipped. Targeted setup surfaces language matrix ✓ 11/11 tests pass.
**Gherkin:** ✅ Acceptance lane passes with 173/173 scenarios and 3258/3258 steps.
**Build:** ✅ Success, including release-gate build and dogfood parity tests.
**Lint:** ✅ Clean
**Scenarios:** All 25 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope; includes accepted review follow-up ticket `SFGCR1` for dependency advisory tracking only.
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction; Walked Technical Builder through BDD intake -> spec -> check advisory flow; worst step = naming the matching `@surface.<slug>` tag for punctuation-heavy surface names; new steps vs before = 1 optional `surfaces.md` lookup.

## Done Decision

Ready to close: the previous Python zero-test blocker is no longer part of the generated verify plan after merging current `main`, and the latest CI run for PR #545 passed the full test job.
