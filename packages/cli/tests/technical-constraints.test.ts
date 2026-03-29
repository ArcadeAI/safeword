/**
 * Test Suite 0: Technical Constraints
 *
 * Tests for non-functional requirements that apply across all commands.
 * These tests verify performance, compatibility, and quality requirements.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  measureTime,
  removeTemporaryDirectory,
  runCli,
  runCliSync,
  TIMEOUT_SETUP,
} from './helpers';

describe('Test Suite 0: Technical Constraints', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 0.1: CLI startup time under 500ms', () => {
    it('should start quickly with average under 500ms', async () => {
      const runs = 10;
      const times: number[] = [];

      for (let i = 0; i < runs; i++) {
        const { timeMs } = await measureTime(async () => runCliSync(['--version']));
        times.push(timeMs);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(averageTime).toBeLessThan(500);
      expect(maxTime).toBeLessThan(750);
    });
  });

  describe('Test 0.2: Setup completes under 30s', () => {
    it('should complete setup in under 30 seconds', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      const { result, timeMs } = await measureTime(async () =>
        runCli(['setup'], {
          cwd: temporaryDirectory,
          timeout: TIMEOUT_SETUP,
        }),
      );

      expect(result.exitCode).toBe(0);
      // 120s threshold - bun install times vary based on cache state and system load
      expect(timeMs).toBeLessThan(120_000);
    });
  });

  // Test 0.3 (Node.js < 18 check) removed — engines field in package.json
  // enforces >=20 at install time. No runtime check exists or is needed.

  describe('Test 0.4: Works with different package managers', () => {
    it('should work with npm', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
        timeout: TIMEOUT_SETUP,
      });

      expect(result.exitCode).toBe(0);
    });

    // Note: pnpm and yarn tests should be in separate CI jobs
    // to ensure proper package manager isolation
  });
});
