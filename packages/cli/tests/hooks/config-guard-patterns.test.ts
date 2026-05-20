/**
 * Tests for the rewritten regex patterns in `.safeword/hooks/pre-tool-config-guard.ts`
 * (Ticket 152, Rule 5).
 *
 * The hook keeps its patterns as inline literals (they are policy, not data).
 * This file documents the canonical shape and locks the match set against
 * regression: if someone changes the hook regex they must also change the
 * mirrored constant here.
 */

import { describe, expect, it } from 'vitest';

// Mirror of the rewritten patterns in pre-tool-config-guard.ts:

const ESLINTRC_PATTERN = /\.eslintrc(?:\.(?:json|yaml|yml|js|cjs|mjs))?$/;

const PRETTIERRC_PATTERN = /\.prettierrc(?:\.(?:json|yaml|yml|js|cjs|mjs))?$/;

describe('eslintrc regex (rewritten)', () => {
  it.each([
    '.eslintrc.json',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.mjs',
    '.eslintrc',
  ])('matches %s', input => {
    expect(ESLINTRC_PATTERN.test(input)).toBe(true);
  });

  it.each(['eslintrc-readme.md', 'README.md', 'src/eslintrc.ts'])(
    'does NOT match non-config path %s',
    input => {
      expect(ESLINTRC_PATTERN.test(input)).toBe(false);
    },
  );
});

describe('prettierrc regex (rewritten)', () => {
  it.each([
    '.prettierrc.json',
    '.prettierrc.yaml',
    '.prettierrc.yml',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc',
  ])('matches %s', input => {
    expect(PRETTIERRC_PATTERN.test(input)).toBe(true);
  });

  it.each(['prettier-plugin-foo.js', 'README.md', 'src/prettierrc.ts'])(
    'does NOT match non-config path %s',
    input => {
      expect(PRETTIERRC_PATTERN.test(input)).toBe(false);
    },
  );
});
