---
id: 5KHSQB
slug: keep-override-regressions-fast
type: task
phase: done
status: done
created: 2026-07-26T14:35:33.508Z
last_modified: 2026-07-27T06:22:22Z
external_prs: [https://github.com/ArcadeAI/safeword/pull/1478]
---

# Keep override regressions fast for maintainers

**Goal:** Cut override-survival test time without weakening any customer override example.

**Why:** The file is the default suite's dominant bottleneck and repeats unrelated tool installation work.

## Scope

Use the repository's installed JavaScript toolchain in TypeScript
override-survival fixtures, make install-disabled fixture upgrades structural,
and make hook-launch failures explicit.

## Out of Scope

- Changing Vitest worker configuration or moving override coverage to the slow lane.
- Combining or deleting the ten historical override examples.
- Changing production upgrade, lint-hook, ESLint, or Ruff behavior.

## Done When

- All ten override examples still exercise the real generated lint hook.
- The suite performs no package or skill installation.
- An isolated run is materially faster than the 91.03s baseline.
- Focused and full validation pass.

## Tests

- A helper contract test rejects reintroduction of install-capable fixture upgrades.
- The existing ten-example integration suite passes with the repository
  toolchain linked into TypeScript fixtures.

## Work Log

- 2026-07-27T06:22:22Z Closed: PR #1478 admin-squash-merged as
  `060813804fea791618143040f24daae8ae1c552a`; local verification and all four
  GitHub CI checks passed.
- 2026-07-27T03:00:41Z Final verification: merged current `origin/main`;
  full suite passed 5,503 tests across 371 files with 5 skipped; 494/494
  runnable Gherkin scenarios passed; build, lint, typecheck, audit, and
  independent quality review are green.
- 2026-07-27T02:46:00Z Review repairs: made failed upgrades throw, rejected
  Bun/Ruff infrastructure false greens, preflighted linked ESLint/Prettier,
  added direct result-branch contracts, isolated helper tests, centralized
  TypeScript fixture setup, and repaired the scenario-document reference.
- 2026-07-27T01:21:44Z Verified: Full default suite passed 5,484 tests
  with 5 skipped and 0 failed; lint, Gherkin validation, and typechecking passed.
- 2026-07-27T01:08:47Z Focused GREEN: 20 tests passed serially in 42.15s.
- 2026-07-27T01:01:00Z GREEN: Added injectable `runFixtureUpgrade`, routed the
  suite through it, deleted the brittle source-grep test, removed Python
  toolchain links, and guarded an existing fixture `node_modules`.
- 2026-07-27T00:59:37Z RED: Helper contract failed because
  `runFixtureUpgrade` did not exist.
- 2026-07-27T00:58:00Z Review: Accepted four actionable threads. Chose a
  structural helper plus runtime assertions over source-text enforcement.
- 2026-07-27T00:57:00Z Recalibrated: Merged current `main` into the PR branch.
- 2026-07-26T14:49:30Z Reconciled: Marked the cross-scenario refactor row
  skipped because this task has one RGR loop and no cross-scenario boundary.
- 2026-07-26T14:48:30Z Verified: Full default suite passed 5,473 tests
  (5 skipped, 0 failed) across 370 files in 397.95s. In-suite
  `override-survival.test.ts` fell from 68.27s to 22.52s.
- 2026-07-26T14:48:30Z Verified: ESLint, Gherkin lint, typecheck, focused
  boundary 1/1, and override integration 10/10 all pass.
- 2026-07-26T14:41:30Z REFACTOR: Tightened the boundary contract to require
  all four fixture links, the exact install-disabled upgrade call, and explicit
  hook spawn/status/output guards. No production abstraction was warranted.
- 2026-07-26T14:40:30Z GREEN: Boundary test and all ten integration examples
  passed in 43.94s, 47.09s / 51.7% faster than baseline.
- 2026-07-26T14:40:30Z Assessed: Remaining TypeScript time is load-bearing:
  four real upgrades consume about 8.2s and four real generated hooks consume
  about 17.9s. Further cuts require scenario consolidation or production-hook
  changes, both out of scope.
- 2026-07-26T14:37:40Z RED: Added the install-boundary contract; it failed
  because `override-survival.test.ts` had no repository-toolchain seam.
- 2026-07-26T14:36:09Z Found: Baseline was 91.03s. Skipping skills alone passed
  all ten examples in 63.92s; skipping all installs cut the run to 24.41s but
  exposed that TypeScript's positive no-console assertion needs a local ESLint
  toolchain.
- 2026-07-26T14:36:09Z Decided: Link the repository toolchain into fixtures,
  skip install work during upgrade, retain every coverage row, and reject
  hook-launch failure output explicitly.
- 2026-07-26T14:35:33.508Z Started: Created ticket 5KHSQB
