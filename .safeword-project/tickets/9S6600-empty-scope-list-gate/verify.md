# Verify — 9S6600 (Reject empty scope/out_of_scope/done_when lists)

## Verify Checklist

**Test Suite:** ✓ 2364/2364 tests pass (1 skipped) — full `bun run test`, 146 files
**Build:** ✅ Success (tsup, via `pretest`)
**Lint:** ✅ Clean (`eslint .` + `tsc --noEmit`)
**Scenarios:** ⏭️ N/A — patch (inline test, no test-definitions.md)
**Dep Drift:** ✅ Clean — no dependency changes in this ticket
**Parent Epic:** EECVXB (siblings: G9BXE9 done; closing 9S6600 + P58R22 now; FSX1PP, V6N5PW remain)
**Reconcile:** ✅ No pattern deviation — conformed to the existing required-fields gate
**Audit:** Audit passed — architecture clean (no cycles, 124 modules), duplication 0.87%, config in sync; knip warnings are all pre-existing (bundled eslint plugins, over-exported symbols), none from this ticket

## Evidence

- Test: quality-gates `9.2b` (empty-list scope denied) + `9.2`/`9.3`/`9.4` regression — 71/71 in that file; full suite 2364 pass / 1 skipped.
- Commits: `b2f1843f` (fix — empty/all-blank arrays + scalars treated as missing), `0557e2d5` (refactor — extract `isMissingFrontmatterField`).

Ready to mark done.
