# Verify — capture-only-cli-crashes (5XXQQZ, #720)

## Verify Checklist

**Test Suite:** ✓ 4569/4569 tests pass (321 files, 5 skipped). Canonical `safeword test-plan --kind verify` block reported 6 failures on its first run — but all 6 were load-induced flakes from running the `/audit` static-analysis block (knip/jscpd/depcruise) concurrently with the suite (`setup-hooks.test.ts` timed out at 213s vs a 60s limit; 5 subprocess/IO `cursor-stop-review` races). Re-run of exactly those two files in isolation → 20 passed / 1 skipped / 0 failed. My earlier standalone full run was also clean (4564 passed). New coverage: `tests/self-report-capture.test.ts` (4) + `tests/integration/cli-crash-capture.test.ts` (2).
**Gherkin:** ✅ Acceptance lane passes — standalone `bun run test:bdd` ran this time: **243 scenarios (243 passed), 5034 steps (5034 passed)**. (Prior verify.md marked this ✅ from the vitest cucumber wrapper without running the standalone lane — corrected here; see #725.)
**Build:** ✅ Success — `safeword test-plan --kind build` rc=0 (tsup + DTS clean).
**Lint:** ✅ Clean (eslint on src + tests exit 0; `safeword test-plan --kind typecheck` / `tsc --noEmit` rc=0).
**Scenarios:** ⏭️ Skipped — task ticket (no test-definitions.md; TDD path).
**PR Scope:** ✅ Diff matches ticket scope — only `cli.ts` (wiring swap), `self-report-capture.ts` (recordCliExit → recordCliCrash + installCliCrashCapture), the two test files, and the ticket/INDEX bookkeeping. No unrelated changes; no command exit codes altered.
**Dep Drift:** ✅ Clean — no dependency manifest changes (no new deps added); depcruise clean (215 modules, 632 deps, 0 violations).
**Parent Epic:** N/A (ticket has no `parent:` field; relates to epic #344 but is standalone).
**Reconcile:** ✅ No pattern deviation — conforms to the existing hook-side `installCrashCapture` crash-capture pattern (`templates/hooks/lib/self-report.ts`), diverging only where required (CLI preserves a non-zero exit vs. the hook's forced exit 0). Documented in ticket Design section.
**Experience:** ✅ Removes friction — walked the dogfooding developer through a normal session: worst step before = a persistent "Safeword recorded N of its own internal signal(s)" notice re-surfaced on every Stop that never cleared even though nothing crashed (34 signals / 0 crashes in the reported session); after = status exits (`check`, `architecture --check`, `codify`) no longer spool, so the notice only appears on a genuine crash. New steps vs before = 0. Soft, non-blocking.
**Reconcile/Audit:** Audit passed (session-scoped) — config in sync (W007 clear), 0 architecture violations, **0 dead code from this change** (knip: `recordCliCrash`/`installCliCrashCapture` consumed, `recordCliExit` fully removed; the 5 unused exports it lists are pre-existing baseline elsewhere), new test files pass the quality checklist. One minor 16-line spawn-fixture clone in the new integration test (4.76%) → addressed in the refactor pass.
**Evidence limits:** ⚠️ Concurrent-load contention — the canonical block's 6 failures came from running `/audit`'s CPU-heavy static analysis at the same time as the full suite; they are NOT product failures (all pass on isolated re-run). Lesson: the verify suite and the audit block should not share the machine simultaneously. Git-init-in-temp probe succeeds otherwise.

## Notes

- Root cause: `recordCliExit` fired on `process.on('exit')` for ANY non-zero code; ~12 commands use `process.exit(1)` as deliberate control flow, so the zero-egress self-report spool filled with false positives.
- Fix (option 3 from `/figure-it-out`): capture only uncaught exceptions / unhandled rejections — the caught-vs-uncaught distinction is the crash-vs-status distinction. Verified on Node 22 (handlers fire only on real crashes; deliberate `process.exit` bypasses them) and against commander 15 source (async action throw → unhandled rejection).
- Dogfood confirmation: `safeword check` and `safeword codify NOSUCH` both exit 1 with **zero** spool records created (each wrote one before the fix).
