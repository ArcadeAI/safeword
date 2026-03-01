import { defineConfig } from 'vitest/config';

import { baseTestConfig } from './vitest.base';

/**
 * Config for slow integration tests (real npm/bun installs).
 * Run with: bun vitest run --config vitest.slow.config.ts
 */
export default defineConfig({
  test: {
    ...baseTestConfig,
    include: ['tests/**/*.slow.test.ts'],
    testTimeout: 600_000,
  },
});
