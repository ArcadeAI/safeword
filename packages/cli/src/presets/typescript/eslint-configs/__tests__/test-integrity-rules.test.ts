/**
 * Tests for the graduated test-integrity + no-sleep lint rules (ticket VFD6X1,
 * issue #773 — enforce-then-trim of testing-guide.md's prose invariants).
 *
 * Config pins prove the rules ship in the vitest lane; functional Linter runs
 * prove each restricted-syntax selector flags the forbidden idiom and stays
 * silent on the sanctioned neighbors (skipIf-conditional tests, fake-timer
 * setTimeout, sleep idioms inside template-string fixtures).
 */

import vitestPlugin from '@vitest/eslint-plugin';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { vitestConfig } from '../vitest.js';
import { getRuleConfig, getSeverityNumber } from './test-utilities.js';

const ERROR = 2;

/** Lint a snippet with only the vitest-lane rule under test. */
function messagesFor(code: string, rules: Record<string, unknown>): Linter.LintMessage[] {
  const linter = new Linter();
  return linter.verify(code, {
    plugins: { vitest: vitestPlugin },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: rules as Linter.RulesRecord,
  });
}

/** The vitest lane's no-restricted-syntax entry (severity + selectors). */
function restrictedSyntaxRule(): unknown {
  return getRuleConfig(vitestConfig, 'no-restricted-syntax');
}

describe('Test-integrity rules ship in the vitest lane (VFD6X1)', () => {
  it('vitest/no-disabled-tests is at error', () => {
    expect(getSeverityNumber(getRuleConfig(vitestConfig, 'vitest/no-disabled-tests'))).toBe(ERROR);
  });

  it('no-restricted-syntax is at error with the sleep/todo selectors', () => {
    const rule = restrictedSyntaxRule() as [string, ...{ selector: string }[]];
    expect(getSeverityNumber(rule)).toBe(ERROR);
    const selectors = rule.slice(1).map(entry => (entry as { selector: string }).selector);
    // One selector per forbidden idiom family: awaited Promise+setTimeout,
    // Bun.sleep, bare sleep(), and the deferred-test marker.
    expect(selectors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('no-disabled-tests: unconditional skips flag, conditional skips stay legal', () => {
  const RULES = { 'vitest/no-disabled-tests': 'error' };

  it.each([
    ['it.skip', `it.skip('later', () => {});`],
    ['describe.skip', `describe.skip('later', () => {});`],
    ['xit', `xit('later', () => {});`],
  ])('flags %s', (_name, code) => {
    expect(messagesFor(code, RULES).length).toBeGreaterThan(0);
  });

  it('does NOT flag environment-conditional skipIf', () => {
    const code = `it.skipIf(!process.env.RUFF)('needs ruff', () => {});`;
    expect(messagesFor(code, RULES)).toEqual([]);
  });
});

describe('no-restricted-syntax: sleep idioms flag, sanctioned neighbors stay legal', () => {
  function sleepMessages(code: string): Linter.LintMessage[] {
    return messagesFor(code, { 'no-restricted-syntax': restrictedSyntaxRule() });
  }

  it.each([
    ['awaited Promise+setTimeout sleep', `await new Promise(r => setTimeout(r, 500));`],
    ['Bun.sleep', `await Bun.sleep(100);`],
    ['bare sleep()', `await sleep(500);`],
    ['it.todo', `it.todo('write this later');`],
    ['test.todo', `test.todo('write this later');`],
  ])('flags %s', (_name, code) => {
    expect(sleepMessages(code).length).toBeGreaterThan(0);
  });

  it.each([
    ['polling via expect.poll', `await expect.poll(() => getStatus()).toBe('ready');`],
    ['fake-timer setTimeout (not awaited-promise idiom)', `setTimeout(tick, 100);`],
    [
      'sleep idiom inside a template-string fixture',
      'const fixture = `await new Promise(r => setTimeout(r, 120));`;',
    ],
    ['a variable named sleep', `const sleep = readConfig(); use(sleep);`],
  ])('does NOT flag %s', (_name, code) => {
    expect(sleepMessages(code)).toEqual([]);
  });
});
