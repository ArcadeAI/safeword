/**
 * Acceptance steps for the Python import-linter scaffold (V4MATC, #847).
 *
 * Each scenario drives the REAL CLI (setup/upgrade/reset) on a throwaway
 * fixture project. Lifecycle scenarios run hermetically under
 * SAFEWORD_SKIP_INSTALL (scaffolding is reconciliation, not package install);
 * the R5 install scenarios run without it because installation IS the
 * behavior under test. lint-imports steps mark themselves skipped when the
 * binary is absent locally — CI installs it via .github/requirements-ci.txt.
 */

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');

const HAS_LINT_IMPORTS = spawnSync('lint-imports', ['--version'], { stdio: 'ignore' }).status === 0;

interface ImportLinterWorld extends SafewordWorld {
  projectDirectory?: string;
  packageName?: string;
  /** Path + content of a pre-existing user config (R2/R4 preservation checks). */
  savedConfig?: { relativePath: string; content: string };
  /** .importlinter content snapshot taken before the last command. */
  scaffoldBefore?: string;
  lintImports?: { status: number | null; output: string };
  setupOutput?: string;
  /** Set by R5 Givens: the scenario asserts install behavior, so setup must not skip it. */
  needsRealInstall?: boolean;
  /** Whether safeword setup has run on this fixture (outline upgrade rows bootstrap with it). */
  setupRan?: boolean;
}

