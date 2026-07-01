/**
 * Tests for Test Linting configs - Story 10: Vitest + Playwright + Storybook + Turbo
 *
 * Verifies that test configs:
 * - Include appropriate plugins
 * - Target test file patterns
 * - Have correct rule severities (all error, LLMs ignore warnings)
 */

import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { bunTestConfig } from '../bun-test.js';
import { playwrightConfig } from '../playwright.js';
import { storybookConfig } from '../storybook.js';
import { turboConfig } from '../turbo.js';
import { vitestConfig } from '../vitest.js';
import { getAllRules, getRuleConfig, getSeverityNumber } from './test-utilities.js';

const ERROR = 2;
const WARN = 1;

// ============ VITEST CONFIG ============

describe('vitestConfig', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(vitestConfig)).toBe(true);
    expect(vitestConfig.length).toBeGreaterThan(0);
  });

  it('includes vitest plugin', () => {
    const hasVitest = vitestConfig.some(
      config =>
        typeof config === 'object' &&
        config !== null &&
        'plugins' in config &&
        config.plugins &&
        'vitest' in config.plugins,
    );
    expect(hasVitest).toBe(true);
  });

  it('targets test files', () => {
    const hasTestFilePattern = vitestConfig.some(
      config =>
        typeof config === 'object' &&
        config !== null &&
        'files' in config &&
        Array.isArray(config.files) &&
        config.files.some((f: string) => f.includes('.test.') || f.includes('.spec.')),
    );
    expect(hasTestFilePattern).toBe(true);
  });

  it('also targets tests/ and e2e/ directories for test infrastructure', () => {
    // The preset's files glob was broadened to catch test helpers
    // (tests/helpers.ts, tests/fixtures/*.ts) and end-to-end scaffolding
    // (e2e/**/*.ts), not just *.test.ts and *.spec.ts files. This test
    // catches accidental regressions if someone narrows the glob.
    const block = vitestConfig.find(
      config => typeof config === 'object' && config !== null && Array.isArray(config.files),
    ) as { files: string[] } | undefined;
    expect(block?.files).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/tests\/\*\*/),
        expect.stringMatching(/e2e\/\*\*/),
      ]),
    );
  });

  // Twelve rules were promoted into the preset from the project-local
  // cli-tests-override block. They target test-code patterns (throwaway
  // fixtures, regex-heavy assertions, describe-block helpers) where the
  // rule's intent doesn't apply. If the preset is reorganized, these
  // turn-offs need to survive — table-driven so each rule gets its own
  // test case (failure isolation: if 3 rules regress, you see all 3 at
  // once instead of just the first).
  it.each([
    'sonarjs/no-unused-vars',
    'sonarjs/no-dead-store',
    'sonarjs/unused-import',
    '@typescript-eslint/no-unused-vars',
    'sonarjs/slow-regex',
    'security/detect-unsafe-regex',
    'regexp/no-dupe-disjunctions',
    'sonarjs/assertions-in-tests',
    'unicorn/consistent-function-scoping',
    'unicorn/no-array-callback-reference',
    'sonarjs/publicly-writable-directories',
    'sonarjs/no-alphabetical-sort',
  ])('disables %s for test files', rule => {
    expect(getSeverityNumber(getRuleConfig(vitestConfig, rule))).toBe(0);
  });
});

describe('Vitest critical rules at error', () => {
  it('vitest/expect-expect is at error', () => {
    expect(getSeverityNumber(getRuleConfig(vitestConfig, 'vitest/expect-expect'))).toBe(ERROR);
  });

  it('vitest/no-focused-tests is at error', () => {
    expect(getSeverityNumber(getRuleConfig(vitestConfig, 'vitest/no-focused-tests'))).toBe(ERROR);
  });

  it('vitest/no-identical-title is at error', () => {
    expect(getSeverityNumber(getRuleConfig(vitestConfig, 'vitest/no-identical-title'))).toBe(ERROR);
  });

  it('vitest/valid-expect is at error', () => {
    expect(getSeverityNumber(getRuleConfig(vitestConfig, 'vitest/valid-expect'))).toBe(ERROR);
  });
});

// ============ BUN TEST CONFIG ============

/** Finds the config block declaring bunTestConfig's languageOptions.globals. */
function getBunTestGlobals(): Record<string, string> | undefined {
  const block = bunTestConfig.find(
    config =>
      typeof config === 'object' &&
      config !== null &&
      'languageOptions' in config &&
      config.languageOptions?.globals,
  ) as { languageOptions: { globals: Record<string, string> } } | undefined;
  return block?.languageOptions.globals;
}

