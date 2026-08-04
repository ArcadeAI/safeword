/**
 * SLOW E2E Test: Non-Git Dependency Installation
 *
 * This is the focused physical-install proof for setup's non-repository path.
 * It is excluded from the default test run and executed explicitly in CI.
 */

import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  INSTALL_DEPENDENCIES_ENV,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
} from '../helpers';

const INSTALL_TIMEOUT = 600_000;

describe('E2E: Non-Git Dependency Installation', () => {
  let projectDirectory: string;

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it(
    'installs base dependencies in a non-git directory',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createTypeScriptPackageJson(projectDirectory);

      const result = await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        env: INSTALL_DEPENDENCIES_ENV,
        timeout: INSTALL_TIMEOUT,
      });

      expect(result.exitCode).toBe(0);
      expect(
        existsSync(nodePath.join(projectDirectory, 'node_modules', 'eslint', 'package.json')),
      ).toBe(true);
      expect(
        existsSync(nodePath.join(projectDirectory, 'node_modules', 'safeword', 'package.json')),
      ).toBe(true);

      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies?.eslint).toBeDefined();
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    INSTALL_TIMEOUT,
  );
});
