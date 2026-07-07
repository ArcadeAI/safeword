/**
 * Unit Tests: Python Setup Utilities
 *
 * Tests for package manager detection and dependency installation logic.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectPythonPackageManager,
  getPythonTools,
  hasRuffDependency,
  installPythonDependencies,
} from '../../src/packs/python/setup.js';
import {
  createPythonProject,
  createTemporaryDirectory,
  isPoetryInstalled,
  isUvInstalled,
  readTestFile,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers';

const context: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  context.projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (context.projectDirectory) {
    removeTemporaryDirectory(context.projectDirectory);
  }
});

// =============================================================================
// Tool set (shared by setup + upgrade — the anti-drift source of truth)
// =============================================================================

describe('getPythonTools', () => {
  it('installs ruff, mypy, and deadcode by default', () => {
    expect(getPythonTools(false)).toEqual(['ruff', 'mypy', 'deadcode']);
  });

  it('adds import-linter when a config would be scaffolded', () => {
    expect(getPythonTools(true)).toEqual(['ruff', 'mypy', 'deadcode', 'import-linter']);
  });
});

// =============================================================================
// Package Manager Detection
// =============================================================================

describe('detectPythonPackageManager', () => {
  it('detects uv from uv.lock', () => {
    createPythonProject(context.projectDirectory, { manager: 'uv' });

    expect(detectPythonPackageManager(context.projectDirectory)).toBe('uv');
  });

  it('detects poetry from poetry.lock', () => {
    createPythonProject(context.projectDirectory, { manager: 'poetry' });

    expect(detectPythonPackageManager(context.projectDirectory)).toBe('poetry');
  });

  it('detects poetry from [tool.poetry] section', () => {
    // Create project without lockfile but with [tool.poetry]
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"

[tool.poetry]
name = "test"
`,
    );

    expect(detectPythonPackageManager(context.projectDirectory)).toBe('poetry');
  });

  it('detects pipenv from Pipfile', () => {
    createPythonProject(context.projectDirectory, { manager: 'pipenv' });

    expect(detectPythonPackageManager(context.projectDirectory)).toBe('pipenv');
  });

  it('defaults to pip when no manager detected', () => {
    createPythonProject(context.projectDirectory, { manager: 'pip' });

    expect(detectPythonPackageManager(context.projectDirectory)).toBe('pip');
  });
});

// =============================================================================
// Ruff Dependency Detection
// =============================================================================

describe('hasRuffDependency', () => {
  it('returns false when pyproject.toml missing', () => {
    expect(hasRuffDependency(context.projectDirectory)).toBe(false);
  });

  it('returns false when ruff not in dependencies', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"
dependencies = ["flask"]
`,
    );

    expect(hasRuffDependency(context.projectDirectory)).toBe(false);
  });

  it('detects ruff in PEP 621 dependencies array', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"
dependencies = ["ruff>=0.8.0"]
`,
    );

    expect(hasRuffDependency(context.projectDirectory)).toBe(true);
  });

  it('detects ruff in optional-dependencies', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"

[project.optional-dependencies]
dev = ["ruff", "mypy"]
`,
    );

    expect(hasRuffDependency(context.projectDirectory)).toBe(true);
  });

  it('detects ruff in Poetry dev dependencies', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"

[tool.poetry.group.dev.dependencies]
ruff = "^0.8.0"
`,
    );

    expect(hasRuffDependency(context.projectDirectory)).toBe(true);
  });

  it('does NOT match [tool.ruff] config section', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"

[tool.ruff]
line-length = 88
`,
    );

    expect(hasRuffDependency(context.projectDirectory)).toBe(false);
  });
});

// =============================================================================
// Install Python Dependencies
// =============================================================================

describe('installPythonDependencies', () => {
  it('returns true for empty tools array', () => {
    createPythonProject(context.projectDirectory);

    expect(installPythonDependencies(context.projectDirectory, [])).toBe(true);
  });

  it('returns false for pip projects (PEP 668 safety)', () => {
    createPythonProject(context.projectDirectory, { manager: 'pip' });

    expect(installPythonDependencies(context.projectDirectory, ['ruff'])).toBe(false);
  });

  // Conditional tests - only run if package manager is available
  const IS_UV_AVAILABLE = isUvInstalled();
  const IS_POETRY_AVAILABLE = isPoetryInstalled();

  it.skipIf(!IS_UV_AVAILABLE)('installs tools with uv', () => {
    createPythonProject(context.projectDirectory, { manager: 'uv' });

    // This actually runs uv add --dev ruff
    const isResult = installPythonDependencies(context.projectDirectory, ['ruff']);

    expect(isResult).toBe(true);

    // Verify ruff is now in pyproject.toml
    const pyproject = readTestFile(context.projectDirectory, 'pyproject.toml');
    expect(pyproject).toContain('ruff');
  });

  // Poetry test disabled: poetry add is too slow/unreliable for CI
  // - Creates new lockfile requiring full dependency resolution (60+ seconds)
  // - Can hang indefinitely even with --no-interaction flag
  // - The uv test above exercises the same installPythonDependencies code path
  // - Production code has 60s timeout to prevent hanging (see setup.ts)
  // Re-enable with: POETRY_AVAILABLE && process.env.TEST_POETRY === "1"
  it.skipIf(!IS_POETRY_AVAILABLE || !process.env.TEST_POETRY)('installs tools with poetry', () => {
    createPythonProject(context.projectDirectory, { manager: 'poetry' });

    // This actually runs poetry add --group dev ruff
    const isResult = installPythonDependencies(context.projectDirectory, ['ruff']);

    expect(isResult).toBe(true);

    // Verify ruff is now in pyproject.toml
    const pyproject = readTestFile(context.projectDirectory, 'pyproject.toml');
    expect(pyproject).toContain('ruff');
  });
});
