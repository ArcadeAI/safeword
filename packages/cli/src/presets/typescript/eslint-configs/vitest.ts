/**
 * ESLint configuration for Vitest tests
 *
 * Applies to test files and test infrastructure:
 *   - *.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx
 *   - tests/** /*.ts (test helpers, fixtures, integration setup)
 *   - e2e/** /*.ts (end-to-end test infrastructure)
 *
 * Test infrastructure deliberately gets a laxer rule set than production
 * code — security rules target user-input attack surface that doesn't
 * exist in CI-only test runs, and common test patterns (throwaway
 * fixtures, describe-scoped helpers, regex-heavy assertions) trip
 * production-focused rules without finding real bugs.
 *
 * Enforces test best practices for LLM-generated tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import vitestPlugin from '@vitest/eslint-plugin';

/**
 * Vitest test linting config
 *
 * Includes recommended rules plus no-focused-tests.
 * All rules at error severity.
 */
export const vitestConfig: any[] = [
  {
    name: 'safeword/vitest',
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/tests/**/*.{ts,tsx,js,jsx}',
      '**/e2e/**/*.{ts,tsx,js,jsx}',
    ],
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      // Recommended rules (all at error)
      // Allow expect* helper functions (e.g., expectErrorSeverity) as assertion functions
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
      'vitest/no-identical-title': 'error',
      'vitest/no-commented-out-tests': 'error',
      'vitest/valid-title': 'error',
      'vitest/valid-expect': ['error', { maxArgs: 2 }], // Allow custom message: expect(value, 'message')
      'vitest/valid-describe-callback': 'error',
      'vitest/require-local-test-context-for-concurrent-snapshots': 'error',
      'vitest/no-import-node-test': 'error',

      // Additional strict rules
      'vitest/no-focused-tests': 'error', // No .only() in CI
      'vitest/max-nested-describe': ['error', { max: 5 }], // Limit describe nesting depth

      // Relax base rules for test files - each override has documented justification:
      //
      // no-empty-function: Tests often need empty callbacks for mocks/stubs:
      //   const mockFn = vi.fn(() => {});  // Valid mock with no implementation
      //   await expect(action).rejects.toThrow(); // Empty catch in expect wrapper
      '@typescript-eslint/no-empty-function': 'off',
      //
      // detect-non-literal-fs-filename: Tests read fixtures from known safe paths:
      //   const fixture = readFileSync(join(__dirname, 'fixtures', testCase.input));
      // Test fixtures are developer-controlled, not user input.
      'security/detect-non-literal-fs-filename': 'off',
      //
      // no-unsafe-* rules: Tests legitimately use partial mocks, fixtures, and stubs
      // that trigger these rules. The typescript-eslint team acknowledges this:
      // "If your project frequently stubs objects in test files, consider disabling."
      // See: https://typescript-eslint.io/rules/no-unsafe-member-access/
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      //
      // no-nested-functions: describe/it nesting is standard test organization:
      //   describe("Foo", () => { describe("bar", () => { it("works", () => {}) }) })
      // This triggers at level 4+, which is normal for BDD-style tests.
      'sonarjs/no-nested-functions': 'off',
      //
      // Keep max-nested-callbacks at reasonable threshold for tests.
      // Default is 10; we use 6 to catch excessive nesting early while allowing
      // typical patterns like: describe → it → array.filter → callback.
      'max-nested-callbacks': ['error', { max: 6 }],
      //
      // The block below was previously project-local to safeword's monorepo
      // (eslint.config.ts cli-tests-override) — promoted to the preset so
      // any safeword customer's tests get the same treatment. Each rule has a
      // documented test-code rationale:
      //
      // no-unused-vars (4 variants): test fixtures intentionally hold setup
      // values that aren't asserted on (const _r = await call(); expect(spy)...)
      // and discard destructured returns (const { ignored, ...rest } = x;).
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/no-dead-store': 'off',
      'sonarjs/unused-import': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      //
      // slow-regex + detect-unsafe-regex: ReDoS rules target user-input
      // attack surface. Test regexes run on test-controlled inputs in
      // short-lived CI processes — not a real threat. Forcing tests
      // to refactor every chained-quantifier regex produces no security
      // value and degrades test readability.
      'sonarjs/slow-regex': 'off',
      'security/detect-unsafe-regex': 'off',
      //
      // no-dupe-disjunctions: tests intentionally use duplicate regex
      // alternatives for readability (/^(foo|foo-bar)/ — explicit about
      // both matched cases).
      'regexp/no-dupe-disjunctions': 'off',
      //
      // assertions-in-tests: false-positives on vitest's expect() patterns
      // when assertions live in helper functions (e.g., expectErrorMessage).
      'sonarjs/assertions-in-tests': 'off',
      //
      // consistent-function-scoping: describe-block-scoped helpers are the
      // standard test-organization pattern; hoisting them to file scope
      // fragments the test for marginal benefit.
      'unicorn/consistent-function-scoping': 'off',
      //
      // no-array-callback-reference: test helpers use method references
      // (expect(arr.map(toIdString))) for clarity.
      'unicorn/no-array-callback-reference': 'off',
      //
      // publicly-writable-directories: tests legitimately use os.tmpdir()
      // and /tmp for sandboxed-execution fixtures. The threat-model
      // assumption (other processes can clobber) is fine for short-lived
      // test runs.
      'sonarjs/publicly-writable-directories': 'off',
      //
      // no-alphabetical-sort: tests sort arrays for deterministic assertion
      // ordering (expect(files.sort()).toEqual(...)) — not a code-smell
      // in test contexts.
      'sonarjs/no-alphabetical-sort': 'off',
    },
  },
];
