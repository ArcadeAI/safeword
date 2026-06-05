import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base';

/**
 * Config for the live real-model smoke (ticket 0WQA9V). Spawns a real Claude
 * Code agent, so it spends tokens and needs a claude >= 2.x binary +
 * ANTHROPIC_API_KEY (the test itself skips when those are absent).
 * Run with: bun run test:smoke:live
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.live.test.ts'],
      testTimeout: 180_000,
    },
  }),
);
