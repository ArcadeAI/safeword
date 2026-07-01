/**
 * ESLint configuration for Bun's built-in test runner (`bun:test`)
 *
 * Bun's transpiler injects `describe`/`test`/`expect`/etc. into test files
 * without requiring an explicit `import ... from "bun:test"` — officially
 * supported by Bun, not a customer mistake (see
 * https://bun.com/docs/test). ESLint lints the untranspiled source, so it
 * can't see that injection and flags the names as undefined.
 *
 * TypeScript files already tolerate this: typescript-eslint's
 * `eslint-recommended` override turns core `no-undef` off for .ts/.tsx,
 * deferring to the type checker. Plain .js/.jsx Bun test files have no such
 * override, so `no-undef` still fires there — this config declares the
 * exact `bun:test` export surface as known globals to close that gap
 * (ticket #513), scoped to test files only since Bun's injection doesn't
 * reach imported helper files either.
 */

/**
 * `bun:test` global names, all read-only (Bun owns these bindings).
 * Mirrors `bun:test`'s actual exports (verified against
 * https://github.com/oven-sh/bun/blob/main/packages/bun-types/test.d.ts and
 * https://bun.com/reference/bun/test) — not Jest's. Bun ships `xdescribe`/
 * `xtest`/`xit` as `.skip()` shorthands, but has no `fit` (focus) alias —
 * use `.only` on `test`/`describe`/`it` instead. Declaring a name Bun
 * doesn't actually inject would let a typo pass lint only to crash at
 * runtime.
 */
const BUN_TEST_GLOBALS = {
  test: 'readonly',
  it: 'readonly',
  xtest: 'readonly',
  xit: 'readonly',
  describe: 'readonly',
  xdescribe: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
  onTestFinished: 'readonly',
  setDefaultTimeout: 'readonly',
  expect: 'readonly',
  expectTypeOf: 'readonly',
  mock: 'readonly',
  spyOn: 'readonly',
  jest: 'readonly',
  setSystemTime: 'readonly',
  vi: 'readonly',
} as const;

/**
 * Bun test global declarations.
 *
 * Same file scope as `vitestConfig` — both gate on their own detection
 * function, so this only applies when `detect.hasBunTest` is true.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages
export const bunTestConfig: any[] = [
  {
    name: 'safeword/bun-test',
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/tests/**/*.{ts,tsx,js,jsx}',
      '**/e2e/**/*.{ts,tsx,js,jsx}',
    ],
    languageOptions: {
      globals: BUN_TEST_GLOBALS,
    },
  },
];
