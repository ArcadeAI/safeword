import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Shared vitest settings for all test configs.
 * Import and merge via: mergeConfig(baseConfig, defineConfig({ ... }))
 */
export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Ensure the runtime binary directory is in PATH for child processes
    // (e.g. bunx, bun) so execSync calls in tests can find them.
    // Also force commit.gpgsign=false for every git invocation: tests create
    // throwaway repos in /tmp and must be hermetic — they must not inherit a
    // host that enforces commit signing (e.g. a managed env that signs via a
    // server), which otherwise fails every test `git commit` with a signing error.
    env: {
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'commit.gpgsign',
      GIT_CONFIG_VALUE_0: 'false',
    },
    // Hook timeout must contain the slowest *legitimate* hook: a `safeword setup`
    // spawned in a `beforeAll` via setupOrThrow, which does real work (git init,
    // scaffolding, tool detection, optional skills pull) and retries ONCE on a
    // wall-clock timeout under machine contention (issue #419). Worst case is
    // 2 × the 120s per-attempt setup timeout; 300s adds slack (= TIMEOUT_SETUP_HOOK).
    // Raising the DEFAULT — rather than a budget per beforeAll — means every
    // setup-in-beforeAll inherits the headroom with no per-hook override to forget
    // or mis-size. Suites doing MULTIPLE setups in one hook (bdd-lane) still set a
    // larger explicit budget. Was 30_000 — itself raised from 10s for afterEach
    // rmSync-with-retries cleanup, which still fits comfortably.
    hookTimeout: 300_000,
    // 3 workers (of the 4-vCPU ubuntu-latest runner). maxWorkers:1 timed the CI
    // `test` job out (20-min cap) — sequential is too slow for the full suite +
    // setup. The spawn-heavy integration tier can lose a timing race under CPU
    // *saturation* (seen locally during back-to-back suites at load ~10; NOT
    // reproducible in 35 isolated runs), but a dedicated CI runner has no
    // competing load. Bounding that race properly (two-tier pools) is CQJBSN.
    pool: 'forks',
    maxWorkers: 3,
  },
});
