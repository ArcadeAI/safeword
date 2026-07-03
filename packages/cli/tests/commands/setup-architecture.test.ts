/**
 * Test Suite: Setup - Architecture Integration
 *
 * Tests for automatic architecture detection and depcruise config generation during setup.
 * See: .safeword/planning/test-definitions/feature-architecture-audit.md
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptProjectReadyForSetup,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('Setup - Architecture Integration', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 6.1: Generates depcruise config when architecture detected', () => {
    it('should create depcruise configs when src/utils exists', async () => {
      createTypeScriptProjectReadyForSetup(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Create architecture directory
      writeTestFile(temporaryDirectory, 'src/utils/helper.ts', 'export const x = 1;');

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Should create depcruise configs
      expect(fileExists(temporaryDirectory, '.safeword/depcruise-config.cjs')).toBe(true);
      expect(fileExists(temporaryDirectory, '.dependency-cruiser.cjs')).toBe(true);

      // Generated config should have rules
      const config = readTestFile(temporaryDirectory, '.safeword/depcruise-config.cjs');
      expect(config).toContain('module.exports');
      expect(config).toContain('forbidden');
      expect(config).toContain('no-circular');
    });

    it('should create depcruise configs when monorepo detected', async () => {
      createTypeScriptProjectReadyForSetup(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Create monorepo structure
      writeTestFile(temporaryDirectory, 'packages/core/index.ts', 'export const x = 1;');
      writeTestFile(temporaryDirectory, 'packages/ui/index.ts', 'export const y = 1;');

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Should create depcruise configs
      expect(fileExists(temporaryDirectory, '.safeword/depcruise-config.cjs')).toBe(true);
      expect(fileExists(temporaryDirectory, '.dependency-cruiser.cjs')).toBe(true);
    });
  });

  describe('Test 6.2: Skips depcruise config when no architecture', () => {
    it('should not create depcruise configs for simple project', async () => {
      createTypeScriptProjectReadyForSetup(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Create simple project without architecture directories
      writeTestFile(temporaryDirectory, 'index.ts', 'console.log("hello");');

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Should NOT create depcruise configs (no architecture detected)
      expect(fileExists(temporaryDirectory, '.safeword/depcruise-config.cjs')).toBe(false);
      expect(fileExists(temporaryDirectory, '.dependency-cruiser.cjs')).toBe(false);
    });
  });

  describe('Test 6.3: Logs detected architecture', () => {
    it('should output detected architecture during setup', async () => {
      createTypeScriptProjectReadyForSetup(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Create architecture directories
      writeTestFile(temporaryDirectory, 'src/utils/helper.ts', 'export const x = 1;');
      writeTestFile(
        temporaryDirectory,
        'src/components/Button.tsx',
        'export const Button = () => null;',
      );

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Should log what was detected
      expect(result.stdout).toMatch(/architecture detected/i);
    });
  });

  describe('Test 6.4: Includes arch files in setup summary', () => {
    it('should list depcruise files in created files summary', async () => {
      createTypeScriptProjectReadyForSetup(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Create architecture directory
      writeTestFile(temporaryDirectory, 'src/utils/helper.ts', 'export const x = 1;');

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Should mention depcruise files in output
      expect(result.stdout).toContain('.dependency-cruiser.cjs');
    });
  });

  describe('Test 6.5: Explains the wrapper file when newly created', () => {
    it('should emit an explainer for .dependency-cruiser.cjs on first creation', async () => {
      createTypeScriptProjectReadyForSetup(temporaryDirectory);
      initGitRepo(temporaryDirectory);
      writeTestFile(temporaryDirectory, 'src/utils/helper.ts', 'export const x = 1;');

      const result = await runCli(['setup'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(fileExists(temporaryDirectory, '.dependency-cruiser.cjs')).toBe(true);
      // Explainer tells the customer what the file is and how to extend it
      expect(result.stdout).toContain('extends rules from .safeword/depcruise-config.cjs');
    });
  });

  describe('Test 6.6: Skips explainer when wrapper already exists', () => {
    it('should not emit the explainer when .dependency-cruiser.cjs preexists', async () => {
      createTypeScriptProjectReadyForSetup(temporaryDirectory);
      initGitRepo(temporaryDirectory);
      writeTestFile(temporaryDirectory, 'src/utils/helper.ts', 'export const x = 1;');
      // Customer (or a prior setup) already created the wrapper with custom rules
      const customWrapper = `module.exports = { forbidden: [], options: {} };`;
      writeTestFile(temporaryDirectory, '.dependency-cruiser.cjs', customWrapper);

      const result = await runCli(['setup'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      // Wrapper preserved
      expect(readTestFile(temporaryDirectory, '.dependency-cruiser.cjs')).toBe(customWrapper);
      // No explainer — customer already knows about the file
      expect(result.stdout).not.toContain('extends rules from .safeword/depcruise-config.cjs');
    });
  });
});
