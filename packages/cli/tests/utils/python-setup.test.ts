/**
 * Unit Tests: Python Setup Utilities
 *
 * Tests for package manager detection and dependency installation logic.
 */

import { chmodSync, existsSync, realpathSync, symlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectPythonLayers,
  detectPythonPackageManager,
  detectRootPackage,
  detectSolePackage,
  findPythonProjectDirectories,
  getMissingPythonToolDependencies,
  getPythonToolDependencyGaps,
  getPythonTools,
  hasRuffDependency,
  installPythonDependencies,
  installPythonDependencyBatch,
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

function withFakeUv<T>(
  script: string,
  action: () => T,
  options: { failLockCheck?: boolean } = {},
): { calls: string[]; result: T } {
  const bin = nodePath.join(context.projectDirectory, 'bin');
  const log = nodePath.join(context.projectDirectory, 'uv.log');
  const originalPath = process.env.PATH;
  const originalLog = process.env.SAFEWORD_UV_LOG;
  const originalRoot = process.env.SAFEWORD_UV_ROOT;
  const originalFailCheck = process.env.SAFEWORD_UV_FAIL_CHECK;
  const originalSkipInstall = process.env.SAFEWORD_SKIP_INSTALL;
  writeTestFile(context.projectDirectory, 'bin/uv', script);
  chmodSync(nodePath.join(bin, 'uv'), 0o755);
  process.env.PATH = `${bin}:${originalPath ?? ''}`;
  process.env.SAFEWORD_UV_LOG = log;
  process.env.SAFEWORD_UV_ROOT = context.projectDirectory;
  delete process.env.SAFEWORD_SKIP_INSTALL;
  if (options.failLockCheck) process.env.SAFEWORD_UV_FAIL_CHECK = '1';
  else delete process.env.SAFEWORD_UV_FAIL_CHECK;

  try {
    const result = action();
    const calls = existsSync(log)
      ? readTestFile(context.projectDirectory, 'uv.log').trim().split('\n').filter(Boolean)
      : [];
    return { calls, result };
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalLog === undefined) delete process.env.SAFEWORD_UV_LOG;
    else process.env.SAFEWORD_UV_LOG = originalLog;
    if (originalRoot === undefined) delete process.env.SAFEWORD_UV_ROOT;
    else process.env.SAFEWORD_UV_ROOT = originalRoot;
    if (originalFailCheck === undefined) delete process.env.SAFEWORD_UV_FAIL_CHECK;
    else process.env.SAFEWORD_UV_FAIL_CHECK = originalFailCheck;
    if (originalSkipInstall === undefined) delete process.env.SAFEWORD_SKIP_INSTALL;
    else process.env.SAFEWORD_SKIP_INSTALL = originalSkipInstall;
  }
}

// =============================================================================
// Tool set (shared by setup + upgrade — the anti-drift source of truth)
// =============================================================================