describe('bunTestConfig', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(bunTestConfig)).toBe(true);
    expect(bunTestConfig.length).toBeGreaterThan(0);
  });

  it('targets test files', () => {
    const hasTestFilePattern = bunTestConfig.some(
      config =>
        typeof config === 'object' &&
        config !== null &&
        'files' in config &&
        Array.isArray(config.files) &&
        config.files.some((f: string) => f.includes('.test.') || f.includes('.spec.')),
    );
    expect(hasTestFilePattern).toBe(true);
  });

  it.each([
    'test',
    'it',
    'xtest',
    'xit',
    'describe',
    'xdescribe',
    'beforeAll',
    'beforeEach',
    'afterAll',
    'afterEach',
    'onTestFinished',
    'setDefaultTimeout',
    'expect',
    'expectTypeOf',
    'mock',
    'spyOn',
    'jest',
    'setSystemTime',
    'vi',
  ])('declares %s as a read-only global', name => {
    expect(getBunTestGlobals()?.[name]).toBe('readonly');
  });

  it('does not declare fit — bun:test has no focus alias (use .only instead)', () => {
    expect(getBunTestGlobals()?.fit).toBeUndefined();
  });

  // Regression test for ticket #513: runs the actual ESLint engine (not just
  // inspecting config shape) against a plain .js file using bun:test's
  // implicit-globals style — the exact pattern that previously false-positived.
  describe('against the real ESLint engine', () => {
    const BUN_TEST_FILE = fileURLToPath(new URL('inline.test.js', import.meta.url));

    it('does not false-positive no-undef on implicit bun:test globals', () => {
      const linter = new Linter({ configType: 'flat' });
      const code = `
xdescribe('example', () => {
  beforeEach(() => {
    mock.restore();
  });
  it('works', () => {
    expect(1).toBe(1);
  });
});
`;

      const results = linter.verify(code, [{ rules: { 'no-undef': 'error' } }, ...bunTestConfig], {
        filename: BUN_TEST_FILE,
      });

      expect(results.filter(r => r.ruleId === 'no-undef')).toHaveLength(0);
    });

    it('still flags a genuine undefined name (Jest-only fit, not a bun:test export)', () => {
      const linter = new Linter({ configType: 'flat' });
      const code = `fit('typo', () => {});\n`;

      const results = linter.verify(code, [{ rules: { 'no-undef': 'error' } }, ...bunTestConfig], {
        filename: BUN_TEST_FILE,
      });

      expect(results.filter(r => r.ruleId === 'no-undef')).toHaveLength(1);
    });
  });
});

// ============ PLAYWRIGHT CONFIG ============

describe('playwrightConfig', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(playwrightConfig)).toBe(true);
    expect(playwrightConfig.length).toBeGreaterThan(0);
  });

  it('includes playwright plugin', () => {
    const hasPlaywright = playwrightConfig.some(
      config =>
        typeof config === 'object' &&
        config !== null &&
        'plugins' in config &&
        config.plugins &&
        'playwright' in config.plugins,
    );
    expect(hasPlaywright).toBe(true);
  });

  it('targets test files', () => {
    const hasTestFilePattern = playwrightConfig.some(
      config =>
        typeof config === 'object' &&
        config !== null &&
        'files' in config &&
        Array.isArray(config.files) &&
        config.files.some(
          (f: string) => f.includes('.test.') || f.includes('.spec.') || f.includes('.e2e.'),
        ),
    );
    expect(hasTestFilePattern).toBe(true);
  });
});

describe('Playwright critical rules at error', () => {
  it('playwright/expect-expect is at error', () => {
    expect(getSeverityNumber(getRuleConfig(playwrightConfig, 'playwright/expect-expect'))).toBe(
      ERROR,
    );
  });

  it('playwright/no-focused-test is at error', () => {
    expect(getSeverityNumber(getRuleConfig(playwrightConfig, 'playwright/no-focused-test'))).toBe(
      ERROR,
    );
  });

  it('playwright/valid-expect is at error', () => {
    expect(getSeverityNumber(getRuleConfig(playwrightConfig, 'playwright/valid-expect'))).toBe(
      ERROR,
    );
  });

  it('playwright/no-wait-for-timeout is at error', () => {
    expect(
      getSeverityNumber(getRuleConfig(playwrightConfig, 'playwright/no-wait-for-timeout')),
    ).toBe(ERROR);
  });

  it('playwright/no-page-pause is at error', () => {
    expect(getSeverityNumber(getRuleConfig(playwrightConfig, 'playwright/no-page-pause'))).toBe(
      ERROR,
    );
  });
});

