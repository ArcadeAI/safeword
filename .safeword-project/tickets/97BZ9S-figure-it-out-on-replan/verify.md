# Verify — figure-it-out-on-replan (97BZ9S)

Task (TDD): the replan-on-resume heads-up now offers `/figure-it-out` to re-decide
the approach when scope may be stale.

## Verify Checklist

**Test Suite:** ✓ replan-relevance + replan green (42/42, incl. 2 new RED→GREEN); full suite run as done-evidence below
**Build:** ✅ Success (`bun run build`)
**Lint:** ✅ Clean (`eslint src tests && tsc --noEmit`)
**Scenarios:** ⏭️ N/A — task (TDD: RED → GREEN, no feature test-definitions)
**Dep Drift:** ✅ N/A — no dependency change
**Parent Epic:** VKNF1T-platform-uplift-epic

## TDD trail

- **RED:** added two assertions (`formatReplanHeadsUp`, `formatBlockerMovedHeadsUp` each `.toContain('/figure-it-out')`) — both failed.
- **GREEN:** factored a shared `REDECIDE_OFFER` clause and appended it to both formatters in `templates/hooks/lib/replan-relevance.ts`; dogfood copy synced byte-identical.

## What changed

`REDECIDE_OFFER = ' If scope shifted, I'll run \`/figure-it-out\` to re-decide the
approach against current docs.'` — appended to both the path-relevance heads-up
and the blocker-moved heads-up. The narrow slice of ZBVGPF that runs
figure-it-out during revalidation, without the full intake embedding.

## Done-when verification

- ✓ Both heads-up messages name `/figure-it-out` as the re-decide tool when scope may be stale.
- ✓ Same additive-line pattern as E11N48's blocker-moved work (shared clause, no detection-logic change).
- ✓ Template ↔ dogfood byte-identical.
- ✓ No exact-match assertion on the old message text regressed (grep clean; 42 replan tests green).

**Next:** Close 97BZ9S and start `skill-authoring-checklist (1RYQFV)`.
