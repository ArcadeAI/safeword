import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
      // Slow tests (real npm installs) and the live real-model smoke
      // (`*.live.test.ts`, spends tokens, needs claude + ANTHROPIC_API_KEY)
      // are excluded by default. Run via test:smoke / test:smoke:live.
      exclude: ['tests/**/*.slow.test.ts', 'tests/**/*.release.test.ts', 'tests/**/*.live.test.ts'],
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
