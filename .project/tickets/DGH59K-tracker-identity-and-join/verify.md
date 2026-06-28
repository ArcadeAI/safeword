# Verify: Issue-first ticket identity + tracker-key→local-folder join reader (DGH59K)

## Verify Checklist

**Test Suite:** ✓ 3856/3856 tests pass (5 skipped) — full `packages/cli` vitest suite, 272 files
**Gherkin:** ❌ Failed — `features/tracker-identity-and-join.feature` has no step definitions; every step is undefined and the acceptance lane (`bun run test:bdd`) exits 1
**Build:** ✅ Success — tsup ESM + DTS build green (runs as part of the suite)
**Lint:** ✅ Clean — pre-commit eslint+prettier passed on every commit; tree clean
**Typecheck:** ✅ Clean — `bun run typecheck` (`tsc --noEmit`) green
**Scenarios:** All 11 scenarios marked complete (33/33 R/G/R boxes checked)
**PR Scope:** ✅ Diff matches ticket scope — all 24 changed files serve the ticketing-migration epic (DGH59K child code + tests, its parent KKNFZA intake, the 01EAKC follow-up it spawned, and the two scoped refactors); no unrelated work
**Dep Drift:** ✅ Clean — no dependency changes (`package.json` unchanged)
**Parent Epic:** KKNFZA (siblings: child 1 of 5 implemented; ②–⑤ not started; 01EAKC is a spawned follow-up)
**Reconcile:** ✅ No pattern deviation — `createIssueFirstTicket` parallels the existing `createTicket`; routing/identity reuse the established `tracker-sync` writer/client seams
**Experience:** ⚠️ Walked the Technical Builder through `ticket new` with a tracker connected; worst step = the command now blocks on a network issue-create before the folder appears, and on tracker-down it fails loudly (no orphan) rather than producing a local ticket; new steps vs before = 0 (same single command). Soft — does not block.

## Agent's next actions

- Write `steps/tracker-identity-and-join.steps.ts` — cucumber step definitions backed by a World that drives the real `createTicketRouted` / `resolveFolderByTrackerKey` with an injected fake writer (the same collaborators the vitest tests use), so the committed feature is executable and the acceptance lane passes. Re-run `bun run test:bdd` to confirm green, then re-run `/verify`.

## Decisions needed

- Acceptance-evidence model for this feature: the repo runs `features/**/*.feature` through cucumber and every other feature has matching `steps/*.ts`, but DGH59K's scenarios were proven via the vitest ledger (`test-definitions.md`) instead. Either (A — recommended, matches convention) author cucumber steps so the feature is genuinely executable, or (B) treat the vitest ledger as the acceptance evidence and tag the feature out of the lane (`@manual`). Recommend A.