function createProject(world: ImportLinterWorld, options: { manager?: 'uv' } = {}): string {
  const dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-importlinter-'));
  world.projectDirectory = dir;
  let pyproject = '[project]\nname = "fixture-project"\nversion = "0.1.0"\n';
  if (options.manager === 'uv') {
    writeFileSync(nodePath.join(dir, 'uv.lock'), '');
    pyproject += '\n[tool.uv]\n';
  }
  writeFileSync(nodePath.join(dir, 'pyproject.toml'), pyproject);
  writeFileSync(
    nodePath.join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', private: true }),
  );
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

function addPackage(dir: string, packagePath: string): void {
  const absolute = nodePath.join(dir, packagePath);
  mkdirSync(absolute, { recursive: true });
  writeFileSync(nodePath.join(absolute, '__init__.py'), '');
}

function runSafeword(
  world: ImportLinterWorld,
  command: 'setup' | 'upgrade' | 'reset',
  options: { skipInstall?: boolean } = {},
): void {
  const { skipInstall = true } = options;
  assert.ok(world.projectDirectory, 'fixture project must exist before running safeword');
  const commandArguments = command === 'reset' ? [command, '--yes'] : [command];
  const environment: Record<string, string | undefined> = {
    ...process.env,
    SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1',
  };
  if (skipInstall) environment.SAFEWORD_SKIP_INSTALL = '1';
  const result = spawnSync('bun', [CLI_PATH, ...commandArguments], {
    cwd: world.projectDirectory,
    env: environment,
    encoding: 'utf8',
  });
  world.setupOutput = `${result.stdout}${result.stderr}`;
  if (command === 'setup') world.setupRan = true;
}

function configPath(world: ImportLinterWorld): string {
  assert.ok(world.projectDirectory);
  return nodePath.join(world.projectDirectory, '.importlinter');
}

function readConfig(world: ImportLinterWorld): string {
  assert.ok(existsSync(configPath(world)), '.importlinter should exist');
  return readFileSync(configPath(world), 'utf8');
}

After(function (this: ImportLinterWorld) {
  if (this.projectDirectory === undefined) return;
  rmSync(this.projectDirectory, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Givens — fixtures
// ---------------------------------------------------------------------------

Given(
  'a Python project with exactly one importable package at the repo root',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    addPackage(dir, 'mypkg');
    writeFileSync(nodePath.join(dir, 'mypkg', 'alpha.py'), 'VALUE = 1\n');
    writeFileSync(nodePath.join(dir, 'mypkg', 'beta.py'), 'from mypkg.alpha import VALUE\n');
    this.packageName = 'mypkg';
  },
);

Given('no import-linter configuration in any form', function (this: ImportLinterWorld) {
  assert.ok(this.projectDirectory);
  assert.equal(existsSync(configPath(this)), false);
});

Given(
  'a Python project whose only importable package lives under src\\/',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    addPackage(dir, 'src/srcpkg');
    writeFileSync(nodePath.join(dir, 'src/srcpkg', 'core.py'), 'VALUE = 1\n');
    this.packageName = 'srcpkg';
  },
);

Given(
  'a Python project set up with the scaffolded .importlinter',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    addPackage(dir, 'mypkg');
    writeFileSync(nodePath.join(dir, 'mypkg', 'alpha.py'), 'VALUE = 1\n');
    writeFileSync(nodePath.join(dir, 'mypkg', 'beta.py'), 'from mypkg.alpha import VALUE\n');
    this.packageName = 'mypkg';
    runSafeword(this, 'setup');
    assert.ok(existsSync(configPath(this)), 'setup should have scaffolded .importlinter');
  },
);

Given('two sibling modules that import each other', function (this: ImportLinterWorld) {
  assert.ok(this.projectDirectory && this.packageName);
  const pkg = nodePath.join(this.projectDirectory, this.packageName);
  writeFileSync(
    nodePath.join(pkg, 'alpha.py'),
    `from ${this.packageName}.beta import VALUE as V2  # noqa\nVALUE = 1\n`,
  );
});

const USER_INI =
  '[importlinter]\nroot_package = mypkg\n\n[importlinter:contract:mine]\nname = Mine\ntype = independence\nmodules = mypkg.alpha\n';

function addExistingConfig(
  world: ImportLinterWorld,
  form: 'file' | 'setup.cfg' | 'pyproject',
): void {
  assert.ok(world.projectDirectory);
  if (form === 'file') {
    writeFileSync(configPath(world), USER_INI);
    world.savedConfig = { relativePath: '.importlinter', content: USER_INI };
  } else if (form === 'setup.cfg') {
    writeFileSync(nodePath.join(world.projectDirectory, 'setup.cfg'), USER_INI);
    world.savedConfig = { relativePath: 'setup.cfg', content: USER_INI };
  } else {
    const pyprojectPath = nodePath.join(world.projectDirectory, 'pyproject.toml');
    const content = `${readFileSync(pyprojectPath, 'utf8')}\n[tool.importlinter]\nroot_package = "mypkg"\n`;
    writeFileSync(pyprojectPath, content);
    world.savedConfig = { relativePath: 'pyproject.toml', content };
  }
}

Given(
  'an existing import-linter configuration as a .importlinter file',
  function (this: ImportLinterWorld) {
    addExistingConfig(this, 'file');
  },
);

Given(
  'an existing import-linter configuration as setup.cfg with [importlinter]',
  function (this: ImportLinterWorld) {
    addExistingConfig(this, 'setup.cfg');
  },
);

Given(
  'an existing import-linter configuration as pyproject.toml [tool.importlinter]',
  function (this: ImportLinterWorld) {
    addExistingConfig(this, 'pyproject');
  },
);

Given(
  'a Python project with a manifest but no importable package',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    writeFileSync(nodePath.join(dir, 'run.py'), 'print("script")\n');
  },
);

Given(
  'a Python project with two importable packages at the repo root',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    addPackage(dir, 'alpha');
    addPackage(dir, 'beta');
  },
);

Given(
  'a Python project with one importable package at the repo root and one under src\\/',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    addPackage(dir, 'alpha');
    addPackage(dir, 'src/beta');
  },
);

Given(
  'a Python project safeword previously set up before this feature existed',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    this.packageName = 'mypkg';
    addPackage(dir, 'mypkg');
    runSafeword(this, 'setup');
    // Simulate the pre-feature install state: no .importlinter was scaffolded then.
    rmSync(configPath(this), { force: true });
  },
);

