/**
 * Tests for React ESLint config - Story 7: React Support
 *
 * Verifies that the React config:
 * - Loads without errors
 * - Includes @eslint-react, react-hooks, and jsx-a11y plugins
 * - Has correct rule severities configured
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { recommendedTypeScriptReact } from '../recommended-react.js';
import { getAllRules, getRuleConfig, getSeverityNumber } from './test-utilities.js';

// JSX fixtures below embed `{expr}` JSX braces inside template-literal source
// strings. unicorn/no-incorrect-template-string-interpolation reads these as
// missed `${expr}` interpolation, but they are intentional React source under
// test — interpolating them would change the fixtures and break the assertions.
/* eslint-disable unicorn/no-incorrect-template-string-interpolation -- JSX braces in fixture source, not interpolation */

const ERROR = 2;
const WARN = 1;
const REACT_SAMPLE_FILENAME = fileURLToPath(new URL('react-sample.tsx', import.meta.url));

async function readCliPackageJson(): Promise<{
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}> {
  const packageJsonUrl = new URL('../../../../../package.json', import.meta.url);
  return JSON.parse(await readFile(packageJsonUrl, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

async function readReactPresetSource(): Promise<string> {
  return readFile(new URL('../recommended-react.ts', import.meta.url), 'utf8');
}

function lintReactCode(code: string, linter = new Linter({ configType: 'flat' })) {
  return linter.verify(code, recommendedTypeScriptReact, {
    filename: REACT_SAMPLE_FILENAME,
  });
}

function expectReactRuleError(ruleId: string, code: string): void {
  const errors = lintReactCode(code).filter(message => message.ruleId === ruleId);

  expect(errors.length).toBeGreaterThan(0);
  expect(errors.at(0)?.severity).toBe(ERROR);
}

function hasPlugin(pluginName: string): boolean {
  return recommendedTypeScriptReact.some(
    config =>
      typeof config === 'object' &&
      config !== null &&
      'plugins' in config &&
      config.plugins &&
      Object.hasOwn(config.plugins, pluginName),
  );
}

describe('recommendedTypeScriptReact config', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(recommendedTypeScriptReact)).toBe(true);
    expect(recommendedTypeScriptReact.length).toBeGreaterThan(0);
  });

  it('includes @eslint-react plugin', () => {
    expect(hasPlugin('@eslint-react')).toBe(true);
  });

  it('does not include legacy eslint-plugin-react', () => {
    expect(hasPlugin('react')).toBe(false);
  });

  it('includes react-hooks plugin', () => {
    expect(hasPlugin('react-hooks')).toBe(true);
  });

  it('package dependencies replace eslint-plugin-react with @eslint-react/eslint-plugin', async () => {
    const packageJson = await readCliPackageJson();

    expect(packageJson.dependencies).toHaveProperty('@eslint-react/eslint-plugin');
    expect(packageJson.dependencies).not.toHaveProperty('eslint-plugin-react');
  });

  it('React preset source does not import eslint-plugin-react', async () => {
    const source = await readReactPresetSource();

    expect(source).not.toMatch(/from ['"]eslint-plugin-react['"]/u);
  });
});

describe('React hook rules (config severity)', () => {
  it('react-hooks/rules-of-hooks is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, 'react-hooks/rules-of-hooks');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('react-hooks/exhaustive-deps is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, 'react-hooks/exhaustive-deps');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('keeps official react-hooks rules authoritative over @eslint-react hook equivalents', () => {
    const eslintReactHookRuleIds = [
      '@eslint-react/error-boundaries',
      '@eslint-react/exhaustive-deps',
      '@eslint-react/purity',
      '@eslint-react/rules-of-hooks',
      '@eslint-react/set-state-in-effect',
      '@eslint-react/set-state-in-render',
      '@eslint-react/static-components',
      '@eslint-react/unsupported-syntax',
      '@eslint-react/use-memo',
    ];

    for (const ruleId of eslintReactHookRuleIds) {
      expect(getSeverityNumber(getRuleConfig(recommendedTypeScriptReact, ruleId))).toBe(0);
    }
  });

  it('reports hook violations once from eslint-plugin-react-hooks', () => {
    const messages = lintReactCode(`
import { useState } from 'react';

export function Counter({ enabled }: { enabled: boolean }) {
  if (enabled) {
    useState(0);
  }

  return null;
}
`);
    const ruleIds = messages.map(message => message.ruleId);

    expect(ruleIds).toContain('react-hooks/rules-of-hooks');
    expect(ruleIds).not.toContain('@eslint-react/rules-of-hooks');
  });
});

describe('React JSX rules (config severity)', () => {
  it('@eslint-react/no-missing-key is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, '@eslint-react/no-missing-key');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('@eslint-react/no-duplicate-key is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, '@eslint-react/no-duplicate-key');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('@eslint-react/no-direct-mutation-state is at error severity', () => {
    const config = getRuleConfig(
      recommendedTypeScriptReact,
      '@eslint-react/no-direct-mutation-state',
    );
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('@eslint-react/jsx-no-children-prop is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, '@eslint-react/jsx-no-children-prop');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('@eslint-react/dom-no-unsafe-target-blank is at error severity', () => {
    const config = getRuleConfig(
      recommendedTypeScriptReact,
      '@eslint-react/dom-no-unsafe-target-blank',
    );
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('@eslint-react/dom-no-unknown-property is at error severity', () => {
    const config = getRuleConfig(
      recommendedTypeScriptReact,
      '@eslint-react/dom-no-unknown-property',
    );
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('does not keep legacy react/* rules enabled', () => {
    const legacyRuleIds = [
      'react/jsx-key',
      'react/jsx-no-duplicate-props',
      'react/no-direct-mutation-state',
      'react/no-children-prop',
      'react/jsx-no-target-blank',
      'react/no-unknown-property',
      'react/no-unescaped-entities',
    ];

    for (const ruleId of legacyRuleIds) {
      expect(getRuleConfig(recommendedTypeScriptReact, ruleId)).toBeUndefined();
    }
  });
});

describe('React JSX rules (lint behavior)', () => {
  it('reports missing JSX keys as errors', () => {
    expectReactRuleError(
      '@eslint-react/no-missing-key',
      `
const items = [{ id: 'a' }];
export function List() {
  return <ul>{items.map(item => <li>{item.id}</li>)}</ul>;
}
`,
    );
  });

  it('reports duplicate list keys as errors', () => {
    expectReactRuleError(
      '@eslint-react/no-duplicate-key',
      `
export function List() {
  return (
    <ul>
      <li key="same">A</li>
      <li key="same">B</li>
    </ul>
  );
}
`,
    );
  });

  it('reports direct state mutation as an error', () => {
    expectReactRuleError(
      '@eslint-react/no-direct-mutation-state',
      `
import React from 'react';

export class Counter extends React.Component<object, { count: number }> {
  state = { count: 0 };

  increment() {
    this.state.count = this.state.count + 1;
  }

  render() {
    return <button onClick={() => this.increment()}>{this.state.count}</button>;
  }
}
`,
    );
  });

  it('reports children passed as a prop as an error', () => {
    expectReactRuleError(
      '@eslint-react/jsx-no-children-prop',
      `
export function Panel({ children }: { children: unknown }) {
  return <div children={children} />;
}
`,
    );
  });

  it('reports unsafe target blank links as errors', () => {
    expectReactRuleError(
      '@eslint-react/dom-no-unsafe-target-blank',
      `
export function Link() {
  return <a href="https://example.com" target="_blank">Open</a>;
}
`,
    );
  });

  it('reports unknown DOM properties as errors', () => {
    expectReactRuleError(
      '@eslint-react/dom-no-unknown-property',
      `
export function Message() {
  return <div class="notice">Saved</div>;
}
`,
    );
  });
});

describe('React JSX parity gaps', () => {
  it('does not silently claim duplicate JSX prop parity', () => {
    expect(
      getRuleConfig(recommendedTypeScriptReact, 'react/jsx-no-duplicate-props'),
    ).toBeUndefined();
    expect(
      getRuleConfig(recommendedTypeScriptReact, '@eslint-react/jsx-no-duplicate-props'),
    ).toBeUndefined();
  });

  it('does not silently claim unescaped entity parity', () => {
    expect(
      getRuleConfig(recommendedTypeScriptReact, 'react/no-unescaped-entities'),
    ).toBeUndefined();
    expect(
      getRuleConfig(recommendedTypeScriptReact, '@eslint-react/no-unescaped-entities'),
    ).toBeUndefined();
  });
});

describe('Accessibility rules (jsx-a11y)', () => {
  it('includes jsx-a11y plugin', () => {
    expect(hasPlugin('jsx-a11y')).toBe(true);
  });

  it('jsx-a11y/alt-text is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, 'jsx-a11y/alt-text');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('jsx-a11y/anchor-is-valid is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, 'jsx-a11y/anchor-is-valid');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('jsx-a11y/aria-role is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, 'jsx-a11y/aria-role');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });

  it('jsx-a11y/no-autofocus is at error severity', () => {
    const config = getRuleConfig(recommendedTypeScriptReact, 'jsx-a11y/no-autofocus');
    expect(getSeverityNumber(config)).toBe(ERROR);
  });
});

describe('No warnings allowed for React guardrails', () => {
  it('keeps React-family rules out of warn severity', () => {
    const reactFamilyRules = Object.entries(getAllRules(recommendedTypeScriptReact)).filter(
      ([ruleId]) =>
        ruleId.startsWith('@eslint-react/') ||
        ruleId.startsWith('react-hooks/') ||
        ruleId.startsWith('jsx-a11y/'),
    );

    const rulesAtWarn = reactFamilyRules
      .filter(([, ruleConfig]) => getSeverityNumber(ruleConfig) === WARN)
      .map(([ruleId]) => ruleId);

    expect(rulesAtWarn).toEqual([]);
  });
});

/* eslint-enable unicorn/no-incorrect-template-string-interpolation -- end JSX fixture region */
