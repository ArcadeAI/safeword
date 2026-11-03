# RED replay against pre-change code

Written 2026-11-03. The tests and implementation for T0FK4H landed together (`271d6aaa0` and later) before the ticket existed, so there is no RED commit. RED is replayed instead: the scenario-bound test files from head `e0834b7e3` run against the pre-change implementation.

## Replay directory

`.project/tmp/red-base/` (git-ignored) is a detached git worktree of `f211c4c30` — the merge base of #6319 and main before this change. Only these four test files were copied in from `e0834b7e3`, byte-identical to head:

- `packages/cli/tests/review/capability-eval.test.ts`
- `packages/cli/tests/review/capability-catalogue.test.ts`
- `packages/cli/tests/review/packaged-capability.release.test.ts`
- `packages/cli/tests/integration/planning-review-pinned-pairs.test.ts`

Source, scripts, fixtures (including `reviewer-capability-corpus.ts`, which holds the pinned pair list) and the generated catalogue are the pre-change versions. Dependencies were installed from the base lockfile.

## Observed at base (one vitest run, 2026-11-03)

| Bound test | Failure at `f211c4c30` |
| --- | --- |
| pins the latest Opus and Sol pair with its own settings revision | `TypeError: undefined is not iterable` (no pinned pair list) |
| keeps the shipped pair revision byte-identical when it is pinned in the pair list | `TypeError: undefined is not iterable` |
| admits each pinned pair only at its own settings revision | `AssertionError: expected 'unknown' to be 'not_weaker'` |
| admits a second qualified pinned pair through the planning review route | suite fails to load: `TypeError: undefined is not iterable` |
| refuses partial, cross-pair or shared-model evidence instead of omitting it | `TypeError: capabilityManifestForPair is not a function` |
| rescores only complete pinned pairs and refuses partial or mismatched evidence | `TypeError: capabilityManifestForPair is not a function` |
| emits every pair with complete evidence and leaves a pair without evidence unqualified | `TypeError: capabilityManifestForPair is not a function` |

`refuses a record whose models do not belong to the revision it claims` **passed** at base, so it proves no new behavior and is not bound to a scenario.

At head every one of these tests passes (full verification, 2026-11-03: CLI 728/728 files in both passes).
