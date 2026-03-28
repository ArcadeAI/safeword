/**
 * Unit Tests: Recursive Tree Detection
 *
 * Tests for existsInTree() and findInTree() utilities that detect
 * language manifests anywhere in the project tree.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { existsInTree, findInTree } from '../../src/utils/fs.js';
import { detectLanguages } from '../../src/utils/project-detector.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers';

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
// existsInTree
// =============================================================================

describe('existsInTree', () => {
  it('finds file at project root', () => {
    writeTestFile(projectDirectory, 'pyproject.toml', '[project]\nname = "test"\n');
    expect(existsInTree(projectDirectory, 'pyproject.toml')).toBe(true);
  });

  it('finds file in immediate subdirectory', () => {
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "test"\n');
    expect(existsInTree(projectDirectory, 'pyproject.toml')).toBe(true);
  });

  it('finds file at depth 2 (monorepo pattern)', () => {
    writeTestFile(projectDirectory, 'apps/engine/go.mod', 'module example.com/apps/engine\n');
    expect(existsInTree(projectDirectory, 'go.mod')).toBe(true);
  });

  it('finds file at depth 3', () => {
    writeTestFile(
      projectDirectory,
      'platform/services/auth/pyproject.toml',
      '[project]\nname = "auth"\n',
    );
    expect(existsInTree(projectDirectory, 'pyproject.toml')).toBe(true);
  });

  it('returns false when file does not exist anywhere', () => {
    expect(existsInTree(projectDirectory, 'pyproject.toml')).toBe(false);
  });

  it('excludes node_modules', () => {
    writeTestFile(
      projectDirectory,
      'node_modules/some-pkg/pyproject.toml',
      '[project]\nname = "vendored"\n',
    );
    expect(existsInTree(projectDirectory, 'pyproject.toml')).toBe(false);
  });

  it('excludes hidden directories', () => {
    writeTestFile(projectDirectory, '.venv/pyproject.toml', '[project]\nname = "venv"\n');
    expect(existsInTree(projectDirectory, 'pyproject.toml')).toBe(false);
  });

  it('excludes vendor directory', () => {
    writeTestFile(projectDirectory, 'vendor/lib/go.mod', 'module vendored\n');
    expect(existsInTree(projectDirectory, 'go.mod')).toBe(false);
  });

  it('excludes dbt_packages directory', () => {
    writeTestFile(projectDirectory, 'dbt_packages/some_pkg/dbt_project.yml', 'name: vendored\n');
    expect(existsInTree(projectDirectory, 'dbt_project.yml')).toBe(false);
  });

  it('excludes node_modules nested deep', () => {
    writeTestFile(projectDirectory, 'apps/node_modules/pkg/go.mod', 'module vendored\n');
    expect(existsInTree(projectDirectory, 'go.mod')).toBe(false);
  });

  it('excludes vendor nested deep', () => {
    writeTestFile(projectDirectory, 'apps/engine/vendor/dep/go.mod', 'module vendored\n');
    expect(existsInTree(projectDirectory, 'go.mod')).toBe(false);
  });
});

// =============================================================================
// findInTree
// =============================================================================

describe('findInTree', () => {
  it('returns cwd when file is at root', () => {
    writeTestFile(projectDirectory, 'pyproject.toml', '[project]\nname = "test"\n');
    expect(findInTree(projectDirectory, 'pyproject.toml')).toBe(projectDirectory);
  });

  it('returns subdirectory path when file is in subdir', () => {
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "test"\n');
    const result = findInTree(projectDirectory, 'pyproject.toml');
    expect(result).toContain('/dbt');
  });

  it('returns deep subdirectory path', () => {
    writeTestFile(
      projectDirectory,
      'apps/coordinator/pyproject.toml',
      '[project]\nname = "coordinator"\n',
    );
    const result = findInTree(projectDirectory, 'pyproject.toml');
    expect(result).toContain('/apps/coordinator');
  });

  it('returns undefined when file not found', () => {
    expect(findInTree(projectDirectory, 'pyproject.toml')).toBeUndefined();
  });

  it('prefers root over subdirectory', () => {
    writeTestFile(projectDirectory, 'pyproject.toml', '[project]\nname = "root"\n');
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "sub"\n');
    expect(findInTree(projectDirectory, 'pyproject.toml')).toBe(projectDirectory);
  });

  it('respects maxDepth parameter', () => {
    writeTestFile(projectDirectory, 'a/b/c/pyproject.toml', '[project]\nname = "deep"\n');
    // depth 2 should not reach a/b/c (depth 3)
    expect(findInTree(projectDirectory, 'pyproject.toml', 2)).toBeUndefined();
    // depth 3 should reach it
    expect(findInTree(projectDirectory, 'pyproject.toml', 3)).toContain('/a/b/c');
  });
});

// =============================================================================
// detectLanguages with deep subdirectories
// =============================================================================

describe('detectLanguages with subdirectories', () => {
  it('detects Python in subdirectory', () => {
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "test"\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.python).toBe(true);
  });

  it('detects SQL in subdirectory', () => {
    writeTestFile(projectDirectory, 'dbt/dbt_project.yml', 'name: test\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.sql).toBe(true);
  });

  it('detects Go in subdirectory', () => {
    writeTestFile(projectDirectory, 'backend/go.mod', 'module example.com/backend\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.golang).toBe(true);
  });

  it('detects Rust in subdirectory', () => {
    writeTestFile(projectDirectory, 'native/Cargo.toml', '[package]\nname = "native"\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.rust).toBe(true);
  });

  it('does NOT detect JS/TS in subdirectory (root-only)', () => {
    writeTestFile(projectDirectory, 'frontend/package.json', '{"name": "test"}\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.javascript).toBe(false);
  });

  it('detects multiple languages across root and subdirectories', () => {
    writeTestFile(projectDirectory, 'package.json', '{"name": "root"}\n');
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "dbt"\n');
    writeTestFile(projectDirectory, 'dbt/dbt_project.yml', 'name: dbt\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.javascript).toBe(true);
    expect(languages.python).toBe(true);
    expect(languages.sql).toBe(true);
  });

  it('detects Go at depth 2 (monorepo pattern)', () => {
    writeTestFile(projectDirectory, 'apps/engine/go.mod', 'module example.com/engine\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.golang).toBe(true);
  });

  it('detects Python at depth 2 (monorepo pattern)', () => {
    writeTestFile(
      projectDirectory,
      'apps/coordinator/pyproject.toml',
      '[project]\nname = "coordinator"\n',
    );
    const languages = detectLanguages(projectDirectory);
    expect(languages.python).toBe(true);
  });
});
