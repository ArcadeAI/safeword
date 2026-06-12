# Verify — E11N48 (replan blocker-moved advisory)

## Verify Checklist

**Test Suite:** ✓ 2621/2621 tests pass (full suite, 1 pre-existing skip; 165 files)
**Build:** ✅ Success (tsup)
**Lint:** ✅ Clean (`eslint src tests && tsc --noEmit`)
**Scenarios:** ⏭️ Skipped — task (no test-definitions); behavior covered by 10 targeted tests
**Dep Drift:** ✅ Clean — no new dependencies
**Parent Epic:** VKNF1T (fast-follow to AKZJXC)
**Reconcile:** ✅ No deviation — reuses the existing replan pipeline (commit window, HEAD-advance dedup); the `depends_on` parse is inlined per the standalone-hook boundary (can't import src/)

## Evidence

- **Pure core** — `detectMovedBlockers` + `formatBlockerMovedHeadsUp`: 7 unit tests (terminal + in-window fires; non-terminal or out-of-window stays silent; singular/plural slug-first message).
- **Wrapper** — `evaluateReplan` resolves `depends_on` → target status + ticket.md path and composes the blocker-moved signal with path-relevance under one HEAD-advance dedup: 3 integration tests.
- Template ↔ dogfood byte-identical for both `replan.ts` and `replan-relevance.ts`.

## Audit

✅ **Audit passed** — 0 duplication clones (jscpd at min-lines 8, including `parseDependsOn` vs `parseTicketIdList`); no new architecture violations (depcruise — the lone orphan warning is pre-existing `prompt-timestamp.ts`); all new functions used; tsc clean.
