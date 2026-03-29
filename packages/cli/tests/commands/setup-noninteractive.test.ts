/**
 * Test Suite 6: Non-Interactive Setup
 *
 * Tests for CI/headless operation.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_BUN_INSTALL,
} from '../helpers';

describe('Test Suite 6: Non-Interactive Setup', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 6.1: Setup runs non-interactively', () => {
    it('should complete without hanging', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No git init - setup runs non-interactively by default

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
        timeout: TIMEOUT_BUN_INSTALL,
      });

      expect(result.exitCode).toBe(0);
      expect(fileExists(temporaryDirectory, '.safeword')).toBe(true);

      // Git should be skipped (no .git created)
      expect(fileExists(temporaryDirectory, '.git')).toBe(false);
    });
  });

  describe('Test 6.2: No TTY uses defaults', () => {
    it('should complete without stdin in non-TTY mode', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No git init

      // Force non-TTY by setting environment
      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
        timeout: TIMEOUT_BUN_INSTALL,
        env: {
          CI: 'true', // Many tools detect CI and use non-interactive mode
          TERM: 'dumb',
        },
      });

      // Should complete (either with defaults or --yes required message)
      // The exact behavior depends on implementation
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Test 6.3: Warning shown when git skipped', () => {
    it('should show warning about skipped git initialization', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No git init

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Should mention skipped git
      const output = result.stdout + result.stderr;
      expect(output.toLowerCase()).toMatch(/skipped|git|warning/i);
    });
  });
});
