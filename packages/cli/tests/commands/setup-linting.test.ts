/**
 * Test Suite 4: Setup - Linting (Integration Tests)
 *
 * Tests for ESLint + Prettier configuration.
 *
 * Note: Unit tests for project type detection (Tests 4.1-4.3) are in
 * src/utils/project-detector.test.ts. This file contains only the
 * integration tests (Tests 4.4-4.8).
 */

import { chmodSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
} from '../helpers';

describe('Test Suite 4: Setup - Linting (Integration)', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 4.4: Creates eslint.config.mjs', () => {
    it('should create ESLint flat config', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, 'eslint.config.mjs')).toBe(true);

      const content = readTestFile(temporaryDirectory, 'eslint.config.mjs');
      // Should be a valid ESLint flat config
      expect(content).toContain('export');
    });

    it('should include TypeScript config when detected', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const content = readTestFile(temporaryDirectory, 'eslint.config.mjs');
      expect(content).toMatch(/typescript|@typescript-eslint/i);
    });
  });

  describe('Test 4.5: Creates .prettierrc', () => {
    it('should create Prettier config', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.prettierrc')).toBe(true);

      const content = readTestFile(temporaryDirectory, '.prettierrc');
      // Should be valid JSON
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  describe('Test 4.6: Adds lint script to package.json', () => {
    it('should add lint script', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const packageJson = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      expect(packageJson.scripts?.lint).toBe('eslint .');
    });

    it('should not overwrite existing lint script', async () => {
      createTypeScriptPackageJson(temporaryDirectory, {
        scripts: {
          lint: 'eslint src/',
        },
      });
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const packageJson = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      // Original script should be preserved
      expect(packageJson.scripts?.lint).toBe('eslint src/');
    });
  });

  describe('Test 4.7: Adds format script to package.json', () => {
    it('should add format script', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const packageJson = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      expect(packageJson.scripts?.format).toBe('prettier --write .');
    });

    it('should not overwrite existing format script', async () => {
      createTypeScriptPackageJson(temporaryDirectory, {
        scripts: {
          format: 'prettier --write src/',
        },
      });
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const packageJson = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      // Original script should be preserved
      expect(packageJson.scripts?.format).toBe('prettier --write src/');
    });
  });

  describe('Test 4.8: Exit 1 if linting setup fails', () => {
    it('should fail with exit 1 when package.json is not writable', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Make package.json read-only
      chmodSync(nodePath.join(temporaryDirectory, 'package.json'), 0o444);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      // Restore permissions for cleanup
      chmodSync(nodePath.join(temporaryDirectory, 'package.json'), 0o644);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toLowerCase()).toMatch(/lint|permission|write|failed|package/i);
    });
  });

  describe('Test 4.9: Adds format:check script', () => {
    it('should add format:check script to package.json', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const packageJson = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      expect(packageJson.scripts?.['format:check']).toContain('prettier');
      expect(packageJson.scripts?.['format:check']).toContain('--check');
    });
  });
});
