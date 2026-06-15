/**
 * Test Suite 2: Setup - Core Files
 *
 * Tests for .safeword/ directory creation and customer context-file handling.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readSafewordConfig,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('Test Suite 2: Setup - Core Files', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 2.1: Creates .safeword directory structure', () => {
    it('should create complete .safeword/ directory', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Core structure
      expect(fileExists(temporaryDirectory, '.safeword')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/SAFEWORD.md')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/version')).toBe(true);

      // Subdirectories
      expect(fileExists(temporaryDirectory, '.safeword/guides')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/templates')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/hooks')).toBe(true);
    });

    it('should write CLI version to .safeword/version', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const version = readTestFile(temporaryDirectory, '.safeword/version').trim();
      // Should be semver format.

      expect(version).toMatch(/^\d{1,4}\.\d{1,4}\.\d{1,4}[-+\w.]{0,80}$/);
    });
  });

  describe('Test 2.2: Leaves AGENTS.md absent when missing', () => {
    it('should not create AGENTS.md just to point at safeword', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, 'AGENTS.md')).toBe(false);
    });
  });

  describe('Test 2.3: Preserves existing AGENTS.md', () => {
    it('should leave customer content unchanged', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      const existingContent = '# My Project\n\nExisting content here.\n';
      writeTestFile(temporaryDirectory, 'AGENTS.md', existingContent);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const content = readTestFile(temporaryDirectory, 'AGENTS.md');
      expect(content).toBe(existingContent);
    });
  });

  describe('Test 2.4: No AGENTS.md link on upgrade', () => {
    it('should not create AGENTS.md on upgrade', async () => {
      await createConfiguredProject(temporaryDirectory);

      expect(fileExists(temporaryDirectory, 'AGENTS.md')).toBe(false);

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, 'AGENTS.md')).toBe(false);
    });
  });

  describe('Test 2.5: Prints summary of created files', () => {
    it('should output summary of created files', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Should mention what was created
      expect(result.stdout).toMatch(/created/i);
      expect(result.stdout).toMatch(/\.safeword|safeword/i);
    });
  });

  // ==========================================================================
  // Language Packs Tracking (Feature: Language Packs)
  // Test Definitions: .safeword/planning/test-definitions/feature-language-packs.md
  // ==========================================================================

  describe('Setup tracks installed packs in config', () => {
    it('should write installedPacks to config.json', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      writeTestFile(temporaryDirectory, 'pyproject.toml', `[project]\nname = "test"\n`);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const config = readSafewordConfig(temporaryDirectory);
      expect(config.installedPacks).toContain('python');
    });
  });
});
