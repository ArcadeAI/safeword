/**
 * The glob patterns safeword treats as test files for lint purposes: `*.test`/`*.spec`
 * files plus everything under `tests/` and `e2e/`. Shared by the test-runner configs
 * (the `bun:test` globals and the Vitest rules) so their file scope cannot drift apart —
 * a file that one treats as a test and the other doesn't would lint inconsistently.
 */
export const TEST_FILE_GLOBS = [
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}',
  '**/tests/**/*.{ts,tsx,js,jsx}',
  '**/e2e/**/*.{ts,tsx,js,jsx}',
] as const;
