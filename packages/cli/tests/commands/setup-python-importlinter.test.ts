/**
 * Ticket V4MATC (upstream #847): Python pack scaffolds a generic import-linter
 * config so audit's architecture check runs out of the box.
 *
 * Feature source: features/python-importlinter-scaffold.feature
 * Ledger: .project/tickets/V4MATC-python-importlinter-scaffold/test-definitions.md
 *
 * These are the integration proofs (real CLI on fixture repos, mocking nothing).
 * The lint-imports E2E teeth run in the cucumber lane / guarded suite.
 */

import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createPythonProject,
  createSafewordBasePackageJson,
  createTemporaryDirectory,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  SKIP_INSTALL_ENV,
  TIMEOUT_SETUP,
  writeTestFile,
} from '../helpers';

const state: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  state.projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (state.projectDirectory) {
    removeTemporaryDirectory(state.projectDirectory);
  }
});

/** Flat single-package Python project (no layer structure): pyproject + one root package. */
function createFlatSinglePackageProject(dir: string, packageName = 'mypkg'): void {
  createPythonProject(dir);
  createSafewordBasePackageJson(dir);
  writeTestFile(dir, `${packageName}/__init__.py`, '');
  writeTestFile(dir, `${packageName}/core.py`, 'VALUE = 1\n');
}

function fileExists(dir: string, filename: string): boolean {
  return existsSync(nodePath.join(dir, filename));
}

describe('python-importlinter-scaffold.TB1.R1 — working cycle check with zero manual configuration', () => {
  it(
    'setup scaffolds .importlinter for a flat single-package project',
    async () => {
      createFlatSinglePackageProject(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(true);
      const config = readTestFile(state.projectDirectory, '.importlinter');
      expect(config).toContain('[importlinter]');
      expect(config).toContain('root_package = mypkg');
      expect(config).toContain('type = acyclic_siblings');
      expect(config).toContain('ancestors = mypkg');
    },
    TIMEOUT_SETUP,
  );
});
