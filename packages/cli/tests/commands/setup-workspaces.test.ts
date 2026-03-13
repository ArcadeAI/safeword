/**
 * Test Suite: Setup - Workspace Format Scripts
 *
 * Tests for monorepo workspace format script injection.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_BUN_INSTALL,
} from '../helpers';

function createMonorepoPackageJson(
  dir: string,
  workspaces: string[],
  extraConfig: Record<string, unknown> = {},
): void {
  const pkg = {
    name: 'test-monorepo',
    version: '1.0.0',
    workspaces,
    devDependencies: {
      typescript: '^5.0.0',
    },
    ...extraConfig,
  };
  writeFileSync(nodePath.join(dir, 'package.json'), JSON.stringify(pkg, undefined, 2));
}

function createWorkspacePackage(
  dir: string,
  name: string,
  scripts: Record<string, string> = {},
): void {
  const packageDirectory = nodePath.join(dir, name);
  mkdirSync(packageDirectory, { recursive: true });
  const pkg = {
    name: `@test/${nodePath.basename(name)}`,
    version: '1.0.0',
    scripts,
  };
  writeFileSync(nodePath.join(packageDirectory, 'package.json'), JSON.stringify(pkg, undefined, 2));
}

describe('Setup - Workspace Format Scripts', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it(
    'should add format script to workspace packages without one',
    async () => {
      // Create monorepo structure
      createMonorepoPackageJson(temporaryDirectory, ['packages/app', 'packages/lib']);
      createWorkspacePackage(temporaryDirectory, 'packages/app', {
        build: 'tsc',
      });
      createWorkspacePackage(temporaryDirectory, 'packages/lib', {
        build: 'tsc',
      });
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
        env: { SAFEWORD_SKIP_INSTALL: '1' },
      });

      expect(result.exitCode).toBe(0);

      // Check workspace packages have format scripts
      const appPackage = JSON.parse(readTestFile(temporaryDirectory, 'packages/app/package.json'));
      const libraryPackage = JSON.parse(
        readTestFile(temporaryDirectory, 'packages/lib/package.json'),
      );

      expect(appPackage.scripts.format).toBe('prettier --write .');
      expect(libraryPackage.scripts.format).toBe('prettier --write .');
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'should not overwrite existing format script',
    async () => {
      createMonorepoPackageJson(temporaryDirectory, ['packages/app']);
      createWorkspacePackage(temporaryDirectory, 'packages/app', {
        format: 'biome format .',
      });
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      const appPackage = JSON.parse(readTestFile(temporaryDirectory, 'packages/app/package.json'));
      expect(appPackage.scripts.format).toBe('biome format .');
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'should handle glob workspace patterns',
    async () => {
      createMonorepoPackageJson(temporaryDirectory, ['packages/*']);
      createWorkspacePackage(temporaryDirectory, 'packages/core', {});
      createWorkspacePackage(temporaryDirectory, 'packages/utils', {});
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      const corePackage = JSON.parse(
        readTestFile(temporaryDirectory, 'packages/core/package.json'),
      );
      const utilitiesPackage = JSON.parse(
        readTestFile(temporaryDirectory, 'packages/utils/package.json'),
      );

      expect(corePackage.scripts.format).toBe('prettier --write .');
      expect(utilitiesPackage.scripts.format).toBe('prettier --write .');
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'should skip if root has existing formatter config',
    async () => {
      createMonorepoPackageJson(temporaryDirectory, ['packages/app']);
      createWorkspacePackage(temporaryDirectory, 'packages/app', {});
      // Create biome.json to indicate existing formatter
      writeFileSync(nodePath.join(temporaryDirectory, 'biome.json'), '{}');
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      const appPackage = JSON.parse(readTestFile(temporaryDirectory, 'packages/app/package.json'));
      // Should NOT have format script since root uses Biome
      expect(appPackage.scripts.format).toBeUndefined();
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'should handle Yarn workspace object format',
    async () => {
      // Yarn workspaces use { packages: [...] } format
      const pkg = {
        name: 'test-monorepo',
        version: '1.0.0',
        workspaces: { packages: ['packages/app'] },
        devDependencies: { typescript: '^5.0.0' },
      };
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify(pkg, undefined, 2),
      );
      createWorkspacePackage(temporaryDirectory, 'packages/app', {});
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      const appPackage = JSON.parse(readTestFile(temporaryDirectory, 'packages/app/package.json'));
      expect(appPackage.scripts.format).toBe('prettier --write .');
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'should gracefully skip non-existent workspace directories',
    async () => {
      // Reference a workspace that doesn't exist
      createMonorepoPackageJson(temporaryDirectory, ['packages/exists', 'packages/missing']);
      createWorkspacePackage(temporaryDirectory, 'packages/exists', {});
      // Don't create packages/missing
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);

      // Existing package should still get format script
      const existsPackage = JSON.parse(
        readTestFile(temporaryDirectory, 'packages/exists/package.json'),
      );
      expect(existsPackage.scripts.format).toBe('prettier --write .');
    },
    TIMEOUT_BUN_INSTALL,
  );
});
