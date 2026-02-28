import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Config for slow integration tests (real npm/bun installs).
 * Run with: bun vitest run --config vitest.slow.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
    },
    include: ['tests/**/*.slow.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 30_000,
    pool: 'forks',
    maxWorkers: 1,
  },
});
