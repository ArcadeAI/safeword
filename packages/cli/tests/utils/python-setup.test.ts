/**
 * Unit Tests: Python Setup Utilities
 *
 * Tests for package manager detection and dependency installation logic.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectPythonPackageManager,
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

let projectDirectory: string;

beforeEach(() => {
  projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (projectDirectory) {
    removeTemporaryDirectory(projectDirectory);
  }
});

// =============================================================================
// Package Manager Detection
// =============================================================================

describe('detectPythonPackageManager', () => {
  it('detects uv from uv.lock', () => {
    createPythonProject(projectDirectory, { manager: 'uv' });

    expect(detectPythonPackageManager(projectDirectory)).toBe('uv');
  });

  it('detects poetry from poetry.lock', () => {
    createPythonProject(projectDirectory, { manager: 'poetry' });

    expect(detectPythonPackageManager(projectDirectory)).toBe('poetry');
  });

  it('detects poetry from [tool.poetry] section', () => {
    // Create project without lockfile but with [tool.poetry]
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"

[tool.poetry]
name = "test"
`,
    );

    expect(detectPythonPackageManager(projectDirectory)).toBe('poetry');
  });

  it('detects pipenv from Pipfile', () => {
    createPythonProject(projectDirectory, { manager: 'pipenv' });

    expect(detectPythonPackageManager(projectDirectory)).toBe('pipenv');
  });

  it('defaults to pip when no manager detected', () => {
    createPythonProject(projectDirectory, { manager: 'pip' });

    expect(detectPythonPackageManager(projectDirectory)).toBe('pip');
  });
});

// =============================================================================
// Ruff Dependency Detection
// =============================================================================

describe('hasRuffDependency', () => {
  it('returns false when pyproject.toml missing', () => {
    expect(hasRuffDependency(projectDirectory)).toBe(false);
  });

  it('returns false when ruff not in dependencies', () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"
dependencies = ["flask"]
`,
    );

    expect(hasRuffDependency(projectDirectory)).toBe(false);
  });

  it('detects ruff in PEP 621 dependencies array', () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"
dependencies = ["ruff>=0.8.0"]
`,
    );

    expect(hasRuffDependency(projectDirectory)).toBe(true);
  });

  it('detects ruff in optional-dependencies', () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"

[project.optional-dependencies]
dev = ["ruff", "mypy"]
`,
    );

    expect(hasRuffDependency(projectDirectory)).toBe(true);
  });

  it('detects ruff in Poetry dev dependencies', () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"

[tool.poetry.group.dev.dependencies]
ruff = "^0.8.0"
`,
    );

    expect(hasRuffDependency(projectDirectory)).toBe(true);
  });

  it('does NOT match [tool.ruff] config section', () => {
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"

[tool.ruff]
line-length = 88
`,
    );

    expect(hasRuffDependency(projectDirectory)).toBe(false);
  });
});

// =============================================================================
// Install Python Dependencies
// =============================================================================

describe('installPythonDependencies', () => {
  it('returns true for empty tools array', () => {
    createPythonProject(projectDirectory);

    expect(installPythonDependencies(projectDirectory, [])).toBe(true);
  });

  it('returns false for pip projects (PEP 668 safety)', () => {
    createPythonProject(projectDirectory, { manager: 'pip' });

    expect(installPythonDependencies(projectDirectory, ['ruff'])).toBe(false);
  });

  // Conditional tests - only run if package manager is available
  const IS_UV_AVAILABLE = isUvInstalled();
  const IS_POETRY_AVAILABLE = isPoetryInstalled();

  it.skipIf(!IS_UV_AVAILABLE)('installs tools with uv', () => {
    createPythonProject(projectDirectory, { manager: 'uv' });

    // This actually runs uv add --dev ruff
    const isResult = installPythonDependencies(projectDirectory, ['ruff']);

    expect(isResult).toBe(true);

    // Verify ruff is now in pyproject.toml
    const pyproject = readTestFile(projectDirectory, 'pyproject.toml');
    expect(pyproject).toContain('ruff');
  });

  // Poetry test disabled: poetry add is too slow/unreliable for CI
  // - Creates new lockfile requiring full dependency resolution (60+ seconds)
  // - Can hang indefinitely even with --no-interaction flag
  // - The uv test above exercises the same installPythonDependencies code path
  // - Production code has 60s timeout to prevent hanging (see setup.ts)
  // Re-enable with: POETRY_AVAILABLE && process.env.TEST_POETRY === "1"
  it.skipIf(!IS_POETRY_AVAILABLE || !process.env.TEST_POETRY)('installs tools with poetry', () => {
    createPythonProject(projectDirectory, { manager: 'poetry' });

    // This actually runs poetry add --group dev ruff
    const isResult = installPythonDependencies(projectDirectory, ['ruff']);

    expect(isResult).toBe(true);

    // Verify ruff is now in pyproject.toml
    const pyproject = readTestFile(projectDirectory, 'pyproject.toml');
    expect(pyproject).toContain('ruff');
  });
});
