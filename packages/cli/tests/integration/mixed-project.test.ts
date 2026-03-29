/**
 * E2E Test: Mixed Project (TypeScript + Python)
 *
 * Verifies that a project with both TypeScript and Python works correctly:
 * - Both language packs are detected and installed
 * - ESLint runs on TypeScript files
 * - Ruff config is added to pyproject.toml (Ruff tests skipped if not installed)
 * - Lint hook routes files to correct linter
 *
 * Note: Tests requiring Ruff are skipped if Ruff is not installed.
 * Uses a single project setup (expensive) shared across all tests.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  isRuffInstalled,
  readSafewordConfig,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  runLintHook,
  SAFEWORD_VERSION,
  writeTestFile,
} from '../helpers';

const RUFF_AVAILABLE = isRuffInstalled();

describe('E2E: Mixed Project (TypeScript + Python)', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();

    // Create a mixed package.json with both TypeScript and Python indicators
    // Pre-install local safeword to ensure tests use the current build
    const packageJson = {
      name: 'mixed-project',
      version: '1.0.0',
      devDependencies: {
        typescript: '^5.0.0',
        safeword: SAFEWORD_VERSION,
      },
    };
    writeTestFile(projectDirectory, 'package.json', JSON.stringify(packageJson, undefined, 2));

    // Also create pyproject.toml to indicate Python
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "mixed-project"
version = "0.1.0"
`,
    );

    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('detects and installs both language packs', () => {
    const config = readSafewordConfig(projectDirectory);
    expect(config.installedPacks).toContain('typescript');
    expect(config.installedPacks).toContain('python');
  });

  it('creates ESLint config', () => {
    const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
    expect(eslintConfig).toContain('eslint');
  });

  it('adds Ruff config via extend pattern', () => {
    const ruffToml = readTestFile(projectDirectory, 'ruff.toml');
    expect(ruffToml).toContain('extend = ".safeword/ruff.toml"');

    // Actual strict rules in .safeword/ruff.toml
    const safewordRuff = readTestFile(projectDirectory, '.safeword/ruff.toml');
    expect(safewordRuff).toContain('line-length');
  });

  it('ESLint runs on TypeScript files', () => {
    writeTestFile(projectDirectory, 'src/valid.ts', 'export const x = 1;\n');

    // Should not throw
    const result = execSync('bunx eslint src/valid.ts', {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result).toBe('');
  });

  it('ESLint detects TypeScript violations', () => {
    writeTestFile(projectDirectory, 'src/bad.ts', 'var unused = 1;\n');

    expect(() => {
      execSync('bunx eslint src/bad.ts', {
        cwd: projectDirectory,
        encoding: 'utf8',
      });
    }).toThrow();
  });

  it.skipIf(!RUFF_AVAILABLE)('Ruff runs on Python files', () => {
    writeTestFile(projectDirectory, 'src/valid.py', 'x = 1\n');

    const result = spawnSync('ruff', ['check', 'src/valid.py'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });

  it.skipIf(!RUFF_AVAILABLE)('Ruff detects Python violations', () => {
    writeTestFile(projectDirectory, 'src/bad.py', 'import os\nx = 1\n');

    const result = spawnSync('ruff', ['check', 'src/bad.py'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('F401');
  });

  describe('Lint hook routes to correct linter', () => {
    it('routes .ts files to ESLint', () => {
      const filePath = nodePath.join(projectDirectory, 'src/lint-ts.ts');
      writeTestFile(projectDirectory, 'src/lint-ts.ts', 'const x=1\n');

      const result = runLintHook(projectDirectory, filePath);
      expect(result.status).toBe(0);

      // ESLint/Prettier should format
      const formatted = readTestFile(projectDirectory, 'src/lint-ts.ts');
      expect(formatted.trim()).toBe('const x = 1;');
    });

    it.skipIf(!RUFF_AVAILABLE)('routes .py files to Ruff', () => {
      const filePath = nodePath.join(projectDirectory, 'src/lint-py.py');
      writeTestFile(projectDirectory, 'src/lint-py.py', 'x=1;y=2');

      const result = runLintHook(projectDirectory, filePath);
      expect(result.status).toBe(0);

      // Ruff should format
      const formatted = readTestFile(projectDirectory, 'src/lint-py.py');
      expect(formatted).toContain('x = 1');
      expect(formatted).toContain('y = 2');
    });
  });
});
