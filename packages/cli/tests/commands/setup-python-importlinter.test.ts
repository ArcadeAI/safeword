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
import { existsSync, rmSync } from 'node:fs';
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

/** A user-authored import-linter INI, distinct from any safeword scaffold. */
const USER_INI =
  '[importlinter]\nroot_package = mypkg\n\n[importlinter:contract:mine]\nname = Mine\ntype = independence\nmodules = mypkg.alpha\n';

/** A user-added extra contract, appended to a scaffold to make it "extended". */
const USER_CONTRACT_SUFFIX =
  '\n[importlinter:contract:mine]\nname = Mine\ntype = independence\nmodules = mypkg.alpha\n';

/** Create a flat single-package fixture and run safeword setup on it. */
async function setUpFlatProject(): Promise<void> {
  createFlatSinglePackageProject(state.projectDirectory);
  initGitRepo(state.projectDirectory);
  await runCli(['setup'], {
    cwd: state.projectDirectory,
    env: SKIP_INSTALL_ENV,
    timeout: TIMEOUT_SETUP,
  });
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
      writeTestFile(state.projectDirectory, 'setup.cfg', USER_INI);
      initGitRepo(state.projectDirectory);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(false);
      expect(readTestFile(state.projectDirectory, 'setup.cfg')).toBe(USER_INI);
    },
    TIMEOUT_SETUP,
  );

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

describe('python-importlinter-scaffold.TB1.R3 — ambiguous package layout scaffolds nothing', () => {
  it(
    'a scripts-only Python project gets no scaffold',
    async () => {
      createPythonProject(state.projectDirectory);
      createSafewordBasePackageJson(state.projectDirectory);
      writeTestFile(state.projectDirectory, 'run.py', 'print("script")\n');
      initGitRepo(state.projectDirectory);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(false);
    },
    TIMEOUT_SETUP,
  );

  it.each([
    [
      'two importable packages at the repo root',
      ['alpha/__init__.py', 'beta/__init__.py'],
      'setup',
    ],
    [
      'one package at the repo root and one under src/',
      ['alpha/__init__.py', 'src/beta/__init__.py'],
      'setup',
    ],
    [
      'two importable packages at the repo root',
      ['alpha/__init__.py', 'beta/__init__.py'],
      'upgrade',
    ],
  ])(
    '%s gets no scaffold (%s)',
    async (_layout, files, command) => {
      createPythonProject(state.projectDirectory);
      createSafewordBasePackageJson(state.projectDirectory);
      for (const f of files) writeTestFile(state.projectDirectory, f, '');
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

      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(false);
    },
    TIMEOUT_SETUP * 2,
  );
});

describe('python-importlinter-scaffold.TB1.R4 — create-once lifecycle (upgrade)', () => {
  async function runUpgrade(): Promise<void> {
    await runCli(['upgrade'], {
      cwd: state.projectDirectory,
      env: SKIP_INSTALL_ENV,
      timeout: TIMEOUT_SETUP,
    });
  }

  it(
    'upgrade scaffolds .importlinter for a previously-set-up project that lacks one',
    async () => {
      await setUpFlatProject();
      // Simulate a project set up before this feature existed
      rmSync(nodePath.join(state.projectDirectory, '.importlinter'));

      await runUpgrade();

      const config = readTestFile(state.projectDirectory, '.importlinter');
      expect(config).toContain('root_package = mypkg');
      expect(config).toContain('type = acyclic_siblings');
    },
    TIMEOUT_SETUP * 2,
  );

  it(
    'upgrade is idempotent over an unmodified scaffold',
    async () => {
      await setUpFlatProject();
      const before = readTestFile(state.projectDirectory, '.importlinter');

      await runUpgrade();

      expect(readTestFile(state.projectDirectory, '.importlinter')).toBe(before);
    },
    TIMEOUT_SETUP * 2,
  );

  it(
    'upgrade preserves a user-extended scaffold',
    async () => {
      await setUpFlatProject();
      const extended = readTestFile(state.projectDirectory, '.importlinter') + USER_CONTRACT_SUFFIX;
      writeTestFile(state.projectDirectory, '.importlinter', extended);

      await runUpgrade();

      expect(readTestFile(state.projectDirectory, '.importlinter')).toBe(extended);
    },
    TIMEOUT_SETUP * 2,
  );
});

describe('python-importlinter-scaffold.TB1.R4 — create-once lifecycle (reset)', () => {
  async function runReset(): Promise<void> {
    await runCli(['reset', '--yes'], {
      cwd: state.projectDirectory,
      env: SKIP_INSTALL_ENV,
      timeout: TIMEOUT_SETUP,
    });
  }

  it(
    'reset removes an unmodified safeword-scaffolded config',
    async () => {
      await setUpFlatProject();
      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(true);

      await runReset();

      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(false);
    },
    TIMEOUT_SETUP * 2,
  );

  it(
    'reset preserves a user-extended scaffold',
    async () => {
      await setUpFlatProject();
      const extended = readTestFile(state.projectDirectory, '.importlinter') + USER_CONTRACT_SUFFIX;
      writeTestFile(state.projectDirectory, '.importlinter', extended);

      await runReset();

      expect(readTestFile(state.projectDirectory, '.importlinter')).toBe(extended);
    },
    TIMEOUT_SETUP * 2,
  );

  it(
    'reset preserves a user-authored import-linter config',
    async () => {
      createFlatSinglePackageProject(state.projectDirectory);
      writeTestFile(state.projectDirectory, '.importlinter', USER_INI);
      initGitRepo(state.projectDirectory);
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      await runReset();

      expect(readTestFile(state.projectDirectory, '.importlinter')).toBe(USER_INI);
    },
    TIMEOUT_SETUP * 2,
  );
});

describe("python-importlinter-scaffold.TB1.R5 — installed with the pack's other Python tools", () => {
  it(
    'a failed installation surfaces the package-manager-appropriate install command',
    async () => {
      // pip projects never auto-install (deliberate); the guidance line always
      // prints, making this the deterministic cross-environment failure fixture.
      createFlatSinglePackageProject(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      const result = await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      expect(result.stdout).toContain('Install Python tools');
      expect(result.stdout).toMatch(/pip install .*import-linter/);
    },
    TIMEOUT_SETUP,
  );

  it(
    "setup installs import-linter alongside the pack's other Python tools",
    async () => {
      // uv-managed fixture: the "Installing Python tools (…)" intent line names
      // the tool set regardless of whether the local uv install then succeeds.
      createPythonProject(state.projectDirectory, { manager: 'uv' });
      createSafewordBasePackageJson(state.projectDirectory);
      writeTestFile(state.projectDirectory, 'mypkg/__init__.py', '');
      initGitRepo(state.projectDirectory);

      const result = await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      expect(result.stdout).toMatch(
        /Installing Python tools \(.*import-linter.*\)|Install Python tools: uv add --dev .*import-linter/,
      );
    },
    TIMEOUT_SETUP,
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
