/**
 * ESLint configuration for Vitest tests
 *
 * Applies to test files: *.test.ts, *.spec.ts
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
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
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
    },
  },
];
