import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Ensure the runtime binary directory is in PATH for child processes
    // (e.g. bunx, bun) so execSync calls in tests can find them
    env: {
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
    },
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Slow tests (real npm installs) excluded by default.
    // Run with: bun vitest run --config vitest.slow.config.ts
    exclude: ['tests/**/*.slow.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
    // Increase timeout for integration tests that spawn processes
    // Default 30s isn't enough for bun installs in some tests
    testTimeout: 60_000,
    // Increase hook timeout for afterEach cleanup (rmSync with retries)
    // Default 10s isn't enough when bun has locked files
    hookTimeout: 30_000,
    // Run tests sequentially to avoid temp directory conflicts
    pool: 'forks',
    maxWorkers: 1,
  },
});
