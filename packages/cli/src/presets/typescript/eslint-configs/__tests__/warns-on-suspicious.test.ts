/**
 * Tests for ESLint rule severities - Story 5: Security Rules
 *
 * Verifies that security rules are at error severity (LLMs ignore warnings).
 * All security rules now at error - no distinction between "high confidence" and "advisory".
 */

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { recommended } from '../recommended.js';

const ERROR = 2;

const jsLinter = new Linter({ configType: 'flat' });

/**
 * Lint JS code and return messages for a specific rule.
 * @param code - Source code to lint
 * @param ruleId - Rule ID to filter for
 */
function lintJs(code: string, ruleId: string) {
  const results = jsLinter.verify(code, recommended, { filename: 'test.mjs' });
  return results.filter(r => r.ruleId === ruleId);
}

/**
 * Assert lint errors exist and first error has expected severity.
 * @param errors - Lint messages from lintJs
 * @param severity - Expected severity (default: ERROR)
 */
function expectLintError(errors: Linter.LintMessage[], severity: number = ERROR) {
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.at(0)?.severity).toBe(severity);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types vary across plugins */
/**
 * Get the final rule config from a flat config array.
 * @param config - Array of ESLint flat config objects
 * @param ruleId - Rule ID to find
 * @returns The rule configuration or undefined
 */
function getRuleConfig(config: any[], ruleId: string): unknown {
  for (let i = config.length - 1; i >= 0; i--) {
    const c = config[i];
    if (c && typeof c === 'object' && 'rules' in c && c.rules && Object.hasOwn(c.rules, ruleId)) {
      return c.rules[ruleId];
    }
  }
  return undefined;
}

/**
 * Assert a rule is configured at error severity in the config.
 * @param config - ESLint flat config array
 * @param ruleId - Rule ID to check
 */
function expectErrorSeverity(config: any[], ruleId: string): void {
  const ruleConfig = getRuleConfig(config, ruleId);
  expect(ruleConfig).toBeDefined();
  const severity = Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig;
  expect(severity === 'error' || severity === ERROR).toBe(true);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('Story 5: Security Rules at Error', () => {
  describe('all security rules at error severity (LLMs ignore warnings)', () => {
    it('security/detect-object-injection errors on bracket notation', () => {
      const code = `const key = 'prop';
const obj = { prop: 1 };
const value = obj[key];
export { value };
`;
      const errors = lintJs(code, 'security/detect-object-injection');
      expectLintError(errors);
    });

    it('security/detect-possible-timing-attacks is configured at error severity', () => {
      expectErrorSeverity(recommended, 'security/detect-possible-timing-attacks');
    });

    it('security/detect-buffer-noassert is configured at error severity', () => {
      expectErrorSeverity(recommended, 'security/detect-buffer-noassert');
    });

    it('security/detect-new-buffer is configured at error severity', () => {
      expectErrorSeverity(recommended, 'security/detect-new-buffer');
    });

    it('security/detect-pseudoRandomBytes is configured at error severity', () => {
      expectErrorSeverity(recommended, 'security/detect-pseudoRandomBytes');
    });
  });

  describe('confirms critical security rules also at error', () => {
    it('security/detect-eval-with-expression is error', () => {
      const code = `const userInput = 'code';
eval(userInput);
`;
      const errors = lintJs(code, 'security/detect-eval-with-expression');
      expectLintError(errors);
    });
  });
});
