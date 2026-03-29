/**
 * Tests for Test Linting configs - Story 10: Vitest + Playwright + Storybook + Turbo
 *
 * Verifies that test configs:
 * - Include appropriate plugins
 * - Target test file patterns
 * - Have correct rule severities (all error, LLMs ignore warnings)
 */

import { describe, expect, it } from 'vitest';

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
