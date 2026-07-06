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

import { spawnSync } from 'node:child_process';
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

  it(
    'setup detects the package in a src layout',
    async () => {
      createPythonProject(state.projectDirectory);
      createSafewordBasePackageJson(state.projectDirectory);
      writeTestFile(state.projectDirectory, 'src/srcpkg/__init__.py', '');
      writeTestFile(state.projectDirectory, 'src/srcpkg/core.py', 'VALUE = 1\n');
      initGitRepo(state.projectDirectory);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      const config = readTestFile(state.projectDirectory, '.importlinter');
      expect(config).toContain('root_package = srcpkg');
      expect(config).toContain('ancestors = srcpkg');
    },
    TIMEOUT_SETUP,
  );
});

describe('python-importlinter-scaffold.TB1.R2 — existing import-linter config is never touched', () => {
  it(
    'setup leaves a project with setup.cfg [importlinter] untouched',
    async () => {
      createFlatSinglePackageProject(state.projectDirectory);
      const userConfig =
        '[importlinter]\nroot_package = mypkg\n\n[importlinter:contract:mine]\nname = My contract\ntype = independence\nmodules = mypkg.alpha\n';
      writeTestFile(state.projectDirectory, 'setup.cfg', userConfig);
      initGitRepo(state.projectDirectory);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(false);
      expect(readTestFile(state.projectDirectory, 'setup.cfg')).toBe(userConfig);
    },
    TIMEOUT_SETUP,
  );

  const USER_INI =
    '[importlinter]\nroot_package = mypkg\n\n[importlinter:contract:mine]\nname = My contract\ntype = independence\nmodules = mypkg.alpha\n';
  const USER_PYPROJECT_SUFFIX = '\n[tool.importlinter]\nroot_package = "mypkg"\n';

  // Remaining outline rows: config form × command. setup.cfg × setup is the
  // RED-driving test above; these pin the already-gated forms and the upgrade path.
  it.each([
    ['a .importlinter file', 'setup'],
    ['pyproject.toml [tool.importlinter]', 'setup'],
    ['a .importlinter file', 'upgrade'],
    ['pyproject.toml [tool.importlinter]', 'upgrade'],
  ])(
    '%s is untouched by safeword %s',
    async (form, command) => {
      createFlatSinglePackageProject(state.projectDirectory);
      const isFileForm = form === 'a .importlinter file';
      if (isFileForm) {
        writeTestFile(state.projectDirectory, '.importlinter', USER_INI);
      } else {
        const pyproject = readTestFile(state.projectDirectory, 'pyproject.toml');
        writeTestFile(state.projectDirectory, 'pyproject.toml', pyproject + USER_PYPROJECT_SUFFIX);
      }
      initGitRepo(state.projectDirectory);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });
      if (command === 'upgrade') {
        await runCli(['upgrade'], {
          cwd: state.projectDirectory,
          env: SKIP_INSTALL_ENV,
          timeout: TIMEOUT_SETUP,
        });
      }

      if (isFileForm) {
        expect(readTestFile(state.projectDirectory, '.importlinter')).toBe(USER_INI);
      } else {
        expect(fileExists(state.projectDirectory, '.importlinter')).toBe(false);
        expect(readTestFile(state.projectDirectory, 'pyproject.toml')).toContain(
          '[tool.importlinter]',
        );
      }
    },
    TIMEOUT_SETUP * 2,
  );
});

// E2E teeth: prove the scaffold is valid FOR THE REAL TOOL, not merely present.
// Guarded on binary availability (visible skip locally); CI installs import-linter
// via .github/requirements-ci.txt so these always run there.
const HAS_LINT_IMPORTS = spawnSync('lint-imports', ['--version'], { stdio: 'ignore' }).status === 0;

/** Run lint-imports in the project; returns exit status and combined output. */
function runLintImports(cwd: string): { status: number | null; output: string } {
  const result = spawnSync('lint-imports', [], { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('python-importlinter-scaffold.TB1.R1 — lint-imports teeth (E2E, real binary)', () => {
  it.skipIf(!HAS_LINT_IMPORTS)(
    'the scaffolded check passes against acyclic code',
    async () => {
      createFlatSinglePackageProject(state.projectDirectory);
      writeTestFile(state.projectDirectory, 'mypkg/alpha.py', 'VALUE = 1\n');
      writeTestFile(state.projectDirectory, 'mypkg/beta.py', 'from mypkg.alpha import VALUE\n');
      initGitRepo(state.projectDirectory);
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      expect(runLintImports(state.projectDirectory).status).toBe(0);
    },
    TIMEOUT_SETUP,
  );

  it.skipIf(!HAS_LINT_IMPORTS)(
    'the scaffolded check fails when a circular import is introduced',
    async () => {
      createFlatSinglePackageProject(state.projectDirectory);
      writeTestFile(state.projectDirectory, 'mypkg/alpha.py', 'VALUE = 1\n');
      writeTestFile(state.projectDirectory, 'mypkg/beta.py', 'from mypkg.alpha import VALUE\n');
      initGitRepo(state.projectDirectory);
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });
      // Introduce the cycle: alpha now imports beta, which imports alpha.
      writeTestFile(
        state.projectDirectory,
        'mypkg/alpha.py',
        'from mypkg.beta import VALUE as V2  # noqa\nVALUE = 1\n',
      );

      const { status, output } = runLintImports(state.projectDirectory);
      expect(status).not.toBe(0);
      expect(output).toContain('No circular imports between sibling modules (safeword)');
    },
    TIMEOUT_SETUP,
  );
});
