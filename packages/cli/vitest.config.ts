import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
      // Slow files (`*.slow.test.ts`) and live real-model smoke
      // (`*.live.test.ts`, spends tokens, needs claude + ANTHROPIC_API_KEY)
      // are excluded by default. Real install-proof scenarios are guarded by
      // SAFEWORD_RUN_INSTALL_TESTS and run through test:slow.
      // Run via test:slow / test:smoke / test:smoke:live as needed.
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