describe('Playwright no-skipped-test at error', () => {
  it('playwright/no-skipped-test is error (LLMs ignore warnings)', () => {
    expect(getSeverityNumber(getRuleConfig(playwrightConfig, 'playwright/no-skipped-test'))).toBe(
      ERROR,
    );
  });
});

describe('Playwright no warnings', () => {
  it('no playwright rules at warn', () => {
    const allRules = getAllRules(playwrightConfig);
    const rulesAtWarn = Object.entries(allRules)
      .filter(([ruleId]) => ruleId.startsWith('playwright/'))
      .filter(([_, config]) => getSeverityNumber(config) === WARN);

    expect(rulesAtWarn).toEqual([]);
  });
});

// ============ STORYBOOK CONFIG ============

describe('storybookConfig', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(storybookConfig)).toBe(true);
    expect(storybookConfig.length).toBeGreaterThan(0);
  });

  it('includes storybook plugin', () => {
    const hasStorybook = storybookConfig.some(
      config =>
        typeof config === 'object' &&
        config !== null &&
        'plugins' in config &&
        config.plugins &&
        'storybook' in config.plugins,
    );
    expect(hasStorybook).toBe(true);
  });

  it('targets story files', () => {
    const hasStoryFilePattern = storybookConfig.some(
      config =>
        typeof config === 'object' &&
        config !== null &&
        'files' in config &&
        Array.isArray(config.files) &&
        config.files.some((f: string) => f.includes('.stories.') || f.includes('.story.')),
    );
    expect(hasStoryFilePattern).toBe(true);
  });
});

describe('Storybook critical rules at error', () => {
  it('storybook/default-exports is at error', () => {
    expect(getSeverityNumber(getRuleConfig(storybookConfig, 'storybook/default-exports'))).toBe(
      ERROR,
    );
  });

  it('storybook/story-exports is at error', () => {
    expect(getSeverityNumber(getRuleConfig(storybookConfig, 'storybook/story-exports'))).toBe(
      ERROR,
    );
  });

  it('storybook/await-interactions is at error', () => {
    expect(getSeverityNumber(getRuleConfig(storybookConfig, 'storybook/await-interactions'))).toBe(
      ERROR,
    );
  });

  it('storybook/csf-component is at error', () => {
    expect(getSeverityNumber(getRuleConfig(storybookConfig, 'storybook/csf-component'))).toBe(
      ERROR,
    );
  });
});

describe('Storybook no warnings (LLMs ignore warnings)', () => {
  it('no storybook rules at warn', () => {
    const allRules = getAllRules(storybookConfig);
    const rulesAtWarn = Object.entries(allRules)
      .filter(([ruleId]) => ruleId.startsWith('storybook/'))
      .filter(([, config]) => getSeverityNumber(config) === WARN);

    expect(rulesAtWarn).toEqual([]);
  });
});

// ============ TURBO CONFIG ============

describe('turboConfig', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(turboConfig)).toBe(true);
    expect(turboConfig.length).toBeGreaterThan(0);
  });

  it('includes turbo plugin', () => {
    const hasTurbo = turboConfig.some(
      config =>
        typeof config === 'object' &&
        config !== null &&
        'plugins' in config &&
        config.plugins &&
        'turbo' in config.plugins,
    );
    expect(hasTurbo).toBe(true);
  });
});

describe('Turbo critical rules at error', () => {
  it('turbo/no-undeclared-env-vars is at error', () => {
    expect(getSeverityNumber(getRuleConfig(turboConfig, 'turbo/no-undeclared-env-vars'))).toBe(
      ERROR,
    );
  });
});

describe('Turbo no warnings (LLMs ignore warnings)', () => {
  it('no turbo rules at warn', () => {
    const allRules = getAllRules(turboConfig);
    const rulesAtWarn = Object.entries(allRules)
      .filter(([ruleId]) => ruleId.startsWith('turbo/'))
      .filter(([, config]) => getSeverityNumber(config) === WARN);

    expect(rulesAtWarn).toEqual([]);
  });
});
