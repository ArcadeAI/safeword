# Work Log: Keep default tests responsive

**Anchored to:** `.project/tickets/SFQ1EQ-keep-default-tests-responsive/ticket.md`

---

## Session: 2026-07-25

- [20:19] Revalidated current main: full Vitest passed in 491.95s and BDD passed
  in 89.29s.
- [20:37] Framed scheduler decision: improve wall time without shared-state
  races, load-dependent timeouts, coverage loss, or surprising focused runs.
- [20:45] Confirmed Vitest 4.1.10 project groups can run in ordered
  `sequence.groupOrder` phases with distinct worker caps.
- [20:50] Static audit found 98 child-process test files, making a blanket
  integration/spawn serial lane too coarse.
- [20:54] Current-main JSON baseline: 369 files, 5467 tests, 449.27s runner wall;
  282 files under 1s, with three setup fixtures at 86–95s.
- [20:56] Skip-install probe cut those three files to 3.51–4.42s. Only the
  non-git real-install assertion failed, confirming it belongs in the slow lane.
- [20:56] Decision: execute SFQ1EQ fixture/lane separation and leave CQJBSN
  scheduler configuration unchanged.
- [20:58] RED: `setup-or-throw.test.ts` failed because the new
  `runCliWithoutInstall` fixture seam did not exist.
- [20:59] GREEN: added the explicit helper, routed the three config-only suites
  through it, and moved the non-git installation proof to the slow file. Focused
  default batch passed 49/49; measured files fell to 2.96–4.25s.
- [20:59] Slow-lane proof passed through `vitest.slow.config.ts`: 1 selected
  install test passed in 7.17s, with 18 unrelated slow tests filtered out.
- [21:07] First post-change full profile passed with identical counts (369
  files, 5462 passed, 5 skipped) in 366.81s runner wall: 82.46s / 18.4% faster
  than the 449.27s baseline.
- [21:11] Second profile-guided RED: the install-boundary contract failed only
  for `setup-git`, `setup-templates`, and `invisible-extension`.
- [21:12] Second GREEN: all 26 focused tests passed; the three additional files
  now complete in 1.46–2.40s instead of 35.14–49.71s.
- [21:19] Final full profile passed: 370 files, 5469 passed, 5 skipped, 321.79s
  runner wall. Net improvement: 127.48s / 28.4% from the 449.27s baseline.
  Full BDD passed 494 scenarios (3 skipped); lint and typecheck passed.
- [21:19] Re-entry: `override-survival.test.ts` is now the dominant file at
  68.27s, but it already uses skipped-install setup. Investigate its repeated
  upgrade/lint-hook subprocess work separately; do not change Vitest scheduling
  based on this slice.

## Session: 2026-07-27

- [08:00] Caught the PR branch up to current `origin/main` without conflicts.
- [08:00] RED: focused boundary tests failed for caller override protection,
  physical artifact assertions, and missing CI wiring.
- [08:01] GREEN: 26 focused tests passed; the physical-install proof passed in
  6.59s and a forced `SAFEWORD_SKIP_INSTALL=1` mutation made it fail.
- [08:01] REFACTOR: documented why `runCliWithoutInstall` exists alongside
  `setupOrThrow`, removed redundant skills-skip plumbing, and widened the raw
  runner contract to reject both `runCli` and `runCliSync`.
