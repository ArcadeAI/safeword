import defaultConfig from './vitest.config.ts';

/**
 * The turn-end fast lane: `test:done`, which the Stop hook runs under its 60 s cap.
 *
 * Spread rather than `mergeConfig`, which would concatenate `include` onto the default lane's.
 */
export default {
  ...defaultConfig,
  test: {
    ...defaultConfig.test,
    include: ['tests/hooks/**/*.test.ts', 'tests/schema.test.ts'],
  },
};
