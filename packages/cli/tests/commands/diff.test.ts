/**
 * Test Suite 10: Diff
 *
 * Tests for `safeword diff` command.
 */

import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

      expect(result.exitCode).toBe(2);

      expect(result.stdout).toContain('Planned effects:');

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

      const result = await runCli(['diff', '--json'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(2);

      const output = JSON.parse(result.stdout) as {
        data: { plan: { effects: { files: { kind: string }[] } } };
      };
      expect(output.data.plan.effects.files.map(effect => effect.kind)).toEqual(
        expect.arrayContaining([expect.stringMatching(/write|json-merge|text-patch/)]),
      );
    });
  });

  describe('Test 10.3: Shows version transition', () => {
    it('should show from/to versions', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Set older project version
      writeTestFile(temporaryDirectory, '.safeword/version', '1.0.0');

      const result = await runCli(['diff', '--json'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        schema_version: 1,
        state: 'action_required',
        data: { plan: { schema_version: 1, command: 'setup' } },
      });
    });

    it('does not consult the registry while planning', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      const result = await runCli(['diff'], {
        cwd: temporaryDirectory,
        env: registryLatestEnvironment('999.0.0'),
      });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).not.toContain('999.0.0');
      expect(result.stdout).toContain('Next: safeword setup');
    });

    it('does not let cached registry metadata change the local plan', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');
      writeUpdateCache('999.0.0');

      const result = await runCli(['diff'], {
        cwd: temporaryDirectory,
        env: registryFailureEnvironment(),
      });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).not.toContain('999.0.0');
      expect(result.stdout).toContain('Next: safeword setup');
    });

    it('still produces a local plan when project config is newer than the CLI', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.safeword/version', '999.0.0');

      const result = await runCli(['diff'], {
        cwd: temporaryDirectory,
        env: registryLatestEnvironment('999.1.0'),
      });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Next: safeword setup');
      expect(result.stdout).not.toContain('bunx');
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

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Planned effects:');
      expect(result.stdout).toMatch(/files: (write|json-merge|text-patch) /);
      expect(result.stdout).not.toMatch(/^@@.*@@/m);
    });
  });

  describe('Test 10.5: Unconfigured project plan', () => {
    it('should show the setup plan for an unconfigured project', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No setup

      const result = await runCli(['diff'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Planned effects:');
      expect(result.stdout).toContain('Next: safeword setup');
    });
  });
});
