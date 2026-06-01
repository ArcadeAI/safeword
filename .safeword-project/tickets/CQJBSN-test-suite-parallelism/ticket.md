---
id: CQJBSN
slug: test-suite-parallelism
type: task
phase: intake
status: backlog
created: 2026-06-01T01:03:41.848Z
last_modified: 2026-06-01T01:03:41.848Z
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
- 2026-06-01T15:05:00.000Z **Reverted to `maxWorkers: 1`.** The 3-worker bump flaked the pre-push schema gate ~2/3 runs (`1 failed | 575 passed`, transient — passed on isolated rerun). Key evidence for this ticket: **the flake is NOT shared-temp-dir** — the gate tests (golden-path, skills-commands-validation, setup-hooks, reset-reconcile) all use unique `createTemporaryDirectory()` = `mkdtempSync`. So the contention is **process/resource-level** (concurrent `runCli`/setup subprocess spawns, file locks, or rmSync EBUSY under load), not path collisions. That reframes the audit: the fix isn't "give each test a unique dir" (already done) but bounding concurrent subprocess spawns — e.g. a separate sequential `pool` project for the spawn-heavy integration tier, parallel threads for pure units (the two-tier option). Full suite still passed at 3, so the flake is concurrency-timing in the spawn tier specifically. Reverted for release stability (v0.40.0); real fix stays here.