describe('getPythonTools', () => {
  it('installs verification and audit tools by default', () => {
    expect(getPythonTools(false)).toEqual(['ruff', 'mypy', 'deadcode', 'pip-audit']);
  });

  it('adds import-linter when a config would be scaffolded', () => {
    expect(getPythonTools(true)).toEqual([
      'ruff',
      'mypy',
      'deadcode',
      'pip-audit',
      'import-linter',
    ]);
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

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([
      'deadcode',
      'pip-audit',
    ]);
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
  "pip-audit",
]
`,
    );

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([]);
  });

  it('recognizes required Python tools declared in requirements.txt', () => {
    writeTestFile(
      context.projectDirectory,
      'requirements.txt',
      ['ruff>=0.8.0', 'mypy', 'deadcode==1.0.0', 'pip-audit'].join('\n'),
    );

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([]);
  });

  it.each([
    'requirements-dev.txt',
    'requirements-dev.in',
    'dev-requirements.txt',
    'test_requirements.txt',
    'requirements/dev.txt',
    'requirements/dev.in',
  ])('recognizes required Python tools declared in %s', path => {
    writeTestFile(
      context.projectDirectory,
      path,
      ['ruff>=0.8.0', 'mypy', 'deadcode==1.0.0', 'pip-audit'].join('\n'),
    );

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([]);
    expect(findPythonProjectDirectories(context.projectDirectory)).toEqual([
      context.projectDirectory,
    ]);
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
      'pip-audit',
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
        'pip-audit',
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
dependencies = ["ruff", "mypy", "deadcode", "pip-audit", "import_linter"]
`,
    ],
    [
      'Poetry',
      'pyproject.toml',
      `[tool.poetry.group.dev.dependencies]
ruff = "*"
mypy = "*"
deadcode = "*"
pip-audit = "*"
"import.linter" = "*"
`,
    ],
    ['requirements', 'requirements.txt', 'ruff\nmypy\ndeadcode\npip-audit\nimport_linter\n'],
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
      'ruff\nmypy\ndeadcode\npip-audit\nimport-linter\n',
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
        'pip-audit',
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
dependencies = ["ruff", "mypy", "deadcode", "pip-audit"]
`,
    );
    writeTestFile(context.projectDirectory, 'src/test/__init__.py', '');

    expect(getMissingPythonToolDependencies(context.projectDirectory, true)).toEqual([
      'import-linter',
    ]);
  });
});

describe('Python architecture discovery', () => {
  it('detects layer directories but ignores plain files with layer names', () => {
    writeTestFile(context.projectDirectory, 'core', 'not a directory\n');
    writeTestFile(context.projectDirectory, 'src/routes', 'not a directory\n');
    writeTestFile(context.projectDirectory, 'src/domain/__init__.py', '');

    expect(detectPythonLayers(context.projectDirectory)).toEqual(['domain']);
  });

  it('returns only an unambiguous importable package', () => {
    writeTestFile(context.projectDirectory, 'src/acme/__init__.py', '');
    expect(detectSolePackage(context.projectDirectory)).toBe('acme');

    writeTestFile(context.projectDirectory, 'src/other/__init__.py', '');
    expect(detectSolePackage(context.projectDirectory)).toBeUndefined();
  });

  it('reads the package name from project metadata instead of an unrelated TOML table', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      '[tool.commitizen]\nname = "wrong-name"\n\n[project]\nname = "right-name"\n',
    );

    expect(detectRootPackage(context.projectDirectory)).toBe('right_name');
  });

  it('falls back to Poetry package metadata', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      '[build-system]\nname = "wrong-name"\n\n[tool.poetry]\nname = "poetry-name"\n',
    );

    expect(detectRootPackage(context.projectDirectory)).toBe('poetry_name');
  });
});

describe('repository Python projects', () => {
  it("treats a flat nested requirements.txt as that directory's pip project manifest", () => {
    writeTestFile(context.projectDirectory, 'docs/requirements.txt', 'sphinx\n');

    expect(findPythonProjectDirectories(context.projectDirectory)).toEqual([
      nodePath.join(context.projectDirectory, 'docs'),
    ]);
  });

  it('ignores documentation requirements folders without a Python project marker', () => {
    writeTestFile(context.projectDirectory, 'docs/requirements/product.txt', 'product notes\n');
    writeTestFile(context.projectDirectory, 'guide/requirements/requirements-dev.txt', 'ruff\n');

    expect(findPythonProjectDirectories(context.projectDirectory)).toEqual([]);
  });

  it('discovers a root requirements directory from a relative cwd', () => {
    writeTestFile(context.projectDirectory, 'requirements/dev.txt', 'ruff\n');
    const relative = nodePath.relative(process.cwd(), context.projectDirectory);

    expect(findPythonProjectDirectories(relative)).toEqual([context.projectDirectory]);
  });

  it('does not crash when requirements is a regular file', () => {
    writeTestFile(context.projectDirectory, 'requirements', 'not a directory\n');

    expect(getMissingPythonToolDependencies(context.projectDirectory, false)).toEqual([
      'ruff',
      'mypy',
      'deadcode',
      'pip-audit',
    ]);
  });

  it('checks declarations in nested projects instead of inventing a root Python project', () => {
    writeTestFile(context.projectDirectory, 'package.json', '{"private":true}\n');
    writeTestFile(
      context.projectDirectory,
      'apps/api/pyproject.toml',
      '[project]\nname="api"\ndependencies=["ruff", "mypy", "deadcode", "pip-audit"]\n',
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
      '[project]\nname="api"\ndependencies=["ruff", "mypy", "deadcode", "pip-audit"]\n',
    );
    writeTestFile(context.projectDirectory, 'services/worker/requirements.txt', 'ruff\n');
    writeTestFile(context.projectDirectory, 'vendor/example/requirements.txt', 'ruff\n');

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([
      {
        directory: nodePath.join(context.projectDirectory, 'services/worker'),
        tools: ['mypy', 'deadcode', 'pip-audit'],
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
    [
      'setup.py',
      'setup(name="legacy", extras_require={"dev": ["ruff>=0.8", "mypy @ git+https://github.com/python/mypy.git#egg=mypy", "deadcode==1.0", "pip-audit~=2.0"]})\n',
    ],
    [
      'setup.cfg',
      '[options.extras_require]\ndev =\n  ruff>=0.8\n  mypy; python_version >= "3.10"\n  deadcode==1.0\n  pip-audit~=2.0\n',
    ],
  ])('reads tool declarations from legacy %s projects', (manifest, content) => {
    writeTestFile(context.projectDirectory, `services/legacy/${manifest}`, content);

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([]);
  });

  it('does not treat setup.cfg tool configuration as a dependency declaration', () => {
    writeTestFile(
      context.projectDirectory,
      'services/legacy/setup.cfg',
      '[mypy]\nstrict = True\n\n[ruff]\nline-length = 100\n',
    );

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([
      {
        directory: nodePath.join(context.projectDirectory, 'services/legacy'),
        tools: ['ruff', 'mypy', 'deadcode', 'pip-audit'],
      },
    ]);
  });

  it('does not treat setup.py comments as dependency declarations', () => {
    writeTestFile(
      context.projectDirectory,
      'services/legacy/setup.py',
      '# Run ruff and mypy before committing.\nfrom setuptools import setup\nsetup(name="legacy")\n',
    );

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([
      {
        directory: nodePath.join(context.projectDirectory, 'services/legacy'),
        tools: ['ruff', 'mypy', 'deadcode', 'pip-audit'],
      },
    ]);
  });

  it('does not treat setup.py multiline examples as dependency declarations', () => {
    writeTestFile(
      context.projectDirectory,
      'services/legacy/setup.py',
      '"""\nExample only:\n    setup(install_requires=["ruff", "mypy"])\n"""\nfrom setuptools import setup\nsetup(name="legacy")\n',
    );

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([
      {
        directory: nodePath.join(context.projectDirectory, 'services/legacy'),
        tools: ['ruff', 'mypy', 'deadcode', 'pip-audit'],
      },
    ]);
  });

  it('does not scan a later list when install_requires names a variable', () => {
    writeTestFile(
      context.projectDirectory,
      'services/legacy/setup.py',
      'from setuptools import setup\nREQUIREMENTS = []\nsetup(install_requires=REQUIREMENTS, classifiers=["ruff", "mypy"])\n',
    );

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([
      {
        directory: nodePath.join(context.projectDirectory, 'services/legacy'),
        tools: ['ruff', 'mypy', 'deadcode', 'pip-audit'],
      },
    ]);
  });

  it('does not treat an extras_require group name as a dependency', () => {
    writeTestFile(
      context.projectDirectory,
      'services/legacy/setup.py',
      'from setuptools import setup\nsetup(extras_require={"ruff": ["requests"]})\n',
    );

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([
      {
        directory: nodePath.join(context.projectDirectory, 'services/legacy'),
        tools: ['ruff', 'mypy', 'deadcode', 'pip-audit'],
      },
    ]);
  });

  it('keeps bracket tracking stable around triple-quoted setup.py values', () => {
    writeTestFile(
      context.projectDirectory,
      'services/legacy/setup.py',
      'from setuptools import setup\nsetup(install_requires=["ruff", """example ] text""", "mypy", "deadcode", "pip-audit"])\n',
    );

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([]);
  });

  it('reads pinned install_requires declarations from setup.cfg', () => {
    writeTestFile(
      context.projectDirectory,
      'services/legacy/setup.cfg',
      '[options]\ninstall_requires =\n  ruff>=0.8\n  mypy; python_version >= "3.10"\n  deadcode==1.0\n  pip-audit~=2.0\n',
    );

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([]);
  });

  it('stops a setup.cfg dependency continuation at a column-zero comment', () => {
    writeTestFile(
      context.projectDirectory,
      'services/legacy/setup.cfg',
      '[options]\ninstall_requires =\n  requests\n# dependency block ended\n  ruff\n',
    );

    expect(getPythonToolDependencyGaps(context.projectDirectory, () => false)).toEqual([
      {
        directory: nodePath.join(context.projectDirectory, 'services/legacy'),
        tools: ['ruff', 'mypy', 'deadcode', 'pip-audit'],
      },
    ]);
  });

  it('inherits Python tool declarations from an owning uv workspace root', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      '[tool.uv.workspace]\nmembers=["apps/*"]\n\n[dependency-groups]\ndev=["ruff", "mypy", "deadcode", "pip-audit"]\n',
    );
    writeTestFile(context.projectDirectory, 'uv.lock', 'version = 1\n');
    writeTestFile(
      context.projectDirectory,
      'apps/api/pyproject.toml',
      '[project]\nname="api"\nversion="0.1.0"\n',
    );

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

  it('does not detect poetry from a commented section header', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      '[project]\nname = "test"\n\n# [tool.poetry]\n',
    );

    expect(detectPythonPackageManager(context.projectDirectory)).toBe('pip');
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

  it('treats a nested Poetry project as independent unless it declares Poetry itself', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      '[tool.poetry]\nname="root"\nversion="0.1.0"\n',
    );
    writeTestFile(context.projectDirectory, 'poetry.lock', '');
    writeTestFile(
      context.projectDirectory,
      'apps/api/pyproject.toml',
      '[project]\nname="api"\nversion="0.1.0"\n',
    );

    expect(
      detectPythonPackageManager(
        nodePath.join(context.projectDirectory, 'apps/api'),
        context.projectDirectory,
      ),
    ).toBe('pip');
  });

  it('terminates at pip when the requested project is outside the supplied root', () => {
    const impossibleRoot = nodePath.join(context.projectDirectory, 'nested-root');

    expect(detectPythonPackageManager(context.projectDirectory, impossibleRoot)).toBe('pip');
  });

  it('does not inherit a uv lock from outside the supplied repository root', () => {
    const externalProject = createTemporaryDirectory();
    try {
      writeTestFile(
        context.projectDirectory,
        'pyproject.toml',
        '[dependency-groups]\ndev=["ruff", "mypy", "deadcode", "pip-audit"]\n',
      );
      writeTestFile(context.projectDirectory, 'uv.lock', 'version = 1\n');
      writeTestFile(externalProject, 'pyproject.toml', '[project]\nname="external"\n');

      expect(
        getMissingPythonToolDependencies(externalProject, false, context.projectDirectory),
      ).toEqual(['ruff', 'mypy', 'deadcode', 'pip-audit']);
    } finally {
      removeTemporaryDirectory(externalProject);
    }
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

  it('does not invoke uv lock when batch installation is skipped', () => {
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
    process.env.SAFEWORD_SKIP_INSTALL = '1';
    try {
      expect(
        installPythonDependencyBatch(
          [{ directory: context.projectDirectory, tools: ['ruff'] }],
          context.projectDirectory,
        ),
      ).toEqual([true]);
      expect(existsSync(log)).toBe(false);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalSkipInstall === undefined) delete process.env.SAFEWORD_SKIP_INSTALL;
      else process.env.SAFEWORD_SKIP_INSTALL = originalSkipInstall;
      if (originalLog === undefined) delete process.env.SAFEWORD_UV_LOG;
      else process.env.SAFEWORD_UV_LOG = originalLog;
    }
  });

  it('installs every uv workspace gap before finalizing and checking the shared lock', () => {
    writeTestFile(
      context.projectDirectory,
      'pyproject.toml',
      '[tool.uv.workspace]\nmembers=["apps/*"]\n',
    );
    writeTestFile(context.projectDirectory, 'uv.lock', 'version = 1\n');
    const api = nodePath.join(context.projectDirectory, 'apps/api');
    const worker = nodePath.join(context.projectDirectory, 'apps/worker');
    writeTestFile(context.projectDirectory, 'apps/api/pyproject.toml', '[project]\nname="api"\n');
    writeTestFile(
      context.projectDirectory,
      'apps/worker/pyproject.toml',
      '[project]\nname="worker"\n',
    );

    const { calls, result } = withFakeUv(
      '#!/bin/sh\nprintf "%s|%s\\n" "$PWD" "$*" >> "$SAFEWORD_UV_LOG"\n',
      () =>
        installPythonDependencyBatch(
          [
            { directory: api, tools: ['ruff'] },
            { directory: worker, tools: ['mypy'] },
          ],
          context.projectDirectory,
        ),
    );
    const physicalRoot = realpathSync(context.projectDirectory);

    expect(result).toEqual([true, true]);
    expect(calls).toEqual([
      `${nodePath.join(physicalRoot, 'apps/api')}|add --dev ruff`,
      `${nodePath.join(physicalRoot, 'apps/worker')}|add --dev mypy`,
      `${physicalRoot}|lock`,
      `${physicalRoot}|lock --check`,
    ]);
  });

  it('rolls back every uv workspace file when final lock verification fails', () => {
    const rootManifest = '[tool.uv.workspace]\nmembers=["apps/*"]\n';
    const rootLock = 'version = 1\n';
    const apiManifest = '[project]\nname="api"\n';
    const workerManifest = '[project]\nname="worker"\n';
    writeTestFile(context.projectDirectory, 'pyproject.toml', rootManifest);
    writeTestFile(context.projectDirectory, 'uv.lock', rootLock);
    writeTestFile(context.projectDirectory, 'apps/api/pyproject.toml', apiManifest);
    writeTestFile(context.projectDirectory, 'apps/worker/pyproject.toml', workerManifest);
    const api = nodePath.join(context.projectDirectory, 'apps/api');
    const worker = nodePath.join(context.projectDirectory, 'apps/worker');
    const script = String.raw`#!/bin/sh
printf "%s|%s\n" "$PWD" "$*" >> "$SAFEWORD_UV_LOG"
if [ "$1" = "add" ]; then
  printf '\n# mutated\n' >> pyproject.toml
  printf '\n# mutated\n' >> "$SAFEWORD_UV_ROOT/pyproject.toml"
  printf '\n# mutated\n' >> "$SAFEWORD_UV_ROOT/uv.lock"
fi
if [ "$1" = "lock" ] && [ "$2" = "--check" ] && [ "$SAFEWORD_UV_FAIL_CHECK" = "1" ]; then
  exit 9
fi
`;

    const { calls, result } = withFakeUv(
      script,
      () =>
        installPythonDependencyBatch(
          [
            { directory: api, tools: ['ruff'] },
            { directory: worker, tools: ['mypy'] },
          ],
          context.projectDirectory,
        ),
      { failLockCheck: true },
    );
    const physicalRoot = realpathSync(context.projectDirectory);

    expect(result).toEqual([false, false]);
    expect(calls.at(-2)).toBe(`${physicalRoot}|lock`);
    expect(calls.at(-1)).toBe(`${physicalRoot}|lock --check`);
    expect(readTestFile(context.projectDirectory, 'pyproject.toml')).toBe(rootManifest);
    expect(readTestFile(context.projectDirectory, 'uv.lock')).toBe(rootLock);
    expect(readTestFile(context.projectDirectory, 'apps/api/pyproject.toml')).toBe(apiManifest);
    expect(readTestFile(context.projectDirectory, 'apps/worker/pyproject.toml')).toBe(
      workerManifest,
    );
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

  it('rolls back the workspace manifest when direct uv installation fails', () => {
    const rootManifest = '[tool.uv.workspace]\nmembers=["apps/*"]\n';
    const memberManifest = '[project]\nname="api"\n';
    const rootLock = 'version = 1\n';
    writeTestFile(context.projectDirectory, 'pyproject.toml', rootManifest);
    writeTestFile(context.projectDirectory, 'uv.lock', rootLock);
    writeTestFile(context.projectDirectory, 'apps/api/pyproject.toml', memberManifest);
    const api = nodePath.join(context.projectDirectory, 'apps/api');
    const script = String.raw`#!/bin/sh
printf '\n# mutated\n' >> pyproject.toml
printf '\n# mutated\n' >> "$SAFEWORD_UV_ROOT/pyproject.toml"
printf '\n# mutated\n' >> "$SAFEWORD_UV_ROOT/uv.lock"
exit 9
`;

    const { result } = withFakeUv(script, () =>
      installPythonDependencies(api, ['ruff'], context.projectDirectory),
    );

    expect(result).toBe(false);
    expect(readTestFile(context.projectDirectory, 'pyproject.toml')).toBe(rootManifest);
    expect(readTestFile(context.projectDirectory, 'uv.lock')).toBe(rootLock);
    expect(readTestFile(context.projectDirectory, 'apps/api/pyproject.toml')).toBe(memberManifest);
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
