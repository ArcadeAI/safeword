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
    // (e.g. bunx, bun) so execSync calls in tests can find them
    env: {
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
    },
    // Increase hook timeout for afterEach cleanup (rmSync with retries)
    // Default 10s isn't enough when bun has locked files
    hookTimeout: 30_000,
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
