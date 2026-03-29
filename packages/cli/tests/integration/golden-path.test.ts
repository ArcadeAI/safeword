/**
 * E2E Test: Golden Path
 *
 * Verifies that a safeword-configured TypeScript project actually works:
 * - ESLint config runs and catches issues
 * - Prettier formats files correctly
 * - Claude Code hook scripts execute correctly
 * - Lint hook handles edge cases gracefully (syntax errors, missing files)
 *
 * Also includes idempotency and fallback tests (separate project setups).
 */

import { execSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  runLintHook,
  writeTestFile,
} from '../helpers';

describe('E2E: Golden Path', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000); // 3 min timeout for bun install

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('eslint config is valid and runs', () => {
    writeTestFile(projectDirectory, 'src/valid.ts', 'export const x = 1;\n');

    // Should not throw - config is valid
    const result = execSync('bunx eslint src/valid.ts', {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result).toBe('');
  });

  it('eslint detects violations', () => {
    // Use 'var' which is flagged by recommended rules
    writeTestFile(projectDirectory, 'src/bad.ts', 'var unused = 1;\n');

    // Should throw because of lint errors
    expect(() => {
      execSync('bunx eslint src/bad.ts', {
        cwd: projectDirectory,
        encoding: 'utf8',
      });
    }).toThrow();
  });

  it('prettier formats files', () => {
    writeTestFile(projectDirectory, 'src/ugly.ts', 'const x=1;const y=2;\n');

    execSync('bunx prettier --write src/ugly.ts', { cwd: projectDirectory });

    const formatted = readTestFile(projectDirectory, 'src/ugly.ts');
    // Prettier adds spaces and may split lines
    expect(formatted).toContain('const x = 1');
  });

  it('post-tool-lint hook processes files', () => {
    const filePath = nodePath.join(projectDirectory, 'src/hook-test.ts');
    writeTestFile(projectDirectory, 'src/hook-test.ts', 'const x=1\n');

    // Run the lint hook
    runLintHook(projectDirectory, filePath);

    // File should be formatted (Prettier adds semicolon and spaces)
    const result = readTestFile(projectDirectory, 'src/hook-test.ts');
    expect(result.trim()).toBe('const x = 1;');
  });

  describe('Lint Hook Graceful Handling', () => {
    it('hook completes without crashing on syntax error file', () => {
      writeTestFile(projectDirectory, 'src/syntax-error.ts', 'const x = {{{{ invalid');
      const filePath = nodePath.join(projectDirectory, 'src/syntax-error.ts');

      // Should not throw - hook uses .nothrow()
      expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
    });

    it('hook completes without crashing on non-existent file', () => {
      const filePath = nodePath.join(projectDirectory, 'src/does-not-exist.ts');

      // Should not throw - hook uses .nothrow()
      expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
    });
  });
});

// =============================================================================
// Idempotency Test - Setup twice should be safe
// =============================================================================

describe('E2E: TypeScript Setup Idempotency', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    initGitRepo(projectDirectory);
    // Run setup TWICE
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('package.json is valid after running setup twice', () => {
    const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
    expect(pkg.devDependencies).toBeDefined();
    expect(pkg.devDependencies.eslint).toBeDefined();
  });

  it('eslint.config.mjs is valid after running setup twice', () => {
    const config = readTestFile(projectDirectory, 'eslint.config.mjs');
    expect(config).toContain('safeword');
  });

  it('ESLint still works after running setup twice', () => {
    writeTestFile(projectDirectory, 'src/idempotent.ts', 'export const x = 1;\n');

    // Should not throw
    const result = execSync('bunx eslint src/idempotent.ts', {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result).toBe('');
  });

  it('config files remain valid', () => {
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
    expect(fileExists(projectDirectory, '.prettierrc')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/eslint.config.mjs')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/.prettierrc')).toBe(true);
  });
});

// =============================================================================
// Fallback Test - Hook works without .safeword/ config
// =============================================================================

describe('E2E: TypeScript Lint Hook Fallback', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });

    // Delete .safeword/eslint.config.mjs AFTER setup to test fallback path
    const eslintConfig = nodePath.join(projectDirectory, '.safeword/eslint.config.mjs');
    if (fileExists(projectDirectory, '.safeword/eslint.config.mjs')) {
      unlinkSync(eslintConfig);
    }
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('lint hook formats files without safeword ESLint config', () => {
    writeTestFile(projectDirectory, 'src/fallback.ts', 'const x=1\n');
    const filePath = nodePath.join(projectDirectory, 'src/fallback.ts');

    // Hook should use fallback path (ESLint without --config, then Prettier)
    runLintHook(projectDirectory, filePath);

    // File should still be formatted by Prettier
    const result = readTestFile(projectDirectory, 'src/fallback.ts');
    expect(result).toContain('const x = 1');
  });
});
