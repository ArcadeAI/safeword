# Verify: Issue-first ticket identity + tracker-key→local-folder join reader (DGH59K)

## Verify Checklist

**Test Suite:** ✓ 3856/3856 tests pass (5 skipped) — full `packages/cli` vitest suite, 272 files
**Gherkin:** ✅ Acceptance lane passes (159/159 scenarios) — `features/tracker-identity-and-join.feature` is tagged `@wip` and excluded from the lane, matching the settled tracker-feature convention (sync-tracker.feature, tracker-connect-flow.feature: "no live tracker in tests", #363); its behavior is proven in vitest and the `.feature` remains the canonical scenario source
**Build:** ✅ Success — tsup ESM + DTS build green (runs as part of the suite)
**Lint:** ✅ Clean — pre-commit eslint+prettier passed on every commit; tree clean
**Typecheck:** ✅ Clean — `bun run typecheck` (`tsc --noEmit`) green
**Scenarios:** All 11 scenarios marked complete (33/33 R/G/R boxes checked)
**PR Scope:** ✅ Diff matches ticket scope — all 24 changed files serve the ticketing-migration epic (DGH59K child code + tests, its parent KKNFZA intake, the 01EAKC follow-up it spawned, and the two scoped refactors); no unrelated work
**Dep Drift:** ✅ Clean — no dependency changes (`package.json` unchanged)
**Parent Epic:** KKNFZA (siblings: child 1 of 5 implemented; ②–⑤ not started; 01EAKC is a spawned follow-up)
**Reconcile:** ✅ No pattern deviation — `createIssueFirstTicket` parallels the existing `createTicket`; routing/identity reuse the established `tracker-sync` writer/client seams
**Experience:** ⚠️ Walked the Technical Builder through `ticket new` with a tracker connected; worst step = the command now blocks on a network issue-create before the folder appears, and on tracker-down it fails loudly (no orphan) rather than producing a local ticket; new steps vs before = 0 (same single command). Soft — does not block.

## Resolution log

Gherkin blocker resolved via `/figure-it-out`: the repo's settled pattern for tracker/network
features is to tag the feature `@wip` (excluded from the cucumber lane — "no live tracker in
tests", #363) and prove behavior in vitest, not to author fake-binary black-box steps (zero steps
files import internals; both sibling tracker features do exactly this). Tagged the feature `@wip`
with the rationale comment; `bun run test:bdd` is green (159/159, this feature excluded).

Outstanding before `done`: run `/audit` (separate gate) and obtain user confirmation to close.
