/**
 * Test Suite: Python Tooling Parity (Phase 2)
 * Tests for Phase 2 components - Ruff config, import-linter, deadcode, jscpd, mypy
 *
 * Test Definitions: .safeword/planning/test-definitions/phase2-python-tooling.md
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createPythonProject,
  createTemporaryDirectory,
  initGitRepo,
  isUvInstalled,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_SETUP,
  writeTestFile,
} from '../helpers';

const __dirname = import.meta.dirname;

let projectDirectory: string;

beforeEach(() => {
  projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (projectDirectory) {
    removeTemporaryDirectory(projectDirectory);
  }
});

/**
 * Helper to create a Python project with layer structure
 * Mirrors ARCHITECTURE_LAYERS pattern from boundaries.ts
 */
function createPythonProjectWithLayers(dir: string): void {
  createPythonProject(dir);
  // Create recognizable layer structure (domain → services → api hierarchy)
  writeTestFile(dir, 'src/domain/__init__.py', '# Domain layer - entities, models');
  writeTestFile(dir, 'src/services/__init__.py', '# Services layer - business logic');
  writeTestFile(dir, 'src/api/__init__.py', '# API layer - routes, handlers');
}

/**
 * Helper to read pyproject.toml content
 */
function readPyprojectToml(dir: string): string {
  return readTestFile(dir, 'pyproject.toml');
}

/**
 * Helper to read the audit.md template content
 */
