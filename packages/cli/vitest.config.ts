import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import { defaultVitestExclude, defaultVitestInclude } from '../../vitest.default-projects.js';
import { baseConfig } from './vitest.base.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: defaultVitestInclude('packages/cli'),
      // Slow files (`*.slow.test.ts`) and live real-model smoke
      // (`*.live.test.ts`, spends tokens, needs claude + ANTHROPIC_API_KEY)
      // are excluded by default. Some install proofs in shared files are gated
      // by SAFEWORD_RUN_INSTALL_TESTS; dedicated install proofs use the slow
      // filename lane. CI runs the focused non-git proof via
      // test:slow:install-proof. Run broader validation via test:smoke,
      // test:smoke:live, test:slow, or test:release as needed.
      exclude: [...configDefaults.exclude, ...defaultVitestExclude('packages/cli')],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/index.ts'],
      },
      // Increase timeout for integration tests that spawn processes
      // Vitest's default 5s isn't enough for bun installs in some tests
      testTimeout: 60_000,
    },
  }),
);
