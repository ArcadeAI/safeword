import defaultConfig from './vitest.config.ts';

/**
 * Hook suites too heavy for the turn-end lane. Measured at load ~6 (ticket 96WAFM) they took
 * ~120 s of the lane's ~190 s of work, so the lane missed the Stop hook's 60 s cap even when
 * every test passed. They still run in the default `test` lane, which CI runs on every PR.
 */
const FULL_LANE_ONLY = [
  // 94 cases, each spawning the hook through bun against a fresh git repo: ~57 s on its own.
  'tests/hooks/pre-tool-architecture-stage.test.ts',
  // Real Go and golangci-lint; CI also runs it in the dedicated Go job.
  'tests/hooks/lint-go-context.test.ts',
  // A bun helper process plus git fixture commits per case: ~18 s.
  'tests/hooks/resolve-verify-ticket.test.ts',
  // A bun process per lint module and language case: ~13 s.
  'tests/hooks/lint-config-fallback.test.ts',
  // The post-edit lint hook spawned through bun per non-JS language: ~11 s.
  'tests/hooks/post-edit-other-languages.test.ts',
];

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
    exclude: [...(defaultConfig.test?.exclude ?? []), ...FULL_LANE_ONLY],
  },
};
