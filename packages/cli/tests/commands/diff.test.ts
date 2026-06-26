/**
 * Test Suite 10: Diff
 *
 * Tests for `safeword diff` command.
 */

import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VERSION } from '../../src/version.js';
import {
  createConfiguredProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('Test Suite 10: Diff', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  function writeUpdateCache(latestVersion: string): void {
    writeTestFile(
      temporaryDirectory,
      '.safeword/.update-cache.json',
      JSON.stringify({ latestVersion }),
    );
  }

  function registryMockEnvironment(script: string): Record<string, string> {
    writeTestFile(temporaryDirectory, 'mock-registry.mjs', script);
    const mockPath = nodePath.join(temporaryDirectory, 'mock-registry.mjs');
    return {
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(mockPath).href}`]
        .filter(Boolean)
        .join(' '),
    };
  }

  function registryLatestEnvironment(latestVersion: string): Record<string, string> {
    return registryMockEnvironment(`globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ version: ${JSON.stringify(latestVersion)} }),
});
`);
  }

  function registryFailureEnvironment(): Record<string, string> {
    return registryMockEnvironment(`globalThis.fetch = async () => {
  throw new Error('offline');
};
`);
  }

  describe('Test 10.1: Shows summary by default', () => {
    it('should show file counts without full diff', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Modify version to create differences
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      const result = await runCli(['diff'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);

      // Should show counts
      expect(result.stdout).toMatch(/\d+/);

      // Should NOT show full diff markers by default
      expect(result.stdout).not.toMatch(/^[+-]{3}/m);
      expect(result.stdout).not.toMatch(/^@@/m);
    });
  });

  describe('Test 10.2: Lists files by category', () => {
    it('should categorize files as Added, Modified, or Unchanged', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Create a difference
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      const result = await runCli(['diff'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);

      // Should have some categorization
      const output = result.stdout.toLowerCase();
      expect(output).toMatch(/add|modif|chang|updat|unchanged/i);
    });
  });

  describe('Test 10.3: Shows version transition', () => {
    it('should show from/to versions', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Set older project version
      writeTestFile(temporaryDirectory, '.safeword/version', '1.0.0');

      const result = await runCli(['diff'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);

      // Should show version info
      expect(result.stdout).toContain('1.0.0');
      // Should show transition (→ or similar)
      expect(result.stdout).toMatch(/→|->|to|from/);
    });

    it('uses the registry latest version as the upgrade target', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      const result = await runCli(['diff'], {
        cwd: temporaryDirectory,
        env: registryLatestEnvironment('999.0.0'),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Changes from v0.0.1 → v999.0.0');
      expect(result.stdout).not.toContain(`→ v${VERSION}`);
    });

    it('falls back to the cached latest version when the registry is unavailable', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');
      writeUpdateCache('999.0.0');

      const result = await runCli(['diff'], {
        cwd: temporaryDirectory,
        env: registryFailureEnvironment(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Changes from v0.0.1 → v999.0.0');
    });

    it('warns when the project config is newer than the running CLI', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.safeword/version', '999.0.0');

      const result = await runCli(['diff'], {
        cwd: temporaryDirectory,
        env: registryLatestEnvironment('999.1.0'),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain(`CLI v${VERSION} is older than project v999.0.0`);
      expect(result.stderr).toContain('bunx safeword@999.1.0 diff');
    });
  });

  describe('Test 10.4: --verbose shows full diff', () => {
    it('should show unified diff with --verbose', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Create a modification
      writeTestFile(temporaryDirectory, '.safeword/SAFEWORD.md', '# Modified\n');

      const result = await runCli(['diff', '--verbose'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Should show unified diff format
      // --- file
      // +++ file
      // @@ line numbers @@
      expect(result.stdout).toMatch(/^---/m);
      expect(result.stdout).toMatch(/^\+\+\+/m);
      expect(result.stdout).toMatch(/^@@.*@@/m);
    });
  });

  describe('Test 10.5: Unconfigured project error', () => {
    it('should error on unconfigured project', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No setup

      const result = await runCli(['diff'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toLowerCase()).toContain('not configured');
    });
  });
});
