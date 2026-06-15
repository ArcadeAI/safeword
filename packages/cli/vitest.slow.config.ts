import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base';

/**
 * Config for slow integration tests (real npm/bun installs).
 * Run with: bun vitest run --config vitest.slow.config.ts
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      env: {
        SAFEWORD_RUN_INSTALL_TESTS: '1',
      },
      include: [
        'tests/**/*.slow.test.ts',
        'tests/commands/setup-python.test.ts',
        'tests/commands/setup-golang.test.ts',
      ],
      testTimeout: 600_000,
    },
  }),
);
