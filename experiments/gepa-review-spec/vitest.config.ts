// Plain-object config — intentionally no `import 'vitest/config'` so the config
// loads without resolving vitest from this (non-workspace) directory. `globals`
// injects describe/it/expect, so the test files need no `vitest` import either.
// Run from repo root: bun run --cwd experiments/gepa-review-spec test
export default {
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
};