function readAuditTemplate(): string {
  return readFileSync(nodePath.join(__dirname, '../../templates/commands/audit.md'), 'utf8');
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
      createPythonProject(projectDirectory);
      initGitRepo(projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Ticket 138: customer's ruff.toml is bare/customer-owned; safeword's .safeword/ruff.toml extends it.
      expect(fileExists(projectDirectory, 'ruff.toml')).toBe(true);
      const ruffToml = readTestFile(projectDirectory, 'ruff.toml');
      expect(ruffToml).toContain('customer-owned');

      // Actual rules are in .safeword/ruff.toml, which extends customer's ruff.toml.
      const safewordRuffToml = readTestFile(projectDirectory, '.safeword/ruff.toml');
      expect(safewordRuffToml).toContain('[lint]');
      expect(safewordRuffToml).toContain('extend = "../ruff.toml"');
      expect(safewordRuffToml).toContain('extend-select = [');
      // Verify curated rules (not ALL — ALL is discouraged by ruff maintainers)
      expect(safewordRuffToml).not.toContain('"ALL"');
      expect(safewordRuffToml).toContain('"E"');
      expect(safewordRuffToml).toContain('"B"');

      // pyproject.toml should NOT be modified for ruff
      const pyprojectContent = readPyprojectToml(projectDirectory);
      expect(pyprojectContent).not.toContain('[tool.ruff]');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 1.1b: Does not create ruff.toml if project has existing ruff config',
    async () => {
      // Arrange - project with existing [tool.ruff] in pyproject.toml
      writeTestFile(
        projectDirectory,
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
      initGitRepo(projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - ruff.toml should NOT be created (project has existing config)
      expect(fileExists(projectDirectory, 'ruff.toml')).toBe(false);

      // .safeword/ruff.toml should still be created (for hooks)
      expect(fileExists(projectDirectory, '.safeword/ruff.toml')).toBe(true);

      // Original pyproject.toml content preserved
      const pyprojectContent = readPyprojectToml(projectDirectory);
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
      createPythonProjectWithLayers(projectDirectory);
      initGitRepo(projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - .importlinter file created at project root
      expect(fileExists(projectDirectory, '.importlinter')).toBe(true);
      const importLinterConfig = readTestFile(projectDirectory, '.importlinter');
      expect(importLinterConfig).toContain('[importlinter]');
      // Should have layer contracts
      expect(importLinterConfig).toContain('[importlinter:contract:layers]');

      // pyproject.toml should NOT be modified
      const pyprojectContent = readPyprojectToml(projectDirectory);
      expect(pyprojectContent).not.toContain('[tool.importlinter]');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 2.1b: Does not generate .importlinter without layer structure',
    async () => {
      // Arrange
      createPythonProject(projectDirectory); // No layers
      initGitRepo(projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - .importlinter file should NOT exist
      expect(fileExists(projectDirectory, '.importlinter')).toBe(false);
    },
    TIMEOUT_SETUP,
  );
});

// =============================================================================
// Test Suite 3: Dead Code Detection
// =============================================================================

describe('Suite 3: Dead Code Detection', () => {
  it('Test 3.1: /audit template includes deadcode for Python', () => {
    // Assert: audit.md template contains deadcode command
    const auditTemplate = readAuditTemplate();
    expect(auditTemplate).toContain('deadcode');
    // Should detect Python projects
    expect(auditTemplate).toMatch(/pyproject\.toml|requirements\.txt/);
  });
});

// =============================================================================
// Test Suite 4: Copy/Paste Detection
// =============================================================================

describe('Suite 4: Copy/Paste Detection', () => {
  it('Test 4.1: /audit template includes jscpd', () => {
    // Assert: audit.md template contains jscpd command
    const auditTemplate = readAuditTemplate();
    expect(auditTemplate).toContain('jscpd');
  });

  it('Test 4.2: jscpd uses --gitignore flag', () => {
    const auditTemplate = readAuditTemplate();
    expect(auditTemplate).toContain('--gitignore');
  });

  it('Test 4.3: jscpd uses --min-lines 10', () => {
    const auditTemplate = readAuditTemplate();
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
      createPythonProject(projectDirectory);
      initGitRepo(projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - mypy.ini file created at project root
      expect(fileExists(projectDirectory, 'mypy.ini')).toBe(true);
      const mypyConfig = readTestFile(projectDirectory, 'mypy.ini');
      expect(mypyConfig).toContain('[mypy]');
      // Strict mode for LLM agents
      expect(mypyConfig).toContain('strict = True');
      expect(mypyConfig).toContain('warn_unreachable = True');
      expect(mypyConfig).toContain('ignore_missing_imports = True');
      expect(mypyConfig).toContain('show_error_codes = True');
      expect(mypyConfig).toContain('pretty = True');

      // pyproject.toml should NOT be modified
      const pyprojectContent = readPyprojectToml(projectDirectory);
      expect(pyprojectContent).not.toContain('[tool.mypy]');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 5.2: Does not create mypy.ini if project has existing mypy config',
    async () => {
      // Arrange - project with existing [tool.mypy] in pyproject.toml
      writeTestFile(
        projectDirectory,
        'pyproject.toml',
        `[project]
name = "test"

[tool.mypy]
strict = true
`,
      );
      initGitRepo(projectDirectory);

      // Act
      await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - mypy.ini should NOT be created (project has existing config)
      expect(fileExists(projectDirectory, 'mypy.ini')).toBe(false);

      // Original pyproject.toml preserved
      const pyprojectContent = readPyprojectToml(projectDirectory);
      expect(pyprojectContent).toContain('strict = true');
    },
    TIMEOUT_SETUP,
  );
});

// =============================================================================
// Test Suite 6: Auto-Install Python Tools
// =============================================================================

const UV_AVAILABLE = isUvInstalled();

describe('Suite 6: Auto-Install Python Tools', () => {
  it(
    'Test 6.1: Shows install message for pip projects (no auto-install)',
    async () => {
      // Arrange - pip project (default, no lockfile)
      createPythonProject(projectDirectory);
      initGitRepo(projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - should show manual install instruction
      expect(result.stdout).toContain('Install Python tools');
      expect(result.stdout).toContain('pip install');
    },
    TIMEOUT_SETUP,
  );

  it.skipIf(!UV_AVAILABLE)(
    'Test 6.2: Auto-installs tools for uv projects',
    async () => {
      // Arrange - uv project with uv.lock
      createPythonProject(projectDirectory, { manager: 'uv' });
      initGitRepo(projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
        env: { SAFEWORD_SKIP_INSTALL: '1' },
      });

      // Assert - CLI detected uv and attempted install (output messages are our code's behavior)
      expect(result.stdout).toContain('Installing Python tools');
      expect(result.stdout).toContain('Python tools installed');
      expect(result.stdout).not.toContain('Install Python tools:'); // No manual instruction
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 6.3: Skips install if ruff already in dependencies',
    async () => {
      // Arrange - project with ruff already declared
      writeTestFile(
        projectDirectory,
        'pyproject.toml',
        `[project]
name = "test"
version = "0.1.0"

[project.optional-dependencies]
dev = ["ruff>=0.8.0"]
`,
      );
      initGitRepo(projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - should NOT show install message (already has ruff)
      expect(result.stdout).not.toContain('Installing Python tools');
      expect(result.stdout).not.toContain('Install Python tools:');
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 6.4: Shows poetry install command for poetry projects',
    async () => {
      // Arrange - poetry project with invalid config (python key not allowed)
      // This makes poetry fail immediately with "Additional properties are not allowed"
      writeTestFile(
        projectDirectory,
        'pyproject.toml',
        `[project]
name = "test"
version = "0.1.0"

[tool.poetry]
name = "test"
python = "^3.12"
`,
      );
      // Note: Invalid poetry config ensures immediate failure (no network calls)
      initGitRepo(projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - Poetry project detected, shows poetry command in fallback
      // (install fails without poetry.lock, so fallback shown)
      expect(result.stdout).toMatch(/poetry add/);
    },
    TIMEOUT_SETUP,
  );

  it(
    'Test 6.5: Shows pipenv install command for pipenv projects',
    async () => {
      // Arrange - pipenv project
      createPythonProject(projectDirectory, { manager: 'pipenv' });
      initGitRepo(projectDirectory);

      // Act
      const result = await runCli(['setup'], {
        cwd: projectDirectory,
        timeout: TIMEOUT_SETUP,
      });

      // Assert - Pipenv project detected
      expect(result.stdout).toMatch(/pipenv install/);
    },
    TIMEOUT_SETUP,
  );
});
