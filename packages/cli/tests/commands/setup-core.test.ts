/**
 * Test Suite 2: Setup - Core Files
 *
 * Tests for .safeword/ directory creation and AGENTS.md handling.
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
      expect(version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
    });
  });

  describe('Test 2.2: Creates AGENTS.md if missing', () => {
    it('should create AGENTS.md with safeword link', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, 'AGENTS.md')).toBe(true);

      const content = readTestFile(temporaryDirectory, 'AGENTS.md');
      expect(content).toContain('.safeword/SAFEWORD.md');
    });
  });

  describe('Test 2.3: Prepends link to existing AGENTS.md', () => {
    it('should prepend link without losing content', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Create existing AGENTS.md
      const existingContent = '# My Project\n\nExisting content here.\n';
      writeTestFile(temporaryDirectory, 'AGENTS.md', existingContent);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const content = readTestFile(temporaryDirectory, 'AGENTS.md');

      // Link should be first
      const lines = content.split('\n');
      expect(lines[0]).toContain('.safeword/SAFEWORD.md');

      // Original content preserved
      expect(content).toContain('# My Project');
      expect(content).toContain('Existing content here.');
    });
  });

  describe('Test 2.4: No duplicate links in AGENTS.md on upgrade', () => {
    it('should not add duplicate link on upgrade', async () => {
      // First setup
      await createConfiguredProject(temporaryDirectory);

      // Verify link exists
      const contentBefore = readTestFile(temporaryDirectory, 'AGENTS.md');
      const linkCount = (contentBefore.match(/\.safeword\/SAFEWORD\.md/g) || []).length;
      expect(linkCount).toBe(1);

      // Run upgrade
      await runCli(['upgrade'], { cwd: temporaryDirectory });

      // Count links after
      const contentAfter = readTestFile(temporaryDirectory, 'AGENTS.md');
      const linkCountAfter = (contentAfter.match(/\.safeword\/SAFEWORD\.md/g) || []).length;

      expect(linkCountAfter).toBe(1);
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
