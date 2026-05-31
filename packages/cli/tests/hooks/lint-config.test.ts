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
