---
id: CQJBSN
slug: test-suite-parallelism
type: task
phase: implement
status: in_progress
created: 2026-06-01T01:03:41.848Z
last_modified: 2026-06-24T05:58:34Z
---

# Speed up the vitest suite — lift blanket maxWorkers:1, isolate the offenders

**Goal:** Cut full-suite wall-time by removing the blanket `maxWorkers: 1` and running well-isolated test files in parallel.

**Why:** The whole suite (147 files) runs strictly sequentially because of one coarse setting; most files are already parallel-safe, so the few non-isolated ones are taxing every run and slowing the dev/commit loop.

## Finding (`/figure-it-out`, 2026-06-01)

`packages/cli/vitest.base.ts` sets `pool: 'forks'`, `maxWorkers: 1` with the comment _"Run tests sequentially to avoid temp directory conflicts."_ That blanket serialization is the bottleneck:

- **147 test files** — 44 process-spawning integration tests (`tests/integration/`) + 103 others. All forced single-worker.
- **vitest v4 forks isolate per-file** (verified against current docs: improving-performance, config/maxworkers). Two _different_ files writing to _different_ `mkdtemp` dirs are already parallel-safe — 21+ files use unique `mkdtempSync`. The "conflict" comes from the handful of tests that write to a **shared/fixed path** (real repo `.safeword-project`, or a hardcoded tmp path), not from forks themselves.
- So `maxWorkers: 1` is a coarse fix for a few non-isolated tests, applied to all 147.

## Direction (decided; refine at intake)

1. **Measure first** — capture per-file timing (`vitest run` slowest-files, or `--reporter=verbose`) to confirm where wall-time concentrates. If the 44 integration spawns dominate, weight effort there. **Observed baseline (2026-06-01, 3 full runs this session):** ~748–758s wall for 146 files / ~2358 tests, sequential (`maxWorkers: 1`). `tests` phase ≈ 725–733s, `import` ≈ 11–13s, `transform` ≈ 1s — so ~97% is test execution, and the process-spawning integration tests (44 files) are the prime suspects for the bulk. Per-file breakdown still TODO at pickup.
2. **Audit isolation** — find tests that touch a shared/fixed path instead of a unique `mkdtemp` (and any that mutate global cwd/env without restoring). Give each its own temp dir.
3. **Lift the cap** — set `maxWorkers: '50%'`, keep `pool: 'forks'` (child-process-spawning integration tests need fork safety; `threads` is faster for pure units but risks them). Re-run; fix any flakiness surfaced by parallelism.

## Open questions (intake)

- **Threads for the unit subset?** A two-tier setup (parallel `threads` pool for the 103 pure-unit files + sequential/forks pool for the 44 integration files) could beat a single forks pool — but adds config surface. Worth it, or is single-pool `forks` at 50% enough? Decide after the timing measurement.
- **Spawn cost** — if integration tests dominate wall-time, a complementary lever is replacing real `execSync`/`bun` CLI spawns with in-process calls where behavior allows. In scope here, or a separate ticket?
- **CI vs local** — tune `maxWorkers` for the dev machine, CI, or both (they have different core counts)?

## Out of scope

- The `*.slow.test.ts` real-install tests (already excluded from the default run via `vitest.config.ts`).
- Rewriting integration tests to not spawn at all (behavior-changing; separate effort if pursued).

## Evidence

- `packages/cli/vitest.base.ts` — `pool: 'forks'`, `maxWorkers: 1`, the rationale comment.
- vitest v4 docs (Context7 `/vitest-dev/vitest`): `maxWorkers: '50%'`, `pool` threads-vs-forks tradeoff, `fileParallelism`, `isolate`.

## Work Log

- 2026-06-01T01:03:41.848Z Started: Created ticket CQJBSN
- 2026-06-01T01:03:41.848Z Filed (backlog): `/figure-it-out` traced the slow suite to a blanket `maxWorkers: 1` in vitest.base.ts (coarse workaround for a few non-isolated tests). Direction: measure per-file timing → audit shared-path tests for `mkdtemp` isolation → lift cap to `'50%'` keeping `pool: 'forks'`. Open questions on threads-tiering, spawn cost, and CI-vs-local left for intake. Standalone (not part of M7AZY3).
- 2026-06-01T14:12:00.000Z Interim: bumped `maxWorkers: 1 → 3` (kept `pool: 'forks'`). Full suite green, 146 files / 2358 pass, **~343s vs ~750s sequential (~2.2× faster)**. NOT the full fix — the proper isolation audit + `'50%'` / threads-tiering / CI-vs-local questions remain open.
- 2026-06-01T15:05:00.000Z Reverted to `maxWorkers: 1` after the 3-worker bump flaked the pre-push gate 2/2 push runs. **(This reasoning was wrong — corrected below.)**
- 2026-06-01T15:28:00.000Z **Investigated rigorously (user-requested). Two corrections:** (1) The "flake" is NOT a maxWorkers:3 determinism bug — **35/35 isolated runs passed** (npx + bunx, maxWorkers 3 and 5). It only failed during `git push` when the machine was CPU-saturated (load avg ~10 from back-to-back suites). So it's a **rare, load-dependent timing race** in the spawn-heavy integration tier, needing external CPU saturation to trigger — not reproducible at normal load. My earlier "~2/3 flake rate" was an artifact of 2 push-time samples. (2) **The CI block was a TIMEOUT, not a flake** — the `test` job (`timeout-minutes: 20`) was _cancelled_ at 20m13s at maxWorkers:1; sequential is too slow for the 2358-test suite + setup on the 4-vCPU `ubuntu-latest` runner. So maxWorkers:1 is a _guaranteed_ CI failure; the revert was backwards. **Resolution (`/figure-it-out` → option A):** re-set `maxWorkers: 3` (fits the 4-vCPU runner ~2.2×; CI is a dedicated runner with no competing load → the saturation-triggered race won't manifest) + raised CI `timeout-minutes` 20→30 for headroom. The proper two-tier fix (parallel pure-units + sequential spawn-tier) stays this ticket's real scope — it would also remove the residual saturation-race risk.
- 2026-06-24T05:51:10Z Issue #379: Started focused slice for concurrent `bun run --cwd packages/cli test ...` invocations racing in package `pretest`/`tsup` clean. Scope is the package test command only: serialize build+Vitest for separate focused command processes so parallel agent verification waits instead of false-reding.
- 2026-06-24T05:58:34Z Issue #379: Implemented package test runner lock around build+Vitest and removed the `pretest` lifecycle hook from `packages/cli` test. Verified with `tests/test-runner-lock.test.ts`, the originally observed two focused commands running concurrently (both 0), `bun run lint`, and `git diff --check`.
