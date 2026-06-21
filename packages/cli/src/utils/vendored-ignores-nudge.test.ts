/**
 * Tests for vendored-ignores-nudge helper - Ticket 152
 *
 * Covers scenarios:
 * - 3.1 / 4.1: Existing JS-detected eslint config without `.safeword/` ref → emit snippet once
 * - 3.2: No existing eslint config → no emission
 * - 3.3: Non-JS project → no emission
 * - 4.2: Existing config already references `.safeword/` → no emission (idempotent)
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { maybeAutoPatchOrNudge, shouldEmitVendoredIgnoresNudge } from './vendored-ignores-nudge.js';

const state: { temporaryDirectory: string } = { temporaryDirectory: '' };

function setupConfig(filename: string, body: string): string {
  const fullPath = nodePath.join(state.temporaryDirectory, filename);
  writeFileSync(fullPath, body, 'utf8');
  return fullPath;
}

beforeEach(() => {
  state.temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-nudge-'));
});

afterEach(() => {
  if (existsSync(state.temporaryDirectory)) {
    rmSync(state.temporaryDirectory, { recursive: true, force: true });
  }
});

describe('shouldEmitVendoredIgnoresNudge', () => {
  it('emits when existing JS eslint config does not reference .safeword/', () => {
    const config = nodePath.join(state.temporaryDirectory, 'eslint.config.mjs');
    writeFileSync(config, "export default [{ files: ['**/*.ts'] }];\n", 'utf8');
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: state.temporaryDirectory,
        existingEslintConfig: 'eslint.config.mjs',
        hasJavaScript: true,
      }),
    ).toBe(true);
  });

  it('stays silent when existing eslint config already references .safeword/', () => {
    const config = nodePath.join(state.temporaryDirectory, 'eslint.config.mjs');
    writeFileSync(config, "export default [{ ignores: ['.safeword/**'] }];\n", 'utf8');
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: state.temporaryDirectory,
        existingEslintConfig: 'eslint.config.mjs',
        hasJavaScript: true,
      }),
    ).toBe(false);
  });

  it('stays silent when existing eslint config already mentions vendoredIgnores (manual 153 application)', () => {
    const config = nodePath.join(state.temporaryDirectory, 'eslint.config.mjs');
    writeFileSync(
      config,
      "import s from 'safeword/eslint';\nexport default [...s.configs.vendoredIgnores];\n",
      'utf8',
    );
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: state.temporaryDirectory,
        existingEslintConfig: 'eslint.config.mjs',
        hasJavaScript: true,
      }),
    ).toBe(false);
  });

  it('stays silent when no existing eslint config (fresh project)', () => {
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: state.temporaryDirectory,
        existingEslintConfig: undefined,
        hasJavaScript: true,
      }),
    ).toBe(false);
  });

  it('stays silent on non-JS projects regardless of stray eslint config', () => {
    const config = nodePath.join(state.temporaryDirectory, '.eslintrc');
    writeFileSync(config, '{}', 'utf8');
    expect(
      shouldEmitVendoredIgnoresNudge({
        cwd: state.temporaryDirectory,
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
          cwd: state.temporaryDirectory,
          existingEslintConfig: 'does-not-exist.mjs',
          hasJavaScript: true,
        }),
      ).toBe(true);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe('maybeAutoPatchOrNudge', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    delete process.env.SAFEWORD_NO_MODIFY;
  });

  afterEach(() => {
    logSpy.mockRestore();
    delete process.env.SAFEWORD_NO_MODIFY;
  });

  it('3.1: --no-modify flag falls through to print-nudge; config untouched', () => {
    const original = "export default [{ files: ['**/*.ts'] }];\n";
    setupConfig('eslint.config.mjs', original);

    maybeAutoPatchOrNudge({
      cwd: state.temporaryDirectory,
      existingEslintConfig: 'eslint.config.mjs',
      hasJavaScript: true,
      noModify: true,
    });

    expect(readFileSync(nodePath.join(state.temporaryDirectory, 'eslint.config.mjs'), 'utf8')).toBe(
      original,
    );
    expect(
      existsSync(nodePath.join(state.temporaryDirectory, 'eslint.config.mjs.safeword-bak')),
    ).toBe(false);
    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(output).toContain('...safeword.configs.vendoredIgnores,');
  });

  it('3.2: SAFEWORD_NO_MODIFY env var has the same effect as --no-modify', () => {
    const original = "export default [{ files: ['**/*.ts'] }];\n";
    setupConfig('eslint.config.mjs', original);
    process.env.SAFEWORD_NO_MODIFY = '1';

    maybeAutoPatchOrNudge({
      cwd: state.temporaryDirectory,
      existingEslintConfig: 'eslint.config.mjs',
      hasJavaScript: true,
      noModify: false,
    });

    expect(readFileSync(nodePath.join(state.temporaryDirectory, 'eslint.config.mjs'), 'utf8')).toBe(
      original,
    );
    expect(
      existsSync(nodePath.join(state.temporaryDirectory, 'eslint.config.mjs.safeword-bak')),
    ).toBe(false);
    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(output).toContain('...safeword.configs.vendoredIgnores,');
  });

  it('3.3: opt-out + already-patched state stays fully silent', () => {
    const original =
      "import safeword from 'safeword/eslint';\nexport default [...safeword.configs.vendoredIgnores];\n";
    setupConfig('eslint.config.mjs', original);

    maybeAutoPatchOrNudge({
      cwd: state.temporaryDirectory,
      existingEslintConfig: 'eslint.config.mjs',
      hasJavaScript: true,
      noModify: true,
    });

    expect(readFileSync(nodePath.join(state.temporaryDirectory, 'eslint.config.mjs'), 'utf8')).toBe(
      original,
    );
    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(output).not.toContain('vendoredIgnores');
  });

  it('default behavior: auto-patches and prints confirmation referencing both paths', () => {
    setupConfig('eslint.config.mjs', "export default [{ files: ['**/*.ts'] }];\n");

    maybeAutoPatchOrNudge({
      cwd: state.temporaryDirectory,
      existingEslintConfig: 'eslint.config.mjs',
      hasJavaScript: true,
      noModify: false,
    });

    const patched = readFileSync(
      nodePath.join(state.temporaryDirectory, 'eslint.config.mjs'),
      'utf8',
    );
    expect(patched).toContain('...safeword.configs.vendoredIgnores,');
    expect(
      existsSync(nodePath.join(state.temporaryDirectory, 'eslint.config.mjs.safeword-bak')),
    ).toBe(true);
    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(output).toContain('eslint.config.mjs');
    expect(output).toContain('.safeword-bak');
  });

  it('bail path: unrecognized shape leaves config untouched, prints bail line + nudge', () => {
    const original = "export default () => [{ files: ['**/*.ts'] }];\n";
    setupConfig('eslint.config.mjs', original);

    maybeAutoPatchOrNudge({
      cwd: state.temporaryDirectory,
      existingEslintConfig: 'eslint.config.mjs',
      hasJavaScript: true,
      noModify: false,
    });

    expect(readFileSync(nodePath.join(state.temporaryDirectory, 'eslint.config.mjs'), 'utf8')).toBe(
      original,
    );
    expect(
      existsSync(nodePath.join(state.temporaryDirectory, 'eslint.config.mjs.safeword-bak')),
    ).toBe(false);
    const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(output).toContain("Couldn't auto-patch");
    expect(output).toContain('...safeword.configs.vendoredIgnores,');
  });
});
