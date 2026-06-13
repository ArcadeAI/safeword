Verified: 2026-05-14T16:50:00Z

## Verify Checklist

**Test Suite:** ✓ 1565/1566 tests pass (1 skipped, 81 files)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Typecheck:** ✅ Clean
**Scenarios:** ⏭️ Skipped — task type, no test-definitions.md required
**Doc Refs:** ✅ Clean (no `.md` references to the removed `createIfMissing` field outside this ticket)
**Dep Drift:** N/A — no dependency changes
**Parent Epic:** N/A

## Evidence

- Schema: `TextPatchDefinition.createIfMissing` field removed; both `AGENTS.md` and `CLAUDE.md` schema entries cleaned up.
- Reconcile: `planTextPatchesWithCreation` dropped; inlined at single caller with truthful filesystem-driven `wouldCreate` tracking.
- Tests: `tests/schema.test.ts` updated to assert `marker` + `operation` instead of removed flag.
- Bundled into v0.30.3 release: https://github.com/ArcadeAI/safeword/pull/89
