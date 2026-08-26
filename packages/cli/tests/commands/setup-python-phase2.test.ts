/**
 * Test Suite: Python Tooling Parity (Phase 2)
 * Tests for Phase 2 components - Ruff config, import-linter, deadcode, jscpd, mypy
 *
 * Test Definitions: .safeword/planning/test-definitions/phase2-python-tooling.md
 */

import { chmodSync, existsSync, readFileSync } from 'node:fs';
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

const __dirname = import.meta.dirname;

const state: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  state.projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (state.projectDirectory) {
    removeTemporaryDirectory(state.projectDirectory);
  }
});

/**
 * Helper to create a Python project with layer structure
 * Mirrors ARCHITECTURE_LAYERS pattern from boundaries.ts
 */
function createPythonProjectWithLayers(dir: string): void {
  createPythonProjectReadyForSetup(dir);
  // Create recognizable layer structure (domain → services → api hierarchy)
  writeTestFile(dir, 'src/domain/__init__.py', '# Domain layer - entities, models');
  writeTestFile(dir, 'src/services/__init__.py', '# Services layer - business logic');
  writeTestFile(dir, 'src/api/__init__.py', '# API layer - routes, handlers');
}

function createPythonProjectReadyForSetup(
  dir: string,
  options?: Parameters<typeof createPythonProject>[1],
): void {
  createPythonProject(dir, options);
  createSafewordBasePackageJson(dir);
}

/**
 * Helper to read pyproject.toml content
 */
function readPyprojectToml(dir: string): string {
  return readTestFile(dir, 'pyproject.toml');
}

/**
 * Helper to read the canonical audit skill content
 */
function readAuditSkillTemplate(): string {
  return readFileSync(nodePath.join(__dirname, '../../templates/skills/audit/SKILL.md'), 'utf8');
}

/**
 * Helper to check if a file exists in the project
 */
function fileExists(dir: string, filename: string): boolean {
  return existsSync(nodePath.join(dir, filename));
}

// =============================================================================
// Test Suite 1: Ruff Config Generation
// =============================================================================

