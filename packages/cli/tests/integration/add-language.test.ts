/**
 * E2E Test: Add Language to Existing Project
 *
 * Verifies incremental language adoption:
 * - Setup with TypeScript only
 * - Add Python files to the project
 * - Run upgrade
 * - Python pack gets installed and Ruff config is added to pyproject.toml
 *
 * Tests the upgrade path for adding new languages after initial setup.
 * Note: Tests requiring Ruff are skipped if Ruff is not installed.
 */

import { spawnSync } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  isRuffInstalled,
  readSafewordConfig,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

const RUFF_AVAILABLE = isRuffInstalled();

describe('E2E: Add Language to Existing Project', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    initGitRepo(projectDirectory);
    // Initial setup with TypeScript only
    await runCli(['setup'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('starts with only TypeScript pack installed', () => {
    const config = readSafewordConfig(projectDirectory);
    expect(config.installedPacks).toContain('typescript');
    expect(config.installedPacks).not.toContain('python');
  });

  it('does not have pyproject.toml initially', () => {
    expect(fileExists(projectDirectory, 'pyproject.toml')).toBe(false);
  });

  describe('after adding Python and running upgrade', () => {
    beforeAll(async () => {
      // Add Python to the project
      writeTestFile(
        projectDirectory,
        'pyproject.toml',
        `[project]
name = "test-project"
version = "0.1.0"
`,
      );

      // Run upgrade to detect and install Python pack
      await runCli(['upgrade'], { cwd: projectDirectory });
    }, 60_000);

    it('installs Python pack', () => {
      const config = readSafewordConfig(projectDirectory);
      expect(config.installedPacks).toContain('typescript');
      expect(config.installedPacks).toContain('python');
    });

    it('adds Ruff config via extend pattern', () => {
      const ruffToml = readTestFile(projectDirectory, 'ruff.toml');
      // Ticket 138: customer's ruff.toml is bare/customer-owned.
      expect(ruffToml).toContain('customer-owned');

      // Actual strict rules in .safeword/ruff.toml, which extends customer's.
      const safewordRuff = readTestFile(projectDirectory, '.safeword/ruff.toml');
      expect(safewordRuff).toContain('line-length');
      expect(safewordRuff).toContain('extend = "../ruff.toml"');
    });

    it.skipIf(!RUFF_AVAILABLE)('Ruff works on Python files', () => {
      writeTestFile(projectDirectory, 'test.py', 'x = 1\n');

      const result = spawnSync('ruff', ['check', 'test.py'], {
        cwd: projectDirectory,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
    });

    it('ESLint still works on TypeScript files', () => {
      writeTestFile(projectDirectory, 'test.ts', 'export const x = 1;\n');

      const result = spawnSync('bunx', ['eslint', 'test.ts'], {
        cwd: projectDirectory,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
    });
  });
});
