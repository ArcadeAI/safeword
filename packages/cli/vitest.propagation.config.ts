import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.base.js';

/** Explicit required-target resource component; never an implicit model smoke. */
export default mergeConfig(
  baseConfig,
  defineConfig({ test: { include: ['tests/host-contract/propagation.live.test.ts'] } }),
);
