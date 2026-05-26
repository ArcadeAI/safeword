# Verify — ticket-folder-legibility (CXXB3P)

## Verify Checklist

**Test Suite:** ✓ 2005/2005 tests pass (1 skipped, 115/115 files, 0 failures)
**Build:** ✅ Success (tsup, DTS build 1.5s)
**Lint:** ✅ Clean on the canonical CI invocation (root `eslint . && tsc --noEmit`). Local `bun run lint` from `packages/cli/` still flags 3 pre-existing errors in untouched files — tracked in [54XH90-lint-config-unify](../54XH90-lint-config-unify/ticket.md).
**Scenarios:** All 4 scenarios marked complete (12/12 sub-checkboxes)
**Dep Drift:** ✅ Clean (flagged drift is all eslint plugins — tooling, not architectural per /verify rules)
**Parent Epic:** N/A
**Audit:** Audit passed — 0 errors, 0 warnings. Depcruise clean (223 modules), knip clean, jscpd 2.09% (below threshold), 2 low-risk patch bumps + 2 deferred major bumps (eslint v10 already in ticket 099).

## Provenance note

This ticket was created **post-hoc** to close a safeword-discipline gap on PR #160. Implementation landed in commit `cc8658dd` before the ticket existed. RED checkboxes in [test-definitions.md](test-definitions.md) are honestly annotated `skip: backfilled — see PR #160` rather than fabricated SHAs.

## What changed during /verify

`/verify` surfaced a real safety regression I hadn't caught: `cross-branch-tickets.test.ts:143-181` asserted the old `{ID}/` layout's filesystem-merge-conflict property, which the `{ID}-{slug}/` layout breaks (two branches force-minting the same ID produce different paths and merge cleanly). Three more tests in `ticket-new.test.ts` also explicitly asserted "no slug in folder name." All four tests rewritten to assert the new design + the post-merge `check-ticket-ids.ts` detector as the loud-failure mechanism. Scenario 4 added to test-definitions.md documenting the safety-layer trade-off. Docstring in `ticket-writer.ts` updated to make the trade-off explicit.

## Decisions needed

None.

## Agent's next actions

- Run `/audit` separately to satisfy the done-gate's third required pattern (`Audit passed`).
- Commit + push the follow-up to PR #160 (test fixes + ticket folder + docstrings). CI on `cc8658dd` is currently red on the cross-branch regression; will turn green once the follow-up lands.
