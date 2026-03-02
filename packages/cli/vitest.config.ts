import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
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
    },
  }),
);
