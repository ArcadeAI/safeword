# Verify — capture-only-cli-crashes (5XXQQZ, #720)

## Verify Checklist

**Test Suite:** ✓ 4564/4564 tests pass (321 files, 5 skipped, 0 failed — full CLI suite via `vitest run`). New coverage: `tests/self-report-capture.test.ts` (4) + `tests/integration/cli-crash-capture.test.ts` (2).
**Gherkin:** ✅ Acceptance lane passes (cucumber-bdd wrapper green within the full suite; no `.feature` files touched by this change).
**Build:** ✅ Success (`npm run build` in packages/cli, tsup + DTS clean).
**Lint:** ✅ Clean (eslint on src + tests exit 0; `tsc --noEmit` exit 0).
**Scenarios:** ⏭️ Skipped — task ticket (no test-definitions.md; TDD path).
**PR Scope:** ✅ Diff matches ticket scope — only `cli.ts` (wiring swap), `self-report-capture.ts` (recordCliExit → recordCliCrash + installCliCrashCapture), the two test files, and the ticket/INDEX bookkeeping. No unrelated changes; no command exit codes altered.
**Dep Drift:** ✅ Clean — no dependency manifest changes (no new deps added).
**Parent Epic:** N/A (ticket has no `parent:` field; relates to epic #344 but is standalone).
**Reconcile:** ✅ No pattern deviation — conforms to the existing hook-side `installCrashCapture` crash-capture pattern (`templates/hooks/lib/self-report.ts`), diverging only where required (CLI preserves a non-zero exit vs. the hook's forced exit 0). Documented in ticket Design section.
**Experience:** ✅ Removes friction — walked the dogfooding developer through a normal session: worst step before = a persistent "Safeword recorded N of its own internal signal(s)" notice re-surfaced on every Stop that never cleared even though nothing crashed (34 signals / 0 crashes in the reported session); after = status exits (`check`, `architecture --check`, `codify`) no longer spool, so the notice only appears on a genuine crash. New steps vs before = 0. Soft, non-blocking.
**Evidence limits:** ✅ None — full suite (which creates throwaway git repos) ran green locally; git-init-in-temp probe succeeds.

## Notes

- Root cause: `recordCliExit` fired on `process.on('exit')` for ANY non-zero code; ~12 commands use `process.exit(1)` as deliberate control flow, so the zero-egress self-report spool filled with false positives.
- Fix (option 3 from `/figure-it-out`): capture only uncaught exceptions / unhandled rejections — the caught-vs-uncaught distinction is the crash-vs-status distinction. Verified on Node 22 (handlers fire only on real crashes; deliberate `process.exit` bypasses them) and against commander 15 source (async action throw → unhandled rejection).
- Dogfood confirmation: `safeword check` and `safeword codify NOSUCH` both exit 1 with **zero** spool records created (each wrote one before the fix).
