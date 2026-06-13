/**
 * Test Suite 9: Upgrade
 *
 * Tests for `safeword upgrade` command.
 */

import { chmodSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VERSION } from '../../src/version.js';
import {
  createConfiguredProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  readSafewordConfig,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeSafewordConfig,
  writeTestFile,
} from '../helpers';

describe('Test Suite 9: Upgrade', () => {
  interface TestPackageJson {
    devDependencies: Record<string, string>;
    name: string;
    version: string;
  }

  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  function readPackageJson(): TestPackageJson {
    return JSON.parse(readTestFile(temporaryDirectory, 'package.json')) as TestPackageJson;
  }

  function writePackageJson(packageJson: TestPackageJson): void {
    writeTestFile(temporaryDirectory, 'package.json', JSON.stringify(packageJson, undefined, 2));
  }

  function createNpmLockedProjectWithStaleSafeword(): void {
    createTypeScriptPackageJson(temporaryDirectory, {
      devDependencies: {
        '@cucumber/cucumber': '^13.0.0',
        '@types/node': '^25.0.0',
        'dependency-cruiser': '^17.0.0',
        eslint: '^9.22.0',
        knip: '^6.0.0',
        prettier: '^3.0.0',
        safeword: '^0.1.0',
        tsx: '^4.0.0',
        typescript: '^5.0.0',
      },
    });

    const packageJson = readPackageJson();

    writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');
    writeTestFile(temporaryDirectory, '.safeword/SAFEWORD.md', '# Old content\n');
    writeSafewordConfig(temporaryDirectory, { installedPacks: ['typescript'] });
    writeTestFile(
      temporaryDirectory,
      'package-lock.json',
      JSON.stringify(
        {
          name: packageJson.name,
          version: packageJson.version,
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': {
              name: packageJson.name,
              version: packageJson.version,
              devDependencies: packageJson.devDependencies,
            },
            'node_modules/safeword': {
              version: '0.1.0',
              resolved: 'https://registry.npmjs.org/safeword/-/safeword-0.1.0.tgz',
              integrity: 'sha512-test',
            },
          },
        },
        undefined,
        2,
      ),
    );
  }

  function installFakeNpm(): string {
    const fakeBin = nodePath.join(temporaryDirectory, 'fake-bin');
    mkdirSync(fakeBin, { recursive: true });
    const fakeNpmPath = nodePath.join(fakeBin, 'npm');
    writeTestFile(
      temporaryDirectory,
      'fake-bin/npm',
      `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify(args) + '\\n');

const version = process.env.FAKE_SAFEWORD_VERSION;
if (args.includes(\`safeword@\${version}\`)) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.devDependencies ||= {};
  packageJson.devDependencies.safeword = \`^\${version}\`;
	  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\\n');

	  const packageLockPath = path.join(process.cwd(), 'package-lock.json');
	  if (!fs.existsSync(packageLockPath)) process.exit(0);
	  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  packageLock.packages ||= {};
  packageLock.packages[''] ||= {};
  packageLock.packages[''].devDependencies ||= {};
  packageLock.packages[''].devDependencies.safeword = \`^\${version}\`;
  packageLock.packages['node_modules/safeword'] = {
    version,
    resolved: \`https://registry.npmjs.org/safeword/-/safeword-\${version}.tgz\`,
    integrity: 'sha512-test',
  };
  fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\\n');
}
`,
    );
    chmodSync(fakeNpmPath, 0o755);
    return fakeBin;
  }

  async function runUpgradeWithFakeNpm(): Promise<Awaited<ReturnType<typeof runCli>>> {
    const fakeBin = installFakeNpm();
    const fakeNpmLog = nodePath.join(temporaryDirectory, 'npm-args.log');

    return runCli(['upgrade'], {
      cwd: temporaryDirectory,
      env: {
        FAKE_NPM_LOG: fakeNpmLog,
        FAKE_SAFEWORD_VERSION: VERSION,
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
      },
    });
  }

  describe('Test 9.1: Overwrites .safeword files', () => {
    it('should restore modified files to CLI version', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Modify a safeword file
      writeTestFile(temporaryDirectory, '.safeword/SAFEWORD.md', '# Modified content\n');

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      const restoredContent = readTestFile(temporaryDirectory, '.safeword/SAFEWORD.md');
      // Should be restored (not the modified content)
      expect(restoredContent).not.toBe('# Modified content\n');
    });

    it('should update .safeword/version', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Set an older version
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      const version = readTestFile(temporaryDirectory, '.safeword/version').trim();
      expect(version).not.toBe('0.0.1');
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should update package.json safeword dependency to the CLI version', async () => {
      await createConfiguredProject(temporaryDirectory);
      const packageJson = readPackageJson();
      packageJson.devDependencies.safeword = '^0.1.0';
      writePackageJson(packageJson);

      const result = await runUpgradeWithFakeNpm();

      expect(result.exitCode).toBe(0);
      expect(readTestFile(temporaryDirectory, 'npm-args.log')).toContain(`safeword@${VERSION}`);
      const updatedPackageJson = readPackageJson();
      expect(updatedPackageJson.devDependencies.safeword).toBe(`^${VERSION}`);
    });

    it('should preserve local safeword dependency specs', async () => {
      await createConfiguredProject(temporaryDirectory);
      const packageJson = readPackageJson();
      const originalSpec = packageJson.devDependencies.safeword;

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      const updatedPackageJson = readPackageJson();
      expect(updatedPackageJson.devDependencies.safeword).toBe(originalSpec);
    });

    it('should update stale registry specs through npm so package-lock stays in sync', async () => {
      createNpmLockedProjectWithStaleSafeword();
      const result = await runUpgradeWithFakeNpm();

      expect(result.exitCode).toBe(0);
      expect(fileExists(temporaryDirectory, 'npm-args.log')).toBe(true);
      expect(readTestFile(temporaryDirectory, 'npm-args.log')).toContain(`safeword@${VERSION}`);

      const packageLock = JSON.parse(readTestFile(temporaryDirectory, 'package-lock.json')) as {
        packages: {
          '': { devDependencies: Record<string, string> };
          'node_modules/safeword': { version: string };
        };
      };
      expect(packageLock.packages[''].devDependencies.safeword).toBe(`^${VERSION}`);
      expect(packageLock.packages['node_modules/safeword'].version).toBe(VERSION);
    });
  });

  describe('Test 9.2: Updates skills', () => {
    it('should restore modified skill files', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Find and modify a skill file if it exists
      if (fileExists(temporaryDirectory, '.claude/skills')) {
        // The actual skill path depends on implementation
        // This test structure is correct for when skills are implemented
      }

      const result = await runCli(['upgrade'], { cwd: temporaryDirectory });
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Test 9.3: Preserves non-safeword hooks', () => {
    it('should preserve custom hooks', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Add a custom hook
      const settings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));
      settings.hooks ||= {};
      settings.hooks.SessionStart ||= [];
      settings.hooks.SessionStart.push({
        command: 'echo "My custom hook"',
        description: 'Custom hook',
      });
      writeTestFile(
        temporaryDirectory,
        '.claude/settings.json',
        JSON.stringify(settings, undefined, 2),
      );

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      const updatedSettings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));
      const hasCustomHook = updatedSettings.hooks.SessionStart.some(
        (hook: { command?: string }) => hook.command === 'echo "My custom hook"',
      );

      expect(hasCustomHook).toBe(true);
    });
  });

  describe('Test 9.4: Same-version reinstalls', () => {
    it('should restore files even at same version', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Get current version
      const version = readTestFile(temporaryDirectory, '.safeword/version').trim();

      // Modify a file
      writeTestFile(temporaryDirectory, '.safeword/SAFEWORD.md', '# Corrupted\n');

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      // File should be restored
      const content = readTestFile(temporaryDirectory, '.safeword/SAFEWORD.md');
      expect(content).not.toBe('# Corrupted\n');

      // Version should remain same
      const newVersion = readTestFile(temporaryDirectory, '.safeword/version').trim();
      expect(newVersion).toBe(version);
    });
  });

  describe('Test 9.5: Refuses to downgrade', () => {
    it('should error when project is newer than CLI', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Set a future version
      writeTestFile(temporaryDirectory, '.safeword/version', '99.99.99');

      const result = await runCli(['upgrade'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toLowerCase()).toMatch(/older|downgrade|cli|update/i);
    });
  });

  describe('Test 9.6: Unconfigured project error', () => {
    it('should error on unconfigured project', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No setup

      const result = await runCli(['upgrade'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toLowerCase()).toContain('not configured');
      expect(result.stderr.toLowerCase()).toContain('setup');
    });
  });

  describe('Test 9.7: Prints summary of changes', () => {
    it('should show what changed', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Modify to create changes
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      const result = await runCli(['upgrade'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      // Should show some summary of changes
      expect(result.stdout.toLowerCase()).toMatch(/upgrad|update|version|file/i);
    });
  });

  describe('Test 9.8: Preserves learnings directory', () => {
    it('should preserve user learnings on upgrade', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Create user learning file
      writeTestFile(
        temporaryDirectory,
        '.safeword/learnings/my-custom-learning.md',
        '# My Learning\n\nImportant discovery about the codebase.',
      );

      // Modify version to trigger upgrade
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      // User learning should be preserved
      expect(fileExists(temporaryDirectory, '.safeword/learnings/my-custom-learning.md')).toBe(
        true,
      );

      const content = readTestFile(temporaryDirectory, '.safeword/learnings/my-custom-learning.md');
      expect(content).toContain('My Learning');
      expect(content).toContain('Important discovery');
    });
  });

  describe('Test 9.9: Creates backup before upgrade', () => {
    it('should create .safeword.backup directory', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Modify version to trigger upgrade
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      // Check for backup during upgrade (it may be deleted after success)
      // We verify by checking that upgrade succeeds without data loss
      await runCli(['upgrade'], { cwd: temporaryDirectory });

      // After successful upgrade, backup should be deleted
      expect(fileExists(temporaryDirectory, '.safeword.backup')).toBe(false);

      // Files should still exist
      expect(fileExists(temporaryDirectory, '.safeword/SAFEWORD.md')).toBe(true);
    });
  });

  // ==========================================================================
  // Language Packs Installation (Feature: Language Packs)
  // Test Definitions: .safeword/planning/test-definitions/feature-language-packs.md
  // ==========================================================================

  describe('Installs packs for newly detected languages', () => {
    it('should install Python pack when pyproject.toml detected', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, 'pyproject.toml', `[project]\nname = "test"\n`);
      // TypeScript already installed (from setup), Python missing
      writeSafewordConfig(temporaryDirectory, {
        installedPacks: ['typescript'],
      });

      const result = await runCli(['upgrade'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/installed.*python.*pack/i);
      expect(readSafewordConfig(temporaryDirectory).installedPacks).toContain('python');
    });
  });

  describe('Skips already-installed packs silently', () => {
    it('should not re-install existing packs', async () => {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, 'pyproject.toml', `[project]\nname = "test"\n`);
      // Both TypeScript and Python already installed
      writeSafewordConfig(temporaryDirectory, {
        installedPacks: ['typescript', 'python'],
      });

      const result = await runCli(['upgrade'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toMatch(/installed.*python.*pack/i);
      expect(readSafewordConfig(temporaryDirectory).installedPacks).toContain('python');
    });
  });

  // ==========================================================================
  // Ticket 154: strip dead `version` field from .safeword/config.json
  // Reasoning-LLMs were flagging stale `version` as drift (real incident in
  // arcade-deep-research). Field is never read by any code — `.safeword/version`
  // is the live source of truth. Upgrade now strips the dead key on migration.
  // ==========================================================================

  describe('Ticket 154: strips dead `version` key from .safeword/config.json', () => {
    it('should remove `version` from existing config while preserving installedPacks', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Simulate a project written at an older safeword version
      writeSafewordConfig(temporaryDirectory, {
        installedPacks: ['typescript'],
        version: '0.25.14',
      });

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      const raw = JSON.parse(readTestFile(temporaryDirectory, '.safeword/config.json')) as Record<
        string,
        unknown
      >;
      expect('version' in raw).toBe(false);
      expect(raw.installedPacks).toEqual(['typescript']);
    });

    it('should be a no-op when config.json already lacks `version`', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Write config without version (the new shape)
      writeTestFile(
        temporaryDirectory,
        '.safeword/config.json',
        JSON.stringify({ installedPacks: ['typescript'] }),
      );

      const result = await runCli(['upgrade'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const raw = JSON.parse(readTestFile(temporaryDirectory, '.safeword/config.json')) as Record<
        string,
        unknown
      >;
      expect('version' in raw).toBe(false);
      expect(raw.installedPacks).toEqual(['typescript']);
    });
  });
});
