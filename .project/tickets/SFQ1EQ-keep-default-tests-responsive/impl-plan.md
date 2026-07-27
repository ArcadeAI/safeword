# Implementation Plan: Keep default tests responsive

**Status:** implemented

## Approach

1. Add a failing boundary test that requires config-only setup suites to pass
   the skip-install environment and requires the non-git install proof to live
   in the slow test file.
2. Update the Cursor, hook, and conditional-setup fixtures to disable dependency
   installation while preserving their existing assertions.
3. Move the non-git dependency-installation proof to
   `conditional-setup.slow.test.ts`.
4. Assert physical `node_modules` artifacts and wire that one focused slow proof
   into CI without running the broader slow suite on every pull request.
5. Run the focused default and slow lanes, then reprofile the full default suite.
6. Keep `maxWorkers: 3`; do not introduce Vitest projects unless the new profile
   identifies a genuine shared-resource or contention-sensitive lane.

## Decisions

- Preserve the current Vitest scheduler because profiling identified accidental
  dependency installs—not worker contention—as the dominant cost.
- Make the no-install boundary explicit through a shared test helper.
- Keep one physical non-git dependency-install proof in the slow lane so the
  optimization does not reduce product coverage.
- Run only that physical-install proof in CI; the rest of `test:slow` remains
  opt-in because it covers broader, expensive framework-install scenarios.

## Arch alignment

The change preserves the existing test-runner architecture and follows the
project's slow-lane convention for physical dependency installation. The
boundary contract keeps future config-only fixtures from silently reintroducing
installation work into the default lane.

## Known deviations

None.

## Assessment triggers

- A config-only fixture needs to assert dependency-manager output: move only
  that proof to the slow lane instead of weakening the boundary contract.
- Default-suite profiling identifies shared-resource contention as a dominant
  cost: reassess Vitest projects or worker grouping with fresh evidence.
- `override-survival.test.ts` remains dominant after this change: investigate
  its repeated upgrade and lint-hook subprocess work as a separate slice.
