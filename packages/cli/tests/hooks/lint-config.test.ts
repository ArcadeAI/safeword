/**
 * Unit tests for lint-config presence detection (ticket 1J6JKP). Pure
 * functions over a directory listing — prefix-match so new eslint/prettier
 * config extensions are covered without enumerating every filename (the drift
 * that caused this ticket: `eslint.config.ts` / `.prettierrc.yaml` were missed).
 */

import { describe, expect, it } from 'vitest';

import { detectEslintConfig, detectPrettierConfig } from '../../templates/hooks/lib/lint-config.js';

describe('detectEslintConfig', () => {
  it('detects every flat-config extension', () => {
    for (const file of [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      'eslint.config.ts',
      'eslint.config.mts',
      'eslint.config.cts',
    ]) {
      expect(detectEslintConfig([file])).toBe(true);
    }
  });

  it('detects legacy .eslintrc variants', () => {
    for (const file of ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.yaml']) {
      expect(detectEslintConfig([file])).toBe(true);
    }
  });

  it('is false when no eslint config is present', () => {
    expect(detectEslintConfig(['README.md', 'package.json', 'tsconfig.json'])).toBe(false);
  });
});

describe('detectPrettierConfig', () => {
  it('detects .prettierrc and all its extensions', () => {
    for (const file of [
      '.prettierrc',
      '.prettierrc.json',
      '.prettierrc.yaml',
      '.prettierrc.yml',
      '.prettierrc.toml',
      '.prettierrc.json5',
      '.prettierrc.ts',
      '.prettierrc.mjs',
    ]) {
      expect(detectPrettierConfig([file])).toBe(true);
    }
  });

  it('detects prettier.config.* variants', () => {
    for (const file of ['prettier.config.js', 'prettier.config.cjs', 'prettier.config.mts']) {
      expect(detectPrettierConfig([file])).toBe(true);
    }
  });

  it('is false when no prettier config is present', () => {
    expect(detectPrettierConfig(['foo.js', 'package.json'])).toBe(false);
  });
});

describe('disabled/backup configs are not treated as present', () => {
  // A config renamed to `.bak` (a common "disable it" gesture, and how the E2E
  // hook test simulates a missing config) must NOT count — the tool won't load
  // it. This is why detection matches exact known filenames, not a loose prefix.
  it('ignores .bak-suffixed eslint/prettier configs', () => {
    expect(detectEslintConfig(['eslint.config.mjs.bak'])).toBe(false);
    expect(detectEslintConfig(['.eslintrc.json.bak'])).toBe(false);
    expect(detectPrettierConfig(['.prettierrc.bak'])).toBe(false);
    expect(detectPrettierConfig(['prettier.config.js.bak'])).toBe(false);
  });

  it('ignores unrelated extensions on the config base', () => {
    expect(detectPrettierConfig(['.prettierrc.local'])).toBe(false);
    expect(detectEslintConfig(['eslint.config.backup'])).toBe(false);
  });
});
