/**
 * Test Suite 7: Git Repository Handling
 *
 * Tests for git detection and setup behavior with/without git.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCliWithoutInstall,
} from '../helpers';

describe('Test Suite 7: Git Repository Handling', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 7.1: Works without .git directory', () => {
    it('should complete setup without git repository', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No git init

      const result = await runCliWithoutInstall(['setup'], {
        cwd: temporaryDirectory,
      });

      // Setup should succeed
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Test 7.2: Works with existing git repository', () => {
    it('should complete setup with existing git repository', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      const result = await runCliWithoutInstall(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      expect(fileExists(temporaryDirectory, '.git')).toBe(true);
    });
  });

  describe('Test 7.3: Works in non-interactive mode', () => {
    it('should complete setup in non-interactive mode', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No git init

      const result = await runCliWithoutInstall(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      // Git should NOT be initialized (safeword doesn't init git)
      expect(fileExists(temporaryDirectory, '.git')).toBe(false);
    });
  });

  describe('Test 7.4: Sets up linting scripts', () => {
    it('should add lint and format scripts to package.json', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCliWithoutInstall(['setup'], { cwd: temporaryDirectory });

      const packageJson = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      expect(packageJson.scripts?.lint).toBeDefined();
      expect(packageJson.scripts?.format).toBeDefined();
    });
  });

  describe('Test 7.5: Preserves existing scripts', () => {
    it('should not overwrite existing scripts', async () => {
      createTypeScriptPackageJson(temporaryDirectory, {
        scripts: {
          test: 'vitest',
          build: 'tsc',
        },
      });
      initGitRepo(temporaryDirectory);

      await runCliWithoutInstall(['setup'], { cwd: temporaryDirectory });

      const packageJson = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      // Original scripts should be preserved
      expect(packageJson.scripts?.test).toBe('vitest');
      expect(packageJson.scripts?.build).toBe('tsc');
      // New scripts should be added
      expect(packageJson.scripts?.lint).toBeDefined();
      expect(packageJson.scripts?.format).toBeDefined();
    });
  });
});
