# Verify: Let projects track feature surfaces during BDD

## Verify Checklist

**Test Suite:** ✓ 3804/3804 Vitest tests pass; targeted surfaces suite ✓ 173/173 tests pass. Warning: `safeword test-plan --kind verify` exits 5 after the Python unittest lane discovers 0 tests in `experiments/gepa-review-spec/gepa`.
**Gherkin:** ✅ Acceptance lane passes
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 22 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope; includes accepted review follow-up ticket `SFGCR1` for dependency advisory tracking only.
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction; Walked Technical Builder through BDD intake -> spec -> check advisory flow; worst step = naming the matching `@surface.<slug>` tag for punctuation-heavy surface names; new steps vs before = 1 optional `surfaces.md` lookup.

## Agent's next actions

- Resolve or ticket the existing Python zero-test lane so full `safeword test-plan --kind verify` exits cleanly before marking DBF1FW done.
