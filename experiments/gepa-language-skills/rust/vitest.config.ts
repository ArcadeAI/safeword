// Plain-object config — intentionally no `import 'vitest/config'` so the config
// loads without resolving vitest from this non-workspace experiment directory.
// Run from repo root: bun run --cwd experiments/gepa-language-skills/rust test
export default {
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
};
