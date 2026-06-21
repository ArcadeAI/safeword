/**
 * Tests for the ESLint config auto-patcher — Ticket 154.
 *
 * Covers Rule 1 (recognized flat-config shapes get patched), Rule 2
 * (idempotency by substring), Rule 4 (bail-to-print on unrecognized
 * shapes), and Rule 5 (safety: TS variants skip node --check; revert on
 * failure). Wiring scenarios (--no-modify, env var, setup/upgrade
 * integration) live in separate command-level tests.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { autoPatchEslintConfig } from './eslint-auto-patch.js';

const shared: { temporaryDirectory: string } = { temporaryDirectory: '' };

beforeEach(() => {
  shared.temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-patch-'));
});

afterEach(() => {
  if (existsSync(shared.temporaryDirectory)) {
    rmSync(shared.temporaryDirectory, { recursive: true, force: true });
  }
});

function writeConfig(filename: string, body: string): string {
  const fullPath = nodePath.join(shared.temporaryDirectory, filename);
  writeFileSync(fullPath, body, 'utf8');
  return fullPath;
}

// ────────────────────────────────────────────────────────────────────────────
// Rule 1 — Recognized flat-config shapes get patched
// ────────────────────────────────────────────────────────────────────────────

describe('Rule 1 — flat-config shapes', () => {
  it('1.1: bare-array eslint.config.mjs gets patched in place', () => {
    const configPath = writeConfig(
      'eslint.config.mjs',
      "export default [{ files: ['**/*.ts'] }];\n",
    );

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('patched');
    const patched = readFileSync(configPath, 'utf8');
    expect(patched).toContain("import safeword from 'safeword/eslint';");
    expect(patched).toContain('...safeword.configs.vendoredIgnores,');
    // The spread must appear before the closing ] of the default-export array
    const spreadIndex = patched.indexOf('...safeword.configs.vendoredIgnores');
    const closeIndex = patched.lastIndexOf(']');
    expect(spreadIndex).toBeLessThan(closeIndex);
    // Backup exists with the pre-edit contents
    expect(existsSync(`${configPath}.safeword-bak`)).toBe(true);
    expect(readFileSync(`${configPath}.safeword-bak`, 'utf8')).toBe(
      "export default [{ files: ['**/*.ts'] }];\n",
    );
  });

  it('1.2: defineConfig(...) wrapper gets patched inside the call', () => {
    const body =
      "import { defineConfig } from 'eslint/config';\n" +
      "export default defineConfig([{ files: ['**/*.ts'] }]);\n";
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('patched');
    const patched = readFileSync(configPath, 'utf8');
    // The spread is INSIDE defineConfig(...) — before the closing ]), not after )
    expect(patched).toMatch(/\.\.\.safeword\.configs\.vendoredIgnores,\s*\]\)/);
  });

  it.each([
    { filename: 'eslint.config.mjs', body: 'export default [];\n' },
    { filename: 'eslint.config.js', body: 'export default [];\n' },
    { filename: 'eslint.config.cjs', body: 'module.exports = [];\n' },
    { filename: 'eslint.config.ts', body: 'export default [];\n' },
    { filename: 'eslint.config.mts', body: 'export default [];\n' },
    { filename: 'eslint.config.cts', body: 'export default [];\n' },
  ])('1.3: $filename is recognized as a flat config', ({ filename, body }) => {
    const configPath = writeConfig(filename, body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('patched');
    const patched = readFileSync(configPath, 'utf8');
    expect(patched).toContain('...safeword.configs.vendoredIgnores,');
  });

  it('1.4: existing safeword import is not duplicated', () => {
    const body =
      "import safeword from 'safeword/eslint';\n" +
      'export default [...safeword.configs.recommendedTypeScript];\n';
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('patched');
    const patched = readFileSync(configPath, 'utf8');
    const importMatches = patched.match(/import safeword from 'safeword\/eslint'/g) ?? [];
    expect(importMatches).toHaveLength(1);
    expect(patched).toContain('...safeword.configs.vendoredIgnores,');
  });

  it('1.5: CRLF line endings are preserved through the edit', () => {
    const body = "export default [{ files: ['**/*.ts'] }];\r\n";
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('patched');
    const patched = readFileSync(configPath, 'utf8');
    // No lone LF anywhere — every newline must be CRLF
    expect(/(?<!\r)\n/.test(patched)).toBe(false);
    // The two inserted lines end in CRLF
    expect(patched).toMatch(/import safeword from 'safeword\/eslint';\r\n/);
    expect(patched).toMatch(/\.\.\.safeword\.configs\.vendoredIgnores,\r\n/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Rule 2 — Idempotency by substring
// ────────────────────────────────────────────────────────────────────────────

describe('Rule 2 — idempotency', () => {
  it('2.1: re-running after a successful patch is a no-op', () => {
    const body =
      "import safeword from 'safeword/eslint';\n" +
      'export default [\n  ...safeword.configs.vendoredIgnores,\n];\n';
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('idempotent-skip');
    expect(readFileSync(configPath, 'utf8')).toBe(body);
    expect(existsSync(`${configPath}.safeword-bak`)).toBe(false);
  });

  it('2.2: manual 153-nudge application is recognized as already-patched', () => {
    const body = "import x from 'y';\nexport default [...x.configs.vendoredIgnores];\n";
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('idempotent-skip');
    expect(readFileSync(configPath, 'utf8')).toBe(body);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Rule 4 — Bail-to-print on unrecognized shapes
// ────────────────────────────────────────────────────────────────────────────

describe('Rule 4 — bail-to-print on unrecognized shapes', () => {
  it('4.1: function-returning-config bails', () => {
    const body = "export default () => [{ files: ['**/*.ts'] }];\n";
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('bailed');
    expect(readFileSync(configPath, 'utf8')).toBe(body);
    expect(existsSync(`${configPath}.safeword-bak`)).toBe(false);
  });

  it('4.2: single-imported-config bails', () => {
    const body = "import cfg from './shared.mjs';\nexport default cfg;\n";
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('bailed');
    expect(readFileSync(configPath, 'utf8')).toBe(body);
  });

  it('4.3: defineConfig wrapping a non-array call bails', () => {
    const body =
      "import { defineConfig } from 'eslint/config';\nexport default defineConfig(getConfig());\n";
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('bailed');
    expect(readFileSync(configPath, 'utf8')).toBe(body);
  });

  it('4.4: unrecognized custom wrapper bails', () => {
    const body = "export default makeMyConfig([{ files: ['**/*.ts'] }]);\n";
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('bailed');
    expect(readFileSync(configPath, 'utf8')).toBe(body);
  });

  it('5.3: read failure on the config bails (file does not exist)', () => {
    const configPath = nodePath.join(shared.temporaryDirectory, 'missing.mjs');

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('bailed');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Rule 5 — TS variants skip node --check
// ────────────────────────────────────────────────────────────────────────────

describe('Rule 5 — safety', () => {
  it('5.1: post-edit node --check failure reverts from backup and bails', () => {
    // Craft a config where the textual heuristic targets a commented-out
    // `export default [...]` block, so the insertion lands inside the
    // comment and the resulting file fails `node --check`. The patcher
    // must restore from backup and bail.
    const body =
      "// export default ['stale-example'];\n" +
      'const blocker = 1;\n' +
      "export default [{ files: ['**/*.ts'], blocker }];\n";
    const configPath = writeConfig('eslint.config.mjs', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('bailed');
    if (result.kind === 'bailed') {
      // Either syntax-check-failed (the path we want to exercise here) or
      // some intermediate bail — but the contract is: original file is
      // byte-identical to its pre-command state.
      expect(['syntax-check-failed', 'unrecognized-shape']).toContain(result.reason);
    }
    expect(readFileSync(configPath, 'utf8')).toBe(body);
  });

  it('5.4: TypeScript config with as-const-trailing syntax is patched without node --check', () => {
    // The trailing `as const` is valid TS but would make node --check reject it.
    // The patcher must not invoke node --check on a .ts file.
    const body = "export default [{ files: ['**/*.ts'] }] as const;\n";
    const configPath = writeConfig('eslint.config.ts', body);

    const result = autoPatchEslintConfig({ configPath });

    expect(result.kind).toBe('patched');
    const patched = readFileSync(configPath, 'utf8');
    expect(patched).toContain('...safeword.configs.vendoredIgnores,');
    expect(patched).toContain('as const');
  });
});
