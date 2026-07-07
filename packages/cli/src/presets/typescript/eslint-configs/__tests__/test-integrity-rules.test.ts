/**
 * Tests for the graduated test-integrity + no-sleep lint rules (ticket VFD6X1,
 * issue #773 — enforce-then-trim of testing-guide.md's prose invariants; the
 * deferred-marker coverage hardened after a quality review verified the
 * chained `it.concurrent` bypass of the original direct-only selector).
 *
 * Config pins prove the rules ship in both test lanes; functional Linter runs
 * prove each rule/selector flags the forbidden idiom and stays silent on the
 * sanctioned neighbors (skipIf-conditional tests, fake-timer setTimeout,
 * sleep idioms inside template-string fixtures, non-test deferred members).
 */

import vitestPlugin from '@vitest/eslint-plugin';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { bunTestConfig } from '../bun-test.js';
import { vitestConfig } from '../vitest.js';
import { getRuleConfig, getSeverityNumber } from './test-utilities.js';

const ERROR = 2;

/** Lint a snippet with only the rule under test. */
function messagesFor(code: string, rules: Record<string, unknown>): Linter.LintMessage[] {
  const linter = new Linter();
  return linter.verify(code, {
    plugins: { vitest: vitestPlugin },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: rules as Linter.RulesRecord,
  });
}

/** A lane's no-restricted-syntax entry (severity + selectors). */
function restrictedSyntaxRule(config: unknown[]): unknown {
  return getRuleConfig(config, 'no-restricted-syntax');
}

describe('Test-integrity rules ship in the vitest lane (VFD6X1)', () => {
  it('vitest/no-disabled-tests is at error', () => {
    expect(getSeverityNumber(getRuleConfig(vitestConfig, 'vitest/no-disabled-tests'))).toBe(ERROR);
  });

  it('vitest/warn-todo is at error (plugin rule — covers chained modifiers)', () => {
    expect(getSeverityNumber(getRuleConfig(vitestConfig, 'vitest/warn-todo'))).toBe(ERROR);
  });

  it('no-restricted-syntax is at error with the sleep selectors', () => {
    const rule = restrictedSyntaxRule(vitestConfig) as [string, ...{ selector: string }[]];
    expect(getSeverityNumber(rule)).toBe(ERROR);
    const selectors = rule.slice(1).map(entry => (entry as { selector: string }).selector);
    // One selector per sleep-idiom family: awaited Promise+setTimeout,
    // Bun.sleep, bare sleep().
    expect(selectors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Test-integrity rules ship in the bun:test lane (review hardening)', () => {
  it('no-restricted-syntax is at error with sleep + deferred-marker selectors', () => {
    const rule = restrictedSyntaxRule(bunTestConfig) as [string, ...{ selector: string }[]];
    expect(getSeverityNumber(rule)).toBe(ERROR);
    const selectors = rule.slice(1).map(entry => (entry as { selector: string }).selector);
    expect(selectors.length).toBeGreaterThanOrEqual(4);
  });

  it('flags direct and chained deferred markers, not non-test members', () => {
    const rules = { 'no-restricted-syntax': restrictedSyntaxRule(bunTestConfig) };
    expect(messagesFor(`it.todo('later');`, rules).length).toBeGreaterThan(0);
    expect(messagesFor(`it.concurrent.todo('later');`, rules).length).toBeGreaterThan(0);
    expect(messagesFor(`myQueue.todo('item');`, rules)).toEqual([]);
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

describe('warn-todo: deferred markers flag in every form', () => {
  const RULES = { 'vitest/warn-todo': 'error' };

  it.each([
    ['it.todo', `it.todo('write this later');`],
    ['test.todo', `test.todo('write this later');`],
    ['describe.todo', `describe.todo('write this later');`],
    // The chained form was a verified bypass of the direct-only selector this
    // plugin rule replaced (quality review, 2026-07-07).
    ['it.concurrent.todo', `it.concurrent.todo('write this later');`],
  ])('flags %s', (_name, code) => {
    expect(messagesFor(code, RULES).length).toBeGreaterThan(0);
  });
});

describe('no-restricted-syntax: sleep idioms flag, sanctioned neighbors stay legal', () => {
  function sleepMessages(code: string): Linter.LintMessage[] {
    return messagesFor(code, { 'no-restricted-syntax': restrictedSyntaxRule(vitestConfig) });
  }

  it.each([
    ['awaited Promise+setTimeout sleep', `await new Promise(r => setTimeout(r, 500));`],
    ['Bun.sleep', `await Bun.sleep(100);`],
    ['bare sleep()', `await sleep(500);`],
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