Given('it has exactly one importable package at the repo root', function (this: ImportLinterWorld) {
  assert.ok(this.projectDirectory && this.packageName === 'mypkg');
});

Given(
  'a Python project that safeword previously set up with a scaffolded .importlinter',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    addPackage(dir, 'mypkg');
    this.packageName = 'mypkg';
    runSafeword(this, 'setup');
    this.scaffoldBefore = readConfig(this);
  },
);

Given('the file is unchanged since scaffolding', function (this: ImportLinterWorld) {
  assert.equal(readConfig(this), this.scaffoldBefore);
});

Given(
  'a Python project whose scaffolded .importlinter was extended by the user with an additional contract',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    addPackage(dir, 'mypkg');
    this.packageName = 'mypkg';
    runSafeword(this, 'setup');
    const extended = `${readConfig(this)}\n[importlinter:contract:mine]\nname = Mine\ntype = independence\nmodules = mypkg.alpha\n`;
    writeFileSync(configPath(this), extended);
    this.savedConfig = { relativePath: '.importlinter', content: extended };
  },
);

Given(
  'a Python project whose .importlinter existed before safeword setup',
  function (this: ImportLinterWorld) {
    const dir = createProject(this);
    addPackage(dir, 'mypkg');
    writeFileSync(configPath(this), USER_INI);
    this.savedConfig = { relativePath: '.importlinter', content: USER_INI };
    runSafeword(this, 'setup');
  },
);

Given(
  'a uv-managed single-package Python project where import-linter is not installed',
  function (this: ImportLinterWorld) {
    const dir = createProject(this, { manager: 'uv' });
    addPackage(dir, 'mypkg');
    this.packageName = 'mypkg';
    this.needsRealInstall = true;
  },
);

Given('a Python project where installing import-linter fails', function (this: ImportLinterWorld) {
  // pip projects never auto-install (deliberate) — the deterministic
  // cross-environment "installation cannot succeed" fixture.
  const dir = createProject(this);
  addPackage(dir, 'mypkg');
  this.packageName = 'mypkg';
});

// ---------------------------------------------------------------------------
// Whens
// ---------------------------------------------------------------------------

When('safeword setup runs', function (this: ImportLinterWorld) {
  runSafeword(this, 'setup', { skipInstall: this.needsRealInstall !== true });
});

When('safeword upgrade runs', function (this: ImportLinterWorld) {
  // Outline upgrade rows start from an un-setup fixture: bring it under
  // safeword first (hermetically), then run the upgrade under test.
  if (this.setupRan !== true) runSafeword(this, 'setup');
  if (existsSync(configPath(this))) {
    this.scaffoldBefore = readConfig(this);
  }
  runSafeword(this, 'upgrade');
});

When('safeword reset runs', function (this: ImportLinterWorld) {
  runSafeword(this, 'reset');
});

