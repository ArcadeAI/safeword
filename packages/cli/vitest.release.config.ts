import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base';

/**
 * Config for release-gate tests (dogfood parity, distribution checks).
 * Run with: bun run test:release
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.release.test.ts'],
    },
  }),
);
