/**
 * Test Suite 5: Setup Converges Existing Projects
 *
 * Tests for convergent setup when already configured.
 */

import { mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('Test Suite 5: Setup Converges Existing Projects', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 5.1: Reconcile when .safeword exists', () => {
    it('should converge successfully when .safeword/ already exists', async () => {
      createTypeScriptPackageJson(temporaryDirectory);

      // Create existing .safeword directory
      mkdirSync(nodePath.join(temporaryDirectory, '.safeword'));

      const result = await runCli(['setup'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
    });
  });

  describe('Test 5.2: User files survive convergence', () => {
    it('should preserve unrelated user files while converging', async () => {
      createTypeScriptPackageJson(temporaryDirectory);

      // Create existing .safeword directory
      mkdirSync(nodePath.join(temporaryDirectory, '.safeword'));

      // Create AGENTS.md with known content
      const originalContent = '# Original AGENTS.md\n\nThis should not change.\n';
      writeTestFile(temporaryDirectory, 'AGENTS.md', originalContent);

      const result = await runCli(['setup'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);

      // AGENTS.md should be unchanged
      const content = readTestFile(temporaryDirectory, 'AGENTS.md');
      expect(content).toBe(originalContent);

      expect(fileExists(temporaryDirectory, '.safeword/skills')).toBe(true);
      expect(fileExists(temporaryDirectory, '.claude')).toBe(false);
      expect(fileExists(temporaryDirectory, 'eslint.config.mjs')).toBe(true);
      expect(fileExists(temporaryDirectory, '.prettierrc')).toBe(true);
    });
  });
});