function runLintImports(world: ImportLinterWorld): { status: number | null; output: string } {
  assert.ok(world.projectDirectory);
  // src layouts need the package importable; PYTHONPATH=src is the hermetic
  // equivalent of the editable install a real project would have.
  const environment = { ...process.env };
  if (existsSync(nodePath.join(world.projectDirectory, 'src'))) environment.PYTHONPATH = 'src';
  const result = spawnSync('lint-imports', [], {
    cwd: world.projectDirectory,
    encoding: 'utf8',
    env: environment,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

When('lint-imports runs', function (this: ImportLinterWorld) {
  if (!HAS_LINT_IMPORTS) return 'skipped';
  this.lintImports = runLintImports(this);
});

// ---------------------------------------------------------------------------
// Thens
// ---------------------------------------------------------------------------

Then(
  'a .importlinter file exists naming that package as root_package',
  function (this: ImportLinterWorld) {
    assert.ok(this.packageName);
    assert.match(readConfig(this), new RegExp(`root_package = ${this.packageName}`));
  },
);

Then('it declares exactly one acyclic-siblings contract', function (this: ImportLinterWorld) {
  const config = readConfig(this);
  const matches = config.match(/type = acyclic_siblings/g) ?? [];
  assert.equal(matches.length, 1);
});

Then('lint-imports exits 0 in the project', function (this: ImportLinterWorld) {
  if (!HAS_LINT_IMPORTS) return 'skipped';
  const result = runLintImports(this);
  assert.equal(result.status, 0, `lint-imports failed:\n${result.output}`);
});

Then(
  'the .importlinter root_package names the package under src\\/',
  function (this: ImportLinterWorld) {
    assert.match(readConfig(this), /root_package = srcpkg/);
  },
);

Then('it exits non-zero naming the broken contract', function (this: ImportLinterWorld) {
  if (!HAS_LINT_IMPORTS) return 'skipped';
  assert.ok(this.lintImports, 'lint-imports must have run');
  assert.notEqual(this.lintImports.status, 0);
  assert.match(this.lintImports.output, /No circular imports between sibling modules \(safeword\)/);
});

Then(
  'no .importlinter file is scaffolded beyond what already existed',
  function (this: ImportLinterWorld) {
    assert.ok(this.savedConfig);
    if (this.savedConfig.relativePath === '.importlinter') {
      assert.equal(readConfig(this), this.savedConfig.content);
    } else {
      assert.equal(existsSync(configPath(this)), false);
    }
  },
);

Then('the existing configuration content is unchanged', function (this: ImportLinterWorld) {
  assert.ok(this.projectDirectory && this.savedConfig);
  const current = readFileSync(
    nodePath.join(this.projectDirectory, this.savedConfig.relativePath),
    'utf8',
  );
  assert.equal(current, this.savedConfig.content);
});

Then('no .importlinter file is created', function (this: ImportLinterWorld) {
  assert.equal(existsSync(configPath(this)), false);
});

Then('the .importlinter content is unchanged', function (this: ImportLinterWorld) {
  assert.equal(readConfig(this), this.scaffoldBefore);
});

Then('no duplicate configuration is introduced', function (this: ImportLinterWorld) {
  const config = readConfig(this);
  const rootSections = config.match(/^\[importlinter]$/gm) ?? [];
  assert.equal(rootSections.length, 1);
});

Then("the user's extended .importlinter content is unchanged", function (this: ImportLinterWorld) {
  assert.ok(this.savedConfig);
  assert.equal(readConfig(this), this.savedConfig.content);
});

Then('the .importlinter file is removed', function (this: ImportLinterWorld) {
  assert.equal(existsSync(configPath(this)), false);
});

Then(
  "the user's .importlinter file still exists with its original content",
  function (this: ImportLinterWorld) {
    assert.ok(this.savedConfig);
    assert.equal(readConfig(this), this.savedConfig.content);
  },
);

Then('import-linter is declared as a development dependency', function (this: ImportLinterWorld) {
  // The install-intent line names the tool set even when the local uv binary
  // is absent (the install then fails and surfaces guidance instead); when uv
  // IS present the dependency lands in pyproject. Accept either proof.
  assert.ok(this.projectDirectory && this.setupOutput !== undefined);
  const pyproject = readFileSync(nodePath.join(this.projectDirectory, 'pyproject.toml'), 'utf8');
  const declared = pyproject.includes('import-linter');
  const intended =
    /Installing Python tools \([^)]*import-linter|Install Python tools: .*import-linter/.test(
      this.setupOutput,
    );
  assert.ok(declared || intended, `no import-linter install evidence in:\n${this.setupOutput}`);
});

Then(
  'the setup output tells the user how to install import-linter',
  function (this: ImportLinterWorld) {
    assert.ok(this.setupOutput !== undefined);
    assert.match(this.setupOutput, /Install Python tools: .*import-linter/);
  },
);
