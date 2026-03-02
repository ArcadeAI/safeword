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
    // Run tests sequentially to avoid temp directory conflicts
    pool: 'forks',
    maxWorkers: 1,
  },
});
