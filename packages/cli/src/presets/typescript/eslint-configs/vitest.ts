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

import { TEST_FILE_GLOBS } from './test-file-globs.js';
import { SLEEP_RESTRICTED_SYNTAX } from './test-integrity-syntax.js';

/**
 * Vitest test linting config
 *
 * Includes recommended rules plus no-focused-tests.
 * All rules at error severity.
 */
export const vitestConfig: any[] = [
  {
    name: 'safeword/vitest',
    files: [...TEST_FILE_GLOBS],
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

      // Test-integrity graduation (VFD6X1, #773): testing-guide.md's "never
      // skip/park tests without approval" invariant, lint-owned. Unconditional
      // skips (it.skip, xit, xdescribe) need an inline eslint-disable with a
      // reason — that comment IS the auditable approval artifact. Environment-
      // conditional skipIf/runIf stay legal (the rule doesn't match them).
      'vitest/no-disabled-tests': 'error',

      // Deferred-test marker (review hardening of VFD6X1): the plugin rule —
      // NOT a custom selector — because it also catches chained modifiers
      // (it.concurrent + marker), a verified bypass of the direct-only
      // selector this replaced. The plugin docs suggest warn severity; error-
      // with-disable-comment is deliberately safeword's policy (LLMs ignore
      // warnings, and the disable comment is the auditable approval).
      'vitest/warn-todo': 'error',

      // No-arbitrary-sleep graduation (VFD6X1, #773): the guide's "poll, never
      // sleep" rule for the vitest lane (the playwright lane already has
      // no-wait-for-timeout). Shared selectors — see test-integrity-syntax.ts
      // for the idiom list and its documented accepted false positive.
      'no-restricted-syntax': ['error', ...SLEEP_RESTRICTED_SYNTAX],

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
      //
      // parameterized-tests (new in sonarjs 4.2.0's recommended set): demands
      // repetitive similar cases collapse into one it.each table. That is a
      // readability *preference*, not a correctness rule — explicit separate
      // cases keep a failure pointing at the exact scenario, which we value over
      // table density. Enforcing it at error-level would force a large,
      // mechanical rewrite of customer test suites for no correctness gain.
      'sonarjs/parameterized-tests': 'off',
      //
      // explicit-test-skip (new in sonarjs 4.2.0's recommended set): flags a
      // guard that `return`s early instead of calling ctx.skip(). Our
      // data-driven validation tests use `if (!precondition) return` for
      // conditional applicability; whether that reads better as ctx.skip() is a
      // style call, not a test-quality gate we impose on customer suites. (The
      // handful of internal early-return guards are tracked for a separate
      // assert-or-skip tightening pass — off here is not an endorsement of
      // vacuous passes.)
      'sonarjs/explicit-test-skip': 'off',
    },
  },
];
