/**
 * Tests for vendored-ignores-nudge helper - Ticket 152
 *
 * Covers scenarios:
 * - 3.1 / 4.1: Existing JS-detected eslint config without `.safeword/` ref → emit snippet once
 * - 3.2: No existing eslint config → no emission
 * - 3.3: Non-JS project → no emission
 * - 4.2: Existing config already references `.safeword/` → no emission (idempotent)
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shouldEmitVendoredIgnoresNudge } from './vendored-ignores-nudge.js';

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-nudge-'));
});

afterEach(() => {
  if (existsSync(temporaryDirectory)) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

describe('shouldEmitVendoredIgnoresNudge', () => {
  it('emits when existing JS eslint config does not reference .safeword/', () => {
    const cfg = nodePath.join(temporaryDirectory, 'eslint.config.mjs');
    writeFileSync(cfg, "export default [{ files: ['**/*.ts'] }];\n", 'utf8');
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: temporaryDirectory,
        existingEslintConfig: 'eslint.config.mjs',
        hasJavaScript: true,
      }),
    ).toBe(true);
  });

  it('stays silent when existing eslint config already references .safeword/', () => {
    const cfg = nodePath.join(temporaryDirectory, 'eslint.config.mjs');
    writeFileSync(cfg, "export default [{ ignores: ['.safeword/**'] }];\n", 'utf8');
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: temporaryDirectory,
        existingEslintConfig: 'eslint.config.mjs',
        hasJavaScript: true,
      }),
    ).toBe(false);
  });

  it('stays silent when no existing eslint config (fresh project)', () => {
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: temporaryDirectory,
        existingEslintConfig: undefined,
        hasJavaScript: true,
      }),
    ).toBe(false);
  });

  it('stays silent on non-JS projects regardless of stray eslint config', () => {
    const cfg = nodePath.join(temporaryDirectory, '.eslintrc');
    writeFileSync(cfg, '{}', 'utf8');
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: temporaryDirectory,
        existingEslintConfig: '.eslintrc',
        hasJavaScript: false,
      }),
    ).toBe(false);
  });

  it('emits conservatively when the config file is unreadable (cannot prove ignore is set)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(
        shouldEmitVendoredIgnoresNudge({
          cwd: temporaryDirectory,
          existingEslintConfig: 'does-not-exist.mjs',
          hasJavaScript: true,
        }),
      ).toBe(true);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
