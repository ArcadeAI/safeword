/**
 * ESLint configuration for Playwright e2e tests
 *
 * Applies ONLY to e2e test files to avoid conflicts with vitest:
 * - *.e2e.ts files (explicit e2e naming)
 * - Files in e2e/ directories
 *
 * Does NOT apply to regular *.test.ts files (those are vitest).
 *
 * All rules escalated to error (LLMs ignore warnings).
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import playwrightPlugin from 'eslint-plugin-playwright';

/**
 * Playwright e2e test linting config
 *
 * Based on recommended config with all warns escalated to error.
 *
 * File patterns target only e2e tests to avoid vitest conflicts:
 * - Explicit e2e suffix (e.g., login.e2e.ts)
 * - Test/spec files in e2e directories only
 */
export const playwrightConfig: any[] = [
  {
    name: 'safeword/playwright',
    files: ['**/*.e2e.{ts,tsx,js,jsx}', '**/e2e/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    plugins: {
      playwright: playwrightPlugin,
    },
    rules: {
      // From recommended - already at error
      'playwright/missing-playwright-await': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-standalone-expect': 'error',
      'playwright/no-unsafe-references': 'error',
      'playwright/no-unused-locators': 'error',
      'playwright/no-wait-for-navigation': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/valid-describe-callback': 'error',
      'playwright/valid-expect': 'error',
      'playwright/valid-expect-in-promise': 'error',
      'playwright/valid-test-tags': 'error',
      'playwright/valid-title': 'error',

      // Escalated from warn to error (LLMs ignore warnings)
      'playwright/expect-expect': 'error',
      'playwright/max-nested-describe': 'error',
      'playwright/no-conditional-expect': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-element-handle': 'error',
      'playwright/no-eval': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-nested-step': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-useless-await': 'error',
      'playwright/no-useless-not': 'error',
      'playwright/no-wait-for-selector': 'error',
      'playwright/no-wait-for-timeout': 'error',

      'playwright/no-skipped-test': 'error',

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
      // no-unsafe-* rules: Tests legitimately use partial mocks, fixtures, and stubs.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      //
      // no-nested-functions: Test organization uses nested describe/it patterns.
      'sonarjs/no-nested-functions': 'off',
      //
      // no-null: Playwright API explicitly uses null in signatures:
      //   await page.waitForFunction(() => window.loaded, null, { timeout: 5000 });
      // See: https://playwright.dev/docs/api/class-page#page-wait-for-function
      'unicorn/no-null': 'off',
    },
  },
];
