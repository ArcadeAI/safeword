/**
 * Unit Tests: Shallow Subdirectory Detection
 *
 * Tests for existsShallow() and findShallow() utilities that detect
 * language manifests in immediate subdirectories.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { existsShallow, findShallow } from '../../src/utils/fs.js';
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
// existsShallow
// =============================================================================

describe('existsShallow', () => {
  it('finds file at project root', () => {
    writeTestFile(projectDirectory, 'pyproject.toml', '[project]\nname = "test"\n');
    expect(existsShallow(projectDirectory, 'pyproject.toml')).toBe(true);
  });

  it('finds file in immediate subdirectory', () => {
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "test"\n');
    expect(existsShallow(projectDirectory, 'pyproject.toml')).toBe(true);
  });

  it('returns false when file does not exist anywhere', () => {
    expect(existsShallow(projectDirectory, 'pyproject.toml')).toBe(false);
  });

  it('excludes node_modules', () => {
    writeTestFile(
      projectDirectory,
      'node_modules/some-pkg/pyproject.toml',
      '[project]\nname = "vendored"\n',
    );
    expect(existsShallow(projectDirectory, 'pyproject.toml')).toBe(false);
  });

  it('excludes hidden directories', () => {
    writeTestFile(projectDirectory, '.venv/pyproject.toml', '[project]\nname = "venv"\n');
    expect(existsShallow(projectDirectory, 'pyproject.toml')).toBe(false);
  });

  it('excludes vendor directory', () => {
    writeTestFile(projectDirectory, 'vendor/lib/go.mod', 'module vendored\n');
    expect(existsShallow(projectDirectory, 'go.mod')).toBe(false);
  });

  it('excludes dbt_packages directory', () => {
    writeTestFile(projectDirectory, 'dbt_packages/some_pkg/dbt_project.yml', 'name: vendored\n');
    expect(existsShallow(projectDirectory, 'dbt_project.yml')).toBe(false);
  });

  it('does not search deeper than one level', () => {
    writeTestFile(
      projectDirectory,
      'packages/backend/pyproject.toml',
      '[project]\nname = "deep"\n',
    );
    expect(existsShallow(projectDirectory, 'pyproject.toml')).toBe(false);
  });
});

// =============================================================================
// findShallow
// =============================================================================

describe('findShallow', () => {
  it('returns cwd when file is at root', () => {
    writeTestFile(projectDirectory, 'pyproject.toml', '[project]\nname = "test"\n');
    expect(findShallow(projectDirectory, 'pyproject.toml')).toBe(projectDirectory);
  });

  it('returns subdirectory path when file is in subdir', () => {
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "test"\n');
    const result = findShallow(projectDirectory, 'pyproject.toml');
    expect(result).toContain('/dbt');
  });

  it('returns undefined when file not found', () => {
    expect(findShallow(projectDirectory, 'pyproject.toml')).toBeUndefined();
  });

  it('prefers root over subdirectory', () => {
    writeTestFile(projectDirectory, 'pyproject.toml', '[project]\nname = "root"\n');
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "sub"\n');
    expect(findShallow(projectDirectory, 'pyproject.toml')).toBe(projectDirectory);
  });
});

// =============================================================================
// detectLanguages with subdirectories
// =============================================================================

describe('detectLanguages with subdirectories', () => {
  it('detects Python in subdirectory', () => {
    writeTestFile(projectDirectory, 'dbt/pyproject.toml', '[project]\nname = "test"\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.python).toBe(true);
  });

  it('detects dbt in subdirectory', () => {
    writeTestFile(projectDirectory, 'dbt/dbt_project.yml', 'name: test\n');
    const languages = detectLanguages(projectDirectory);
    expect(languages.dbt).toBe(true);
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
    expect(languages.dbt).toBe(true);
  });
});
