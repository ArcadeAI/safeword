/**
 * Unit Tests: Python Setup Utilities
 *
 * Tests for package manager detection and dependency installation logic.
 */

import { chmodSync, existsSync, symlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectPythonPackageManager,
  findPythonProjectDirectories,
  getMissingPythonToolDependencies,
  getPythonToolDependencyGaps,
  getPythonTools,
  hasRuffDependency,
  installPythonDependencies,
} from '../../src/packs/python/setup.js';
import {
  createPythonProject,
  createTemporaryDirectory,
  isPoetryInstalled,
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

  it('returns only required Python tools that the project has not declared', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"
dependencies = ["ruff>=0.8.0", "mypy"]
`,
    );

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual(['deadcode']);
  });

  it('recognizes tools in multiline dependency arrays with PEP 508 extras and comments', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"
dependencies = [
  "ruff[format]>=0.8.0",
  # The ] in this comment does not close the dependency list.
  "mypy",
  "deadcode",
]
`,
    );

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([]);
  });

  it('recognizes required Python tools declared in requirements.txt', () => {
    writeTestFile(
      context.projectDirectory,
      'requirements.txt',
      ['ruff>=0.8.0', 'mypy', 'deadcode==1.0.0'].join('\n'),
    );

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([]);
  });

  it('does not treat descriptive or tool-config strings as Python dependency declarations', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"
description = "mypy plugins"

[tool.ruff]
extend = "ruff"
`,
    );

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([
      'ruff',
      'mypy',
      'deadcode',
    ]);
  });

  it('recognizes requirement markers and direct references', () => {
    writeTestFile(
      context.projectDirectory,
      'requirements.txt',
      [
        'ruff; python_version >= "3.10"',
        'mypy @ git+https://github.com/python/mypy.git',
        'deadcode==1.0.0',
      ].join('\n'),
    );

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([]);
  });

  it.each([
    [
      'PEP 621',
      'pyproject.toml',
      `[project]
name = "test"
dependencies = ["ruff", "mypy", "deadcode", "import_linter"]
`,
    ],
    [
      'Poetry',
      'pyproject.toml',
      `[tool.poetry.group.dev.dependencies]
ruff = "*"
mypy = "*"
deadcode = "*"
"import.linter" = "*"
`,
    ],
    ['requirements', 'requirements.txt', 'ruff\nmypy\ndeadcode\nimport_linter\n'],
  ])('normalizes equivalent import-linter names in %s declarations', (_format, path, content) => {
    writeTestFile(context.projectDirectory, path, content);
    writeTestFile(context.projectDirectory, 'src/test/__init__.py', '');

    expect(getMissingPythonToolDependencies(context.projectDirectory, true)).toEqual([]);
  });

  it('reads local requirements includes', () => {
    writeTestFile(context.projectDirectory, 'requirements.txt', '-r requirements-dev.txt\n');
    writeTestFile(
      context.projectDirectory,
      'requirements-dev.txt',
      'ruff\nmypy\ndeadcode\nimport-linter\n',
    );
    writeTestFile(context.projectDirectory, 'src/test/__init__.py', '');

    expect(getMissingPythonToolDependencies(context.projectDirectory, true)).toEqual([]);
  });

  it('does not follow requirements includes that escape through a symlink', () => {
    const externalDirectory = createTemporaryDirectory();
    try {
      writeTestFile(externalDirectory, 'requirements-dev.txt', 'ruff\nmypy\ndeadcode\n');
      writeTestFile(context.projectDirectory, 'requirements.txt', '-r requirements-dev.txt\n');
      symlinkSync(
        nodePath.join(externalDirectory, 'requirements-dev.txt'),
        nodePath.join(context.projectDirectory, 'requirements-dev.txt'),
      );

      expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([
        'ruff',
        'mypy',
        'deadcode',
      ]);
    } finally {
      removeTemporaryDirectory(externalDirectory);
    }
  });

  it('requires import-linter for an importable Python package', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      `[project]
name = "test"
dependencies = ["ruff", "mypy", "deadcode"]
`,
    );
    writeTestFile(context.projectDirectory, 'src/test/__init__.py', '');

    expect(getMissingPythonToolDependencies(context.projectDirectory, true)).toEqual([
      'import-linter',
    ]);
  });
});

describe('repository Python projects', () => {
  it('checks declarations in nested projects instead of inventing a root Python project', () => {
    writeTestFile(context.projectDirectory, 'package.json', '{"private":true}\n');
    writeTestFile(
      context.projectDirectory,
      'apps/api/pyproject.toml',
      '[project]\nname="api"\ndependencies=["ruff", "mypy", "deadcode"]\n',
    );

    expect(findPythonProjectDirectories(context.projectDirectory)).toEqual([
      nodePath.join(context.projectDirectory, 'apps/api'),
    ]);
    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([]);
  });

  it('keeps missing declarations attached to each project and ignores vendored manifests', () => {
    writeTestFile(
      context.projectDirectory,
      'apps/api/pyproject.toml',
      '[project]\nname="api"\ndependencies=["ruff", "mypy", "deadcode"]\n',
    );
    writeTestFile(context.projectDirectory, 'services/worker/requirements.txt', 'ruff\n');
    writeTestFile(context.projectDirectory, 'vendor/example/requirements.txt', 'ruff\n');

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([
      {
        directory: nodePath.join(context.projectDirectory, 'services/worker'),
        tools: ['mypy', 'deadcode'],
      },
    ]);
  });

  it.each(['setup.py', 'setup.cfg'])('discovers nested legacy %s projects', manifest => {
    writeTestFile(context.projectDirectory, `services/legacy/${manifest}`, '');

    expect(findPythonProjectDirectories(context.projectDirectory)).toEqual([
      nodePath.join(context.projectDirectory, 'services/legacy'),
    ]);
  });

  it.each([
    ['setup.py', 'setup(name="legacy", extras_require={"dev": ["ruff", "mypy", "deadcode"]})\n'],
    ['setup.cfg', '[options.extras_require]\ndev =\n  ruff\n  mypy\n  deadcode\n'],
  ])('reads tool declarations from legacy %s projects', (manifest, content) => {
    writeTestFile(context.projectDirectory, `services/legacy/${manifest}`, content);

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([]);
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

  it('inherits a workspace-root uv lock for a declared nested member', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      '[tool.uv.workspace]\nmembers=["apps/*"]\n',
    );
    writeTestFile(context.projectDirectory, 'uv.lock', '');
    writeTestFile(context.projectDirectory, 'apps/api/pyproject.toml', '[project]\nname="api"\n');

    expect(
      detectPythonPackageManager(
        nodePath.join(context.projectDirectory, 'apps/api'),
        context.projectDirectory,
      ),
    ).toBe('uv');
  });

  it('does not inherit an intermediate uv lock without workspace membership', () => {
    writeTestFile(context.projectDirectory, 'services/uv.lock', '');
    writeTestFile(
      context.projectDirectory,
      'services/legacy/pyproject.toml',
      '[project]\nname="legacy"\n',
    );

    expect(
      detectPythonPackageManager(
        nodePath.join(context.projectDirectory, 'services/legacy'),
        context.projectDirectory,
      ),
    ).toBe('pip');
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

  const IS_POETRY_AVAILABLE = isPoetryInstalled();

  it('invokes uv in the project directory without using the network', () => {
    createPythonProject(context.projectDirectory, { manager: 'uv' });
    const bin = nodePath.join(context.projectDirectory, 'bin');
    const log = nodePath.join(context.projectDirectory, 'uv.log');
    const originalPath = process.env.PATH;
    const originalSkipInstall = process.env.SAFEWORD_SKIP_INSTALL;
    const originalLog = process.env.SAFEWORD_UV_LOG;

    writeTestFile(
      context.projectDirectory,
      'bin/uv',
      '#!/bin/sh\nprintf "%s|%s\\n" "$PWD" "$*" >> "$SAFEWORD_UV_LOG"\n',
    );
    chmodSync(nodePath.join(bin, 'uv'), 0o755);
    process.env.PATH = `${bin}:${originalPath ?? ''}`;
    process.env.SAFEWORD_UV_LOG = log;
    delete process.env.SAFEWORD_SKIP_INSTALL;

    try {
      expect(installPythonDependencies(context.projectDirectory, ['ruff'])).toBe(true);
      expect(existsSync(log)).toBe(true);
      expect(readTestFile(context.projectDirectory, 'uv.log')).toContain(
        `${context.projectDirectory}|add --dev ruff`,
      );
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalSkipInstall === undefined) delete process.env.SAFEWORD_SKIP_INSTALL;
      else process.env.SAFEWORD_SKIP_INSTALL = originalSkipInstall;
      if (originalLog === undefined) delete process.env.SAFEWORD_UV_LOG;
      else process.env.SAFEWORD_UV_LOG = originalLog;
    }
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
