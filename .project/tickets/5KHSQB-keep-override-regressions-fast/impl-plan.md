# Impl Plan: Keep override regressions fast (5KHSQB)

**Status:** implemented

## Approach

1. Add a behavior-level helper contract test that requires fixture upgrades to
   disable package and skill installation.
2. Link the repository's existing `node_modules` into each TypeScript fixture
   after setup, while tolerating an existing fixture `node_modules`.
3. Route every upgrade through the structural helper and assert the generated
   lint hook did not fail to launch its tool.
4. Re-run all ten examples and compare isolated wall time with the 91.03s
   baseline, then run repository validation.

## Decisions

- Preserve all ten historical examples because the original coverage matrix
  defines one observable example per language/override partition.
- Reuse the repository toolchain because this suite verifies config survival and
  hook behavior, not dependency installation.
- Keep Python fixtures unlinked because Ruff resolves from PATH.
- Keep generated hooks real; do not mock ESLint, Ruff, or the CLI.

## Arch alignment

The change stays test-only, retains the existing integration boundary, and uses
the repository-local Safeword package/toolchain already assumed by test helpers.
Physical dependency installation remains covered by dedicated slow-lane tests.

## Known deviations

The global coding-guide paths referenced by AGENTS.md are absent in this
checkout. Repository templates and completed override tickets are the fallback
sources for artifact shape and behavior coverage.

The final isolated runtime is 43.94s rather than the plan's 40s reassessment
threshold. Profiling found the remaining time in four required real upgrades
and four generated TypeScript hook runs, so no further cut fits this scope.

PR review replaced the source-text boundary test with a behavior-level helper
contract and narrowed repository toolchain links from four fixtures to the two
TypeScript fixtures.

## Assessment triggers

- A linked repository toolchain does not resolve consistently on Linux CI:
  replace the directory link with an explicit test-toolchain materialization
  helper.
- The generated hook passes while emitting a launcher failure not covered by
  the guard: promote hook-result validation into a shared helper.
- Isolated wall time remains above 40s: profile the three lint subprocesses per
  example before considering scenario consolidation.
