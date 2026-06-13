# Verify — explain-at-the-gate (ZCYD5P)

Patch: every hard-block gate message now ends with a pointer to `/explain`.

## Verify Checklist

**Test Suite:** ✓ targeted green — quality-gates + hooks (121/121), status-close done-gate (1/1); full suite run as done-gate evidence below
**Build:** ✅ Success (`bun run build`)
**Lint:** ✅ Clean (`eslint src tests && tsc --noEmit`)
**Scenarios:** ⏭️ Skipped — patch (no test-definitions)
**Dep Drift:** ✅ N/A — no dependency change
**Parent Epic:** VKNF1T-platform-uplift-epic

## What changed

- `lib/quality-state.ts`: new `EXPLAIN_HINT` constant (single source).
- `pre-tool-quality.ts` `deny()`: appends the hint to every pre-tool block (phase, LOC, REFACTOR, artifact gates).
- `stop-quality.ts` `hardBlockDone()`: appends the hint to the done gate.
- All three template hooks copied byte-identical to `.safeword/` dogfood.
- Tests: LOC-gate block and done-gate block now assert the pointer.

`softBlock` (review-nudge prompts) deliberately untouched — those aren't dense gate jargon.

## Done-when verification

- ✓ Phase / LOC / artifact gate blocks carry `Run \`/explain\` for a plain-English version of this block.` (quality-gates LOC test).
- ✓ Done-gate block carries the same pointer (status-close-gate test).
- ✓ Template ↔ dogfood byte-identical for all three hooks.
- ✓ No existing exact-match block assertion regressed (121 hook tests green).

**Next:** Close ZCYD5P and start `figure-it-out-on-replan (97BZ9S)`.