describe('Suite 1: Ruff Config Generation', () => {
  it(
    'Test 1.1: Generates ruff.toml at project root',
    async () => {
      // Arrange
      createPythonProjectReadyForSetup(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      // Ticket 138: customer's ruff.toml is bare/customer-owned; safeword's .safeword/ruff.toml extends it.
      expect(fileExists(state.projectDirectory, 'ruff.toml')).toBe(true);
      const ruffToml = readTestFile(state.projectDirectory, 'ruff.toml');
      expect(ruffToml).toContain('customer-owned');

      // Actual rules are in .safeword/ruff.toml, which extends customer's ruff.toml.
      const safewordRuffToml = readTestFile(state.projectDirectory, '.safeword/ruff.toml');
      expect(safewordRuffToml).toContain('[lint]');
      expect(safewordRuffToml).toContain('extend = "../ruff.toml"');
      expect(safewordRuffToml).toContain('extend-select = [');
      // Verify curated rules (not ALL — ALL is discouraged by ruff maintainers)
      expect(safewordRuffToml).not.toContain('"ALL"');
      expect(safewordRuffToml).toContain('"E"');
      expect(safewordRuffToml).toContain('"B"');

      // pyproject.toml should NOT be modified for ruff
      const pyprojectContent = readPyprojectToml(state.projectDirectory);
      expect(pyprojectContent).not.toContain('[tool.ruff]');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 1.1b: Does not create ruff.toml if project has existing ruff config',
    async () => {
      // Arrange - project with existing [tool.ruff] in pyproject.toml
      writeTestFile(
        state.projectDirectory,
        'pyproject.toml',
        `[project]
name = "existing-project"
version = "2.0.0"
description = "An existing project"

[tool.ruff]
line-length = 120

[tool.pytest.ini_options]
testpaths = ["tests"]
`,
      );
      createSafewordBasePackageJson(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - ruff.toml should NOT be created (project has existing config)
      expect(fileExists(state.projectDirectory, 'ruff.toml')).toBe(false);

      // .safeword/ruff.toml should still be created (for hooks)
      expect(fileExists(state.projectDirectory, '.safeword/ruff.toml')).toBe(true);

      // Original pyproject.toml content preserved
      const pyprojectContent = readPyprojectToml(state.projectDirectory);
      expect(pyprojectContent).toContain('name = "existing-project"');
      expect(pyprojectContent).toContain('description = "An existing project"');
      expect(pyprojectContent).toContain('[tool.pytest.ini_options]');
      expect(pyprojectContent).toContain('line-length = 120');
    },
    TIMEOUT_SETUP,
  );
});

// =============================================================================
// Test Suite 2: Architecture Validation (import-linter)
// =============================================================================

describe('Suite 2: Architecture Validation', () => {
  it(
    'Test 2.1: Generates .importlinter config file',
    async () => {
      // Arrange
      createPythonProjectWithLayers(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - .importlinter file created at project root
      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(true);
      const importLinterConfig = readTestFile(state.projectDirectory, '.importlinter');
      expect(importLinterConfig).toContain('[importlinter]');
      // Should have layer contracts
      expect(importLinterConfig).toContain('[importlinter:contract:layers]');

      // pyproject.toml should NOT be modified
      const pyprojectContent = readPyprojectToml(state.projectDirectory);
      expect(pyprojectContent).not.toContain('[tool.importlinter]');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 2.1b: Does not generate .importlinter without layer structure',
    async () => {
      // Arrange
      createPythonProjectReadyForSetup(state.projectDirectory); // No layers
      initGitRepo(state.projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - .importlinter file should NOT exist
      expect(fileExists(state.projectDirectory, '.importlinter')).toBe(false);
    },
    TIMEOUT_SETUP,
  );
});

// =============================================================================
// Test Suite 3: Dead Code Detection
// =============================================================================

describe('Suite 3: Dead Code Detection', () => {
  it('Test 3.1: /audit skill includes deadcode for Python', () => {
    // Assert: the audit skill contains the deadcode command
    const auditTemplate = readAuditSkillTemplate();
    expect(auditTemplate).toContain('deadcode');
    // Should detect Python projects
    expect(auditTemplate).toMatch(/pyproject\.toml|requirements\.txt/);
  });
});

// =============================================================================
// Test Suite 4: Copy/Paste Detection
// =============================================================================

describe('Suite 4: Copy/Paste Detection', () => {
  it('Test 4.1: /audit skill includes jscpd', () => {
    // Assert: the audit skill contains the jscpd command
    const auditTemplate = readAuditSkillTemplate();
    expect(auditTemplate).toContain('jscpd');
  });

  it('Test 4.2: jscpd does not use removed --gitignore flag (removed in jscpd v3+)', () => {
    const auditTemplate = readAuditSkillTemplate();
    expect(auditTemplate).not.toContain('--gitignore');
  });

  it('Test 4.3: jscpd uses --min-lines 10', () => {
    const auditTemplate = readAuditSkillTemplate();
    expect(auditTemplate).toMatch(/--min-lines\s+10/);
  });
});

// =============================================================================
// Test Suite 5: mypy Configuration
// =============================================================================

describe('Suite 5: mypy Configuration', () => {
  it(
    'Test 5.1: Generates mypy.ini at project root',
    async () => {
      // Arrange
      createPythonProjectReadyForSetup(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - mypy.ini file created at project root
      expect(fileExists(state.projectDirectory, 'mypy.ini')).toBe(true);
      const mypyConfig = readTestFile(state.projectDirectory, 'mypy.ini');
      expect(mypyConfig).toContain('[mypy]');
      // Strict mode for LLM agents
      expect(mypyConfig).toContain('strict = True');
      expect(mypyConfig).toContain('warn_unreachable = True');
      expect(mypyConfig).toContain('ignore_missing_imports = True');
      expect(mypyConfig).toContain('show_error_codes = True');
      expect(mypyConfig).toContain('pretty = True');

      // pyproject.toml should NOT be modified
      const pyprojectContent = readPyprojectToml(state.projectDirectory);
      expect(pyprojectContent).not.toContain('[tool.mypy]');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 5.2: Does not create mypy.ini if project has existing mypy config',
    async () => {
      // Arrange - project with existing [tool.mypy] in pyproject.toml
      writeTestFile(
        state.projectDirectory,
        'pyproject.toml',
        `[project]
name = "test"

[tool.mypy]
strict = true
`,
      );
      createSafewordBasePackageJson(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: state.projectDirectory,
        env: SKIP_INSTALL_ENV,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - mypy.ini should NOT be created (project has existing config)
      expect(fileExists(state.projectDirectory, 'mypy.ini')).toBe(false);

      // Original pyproject.toml preserved
      const pyprojectContent = readPyprojectToml(state.projectDirectory);
      expect(pyprojectContent).toContain('strict = true');
    },
    TIMEOUT_SETUP,
  );
});

// =============================================================================
// Test Suite 6: Auto-Install Python Tools
// =============================================================================

describe('Suite 6: Auto-Install Python Tools', () => {
  it(
    'Test 6.1: Shows install message for pip projects (no auto-install)',
    async () => {
      // Arrange - pip project (default, no lockfile)
      createPythonProjectReadyForSetup(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: SKIP_INSTALL_ENV,
      });
      // Assert - should show manual install instruction
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toContain('Install Python tools');
      expect(result.stdout).toContain('pip install');
      expect(result.stdout).toContain('Configuration is healthy');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 6.2: Shows the uv recovery command when installation is skipped',
    async () => {
      createPythonProjectReadyForSetup(state.projectDirectory, { manager: 'uv' });
      initGitRepo(state.projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: SKIP_INSTALL_ENV,
      });

      expect(result.stdout).toContain('Install Python tools: uv add --dev');
      expect(result.stdout).not.toContain('Python tools installed');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 6.3: Installs the remaining tools when ruff is already declared',
    async () => {
      // Arrange - project with ruff already declared
      writeTestFile(
        state.projectDirectory,
        'pyproject.toml',
        `[project]
name = "test"
version = "0.1.0"

[project.optional-dependencies]
dev = ["ruff>=0.8.0"]
`,
      );
      createSafewordBasePackageJson(state.projectDirectory);
      initGitRepo(state.projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: SKIP_INSTALL_ENV,
      });

      // Ruff alone is not the full Safeword Python tool contract.
      expect(result.stdout).toContain('Install Python tools: pip install mypy deadcode');
      expect(result.stdout).not.toContain('Python tools installed');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 6.4: Installs managed projects even when a pip sibling needs manual setup',
    async () => {
      createPythonProjectReadyForSetup(state.projectDirectory);
      writeTestFile(
        state.projectDirectory,
        'apps/worker/pyproject.toml',
        '[project]\nname="worker"\n',
      );
      writeTestFile(state.projectDirectory, 'apps/worker/uv.lock', '');
      initGitRepo(state.projectDirectory);
      const bin = nodePath.join(state.projectDirectory, 'bin');
      const log = nodePath.join(state.projectDirectory, 'uv.log');
      const uv = nodePath.join(bin, 'uv');
      writeTestFile(
        state.projectDirectory,
        'bin/uv',
        '#!/bin/sh\nprintf "%s|%s\\n" "$PWD" "$*" >> "$SAFEWORD_UV_LOG"\n',
      );
      chmodSync(uv, 0o755);

      const result = await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_SKIP_INSTALL: '',
          SAFEWORD_UV_LOG: log,
        },
      });

      expect(result.exitCode).toBe(2);
      expect(existsSync(log)).toBe(true);
      expect(readFileSync(log, 'utf8')).toContain(
        `${nodePath.join(state.projectDirectory, 'apps/worker')}|add --dev ruff mypy deadcode`,
      );
      expect(result.stdout).toContain('pip install');
      expect(result.stdout).toContain('Configuration is healthy');
    },
    TIMEOUT_SETUP,
  );

  it(
    'restores a nested uv project when dependency resolution fails after changing its files',
    async () => {
      createSafewordBasePackageJson(state.projectDirectory);
      const worker = nodePath.join(state.projectDirectory, 'apps/worker');
      createPythonProject(worker, { manager: 'uv' });
      initGitRepo(state.projectDirectory);
      const originalManifest = readTestFile(worker, 'pyproject.toml');
      const originalLock = readTestFile(worker, 'uv.lock');
      const bin = nodePath.join(state.projectDirectory, 'bin');
      const uv = nodePath.join(bin, 'uv');
      writeTestFile(
        state.projectDirectory,
        'bin/uv',
        "#!/bin/sh\nprintf '\\ndependencies = [\"deadcode\"]\\n' >> pyproject.toml\nprintf '\\ninvalid\n' >> uv.lock\nexit 1\n",
      );
      chmodSync(uv, 0o755);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_SKIP_INSTALL: '',
        },
      });

      expect(readTestFile(worker, 'pyproject.toml')).toBe(originalManifest);
      expect(readTestFile(worker, 'uv.lock')).toBe(originalLock);
    },
    TIMEOUT_SETUP,
  );

  it(
    'restores a workspace lock when uv writes an invalid result',
    async () => {
      createSafewordBasePackageJson(state.projectDirectory);
      writeTestFile(
        state.projectDirectory,
        'pyproject.toml',
        '[tool.uv.workspace]\nmembers = ["apps/*"]\n',
      );
      writeTestFile(state.projectDirectory, 'uv.lock', 'version = 1\nrevision = 2\n');
      const worker = nodePath.join(state.projectDirectory, 'apps/worker');
      writeTestFile(
        state.projectDirectory,
        'apps/worker/pyproject.toml',
        '[project]\nname = "worker"\nversion = "0.1.0"\n',
      );
      initGitRepo(state.projectDirectory);
      const originalManifest = readTestFile(worker, 'pyproject.toml');
      const originalLock = readTestFile(state.projectDirectory, 'uv.lock');
      const bin = nodePath.join(state.projectDirectory, 'bin');
      const uv = nodePath.join(bin, 'uv');
      writeTestFile(
        state.projectDirectory,
        'bin/uv',
        '#!/bin/sh\nif [ "$1" = "add" ]; then\n  printf \'\\ndependencies = ["deadcode"]\\n\' >> pyproject.toml\n  printf \'invalid\\n\' >> "$SAFEWORD_ROOT_UV_LOCK"\n  exit 0\nfi\nexit 1\n',
      );
      chmodSync(uv, 0o755);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_ROOT_UV_LOCK: nodePath.join(state.projectDirectory, 'uv.lock'),
          SAFEWORD_SKIP_INSTALL: '',
        },
      });

      expect(readTestFile(worker, 'pyproject.toml')).toBe(originalManifest);
      expect(readTestFile(state.projectDirectory, 'uv.lock')).toBe(originalLock);
    },
    TIMEOUT_SETUP,
  );

  it(
    'finalizes a uv consumer after its local dependency changes later in setup',
    async () => {
      createSafewordBasePackageJson(state.projectDirectory);
      const consumer = nodePath.join(state.projectDirectory, 'apps/consumer');
      const dependency = nodePath.join(state.projectDirectory, 'libs/shared');
      createPythonProject(consumer, { manager: 'uv' });
      createPythonProject(dependency, { manager: 'uv' });
      initGitRepo(state.projectDirectory);
      const bin = nodePath.join(state.projectDirectory, 'bin');
      const uv = nodePath.join(bin, 'uv');
      writeTestFile(
        state.projectDirectory,
        'bin/uv',
        `#!/bin/sh
if [ "$1" = "add" ]; then
  printf '\ndependencies = ["deadcode"]\n' >> pyproject.toml
  printf '\nresolved\n' >> uv.lock
  exit 0
fi
if [ "$1" = "lock" ] && [ "$2" = "--check" ]; then
  if [ "$PWD" = "$SAFEWORD_UV_CONSUMER" ] && grep -q deadcode "$SAFEWORD_UV_DEPENDENCY/pyproject.toml" && ! grep -q finalized uv.lock; then
    exit 1
  fi
  exit 0
fi
if [ "$1" = "lock" ]; then
  printf '\nfinalized\n' >> uv.lock
  exit 0
fi
exit 1
`,
      );
      chmodSync(uv, 0o755);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_SKIP_INSTALL: '',
          SAFEWORD_UV_CONSUMER: consumer,
          SAFEWORD_UV_DEPENDENCY: dependency,
        },
      });

      expect(readTestFile(consumer, 'uv.lock')).toContain('finalized');
      expect(readTestFile(dependency, 'uv.lock')).toContain('finalized');
    },
    TIMEOUT_SETUP,
  );

  it(
    'restores every uv project when final lock generation fails',
    async () => {
      createSafewordBasePackageJson(state.projectDirectory);
      const consumer = nodePath.join(state.projectDirectory, 'apps/consumer');
      const dependency = nodePath.join(state.projectDirectory, 'libs/shared');
      createPythonProject(consumer, { manager: 'uv' });
      createPythonProject(dependency, { manager: 'uv' });
      initGitRepo(state.projectDirectory);
      const originals = [consumer, dependency].map(directory => ({
        directory,
        manifest: readTestFile(directory, 'pyproject.toml'),
        lock: readTestFile(directory, 'uv.lock'),
      }));
      const bin = nodePath.join(state.projectDirectory, 'bin');
      const uv = nodePath.join(bin, 'uv');
      writeTestFile(
        state.projectDirectory,
        'bin/uv',
        `#!/bin/sh
if [ "$1" = "add" ]; then
  printf '\ndependencies = ["deadcode"]\n' >> pyproject.toml
  printf '\nresolved\n' >> uv.lock
  exit 0
fi
if [ "$1" = "lock" ] && [ "$2" = "--check" ]; then
  exit 0
fi
exit 1
`,
      );
      chmodSync(uv, 0o755);

      await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_SKIP_INSTALL: '',
        },
      });

      for (const original of originals) {
        expect(readTestFile(original.directory, 'pyproject.toml')).toBe(original.manifest);
        expect(readTestFile(original.directory, 'uv.lock')).toBe(original.lock);
      }
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 6.5: Shows poetry install command for poetry projects',
    async () => {
      createPythonProjectReadyForSetup(state.projectDirectory, { manager: 'poetry' });
      initGitRepo(state.projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: SKIP_INSTALL_ENV,
      });

      expect(result.stdout).toMatch(/poetry add/);
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 6.6: Shows pipenv install command for pipenv projects',
    async () => {
      createPythonProjectReadyForSetup(state.projectDirectory, { manager: 'pipenv' });
      initGitRepo(state.projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: state.projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: SKIP_INSTALL_ENV,
      });

      // Assert - Pipenv project detected
      expect(result.stdout).toMatch(/pipenv install/);
    },
    TIMEOUT_SETUP,
  );
});
