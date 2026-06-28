/**
 * Unit tests for the architecture skeleton extractor (ticket QD5DTT, Slice 1).
 * Covers the "skeleton reflects the real project" rule from
 * features/architecture-state-docs.feature. Temp-dir fixtures, no project setup.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractSkeleton, purposeFloorViolations } from '../../src/utils/architecture-skeleton.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

beforeEach(() => {
  context.directory = createTemporaryDirectory();
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('extractSkeleton — skeleton reflects the real project', () => {
  it('lists exactly the top-level src modules, each referencing its real path', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'auth',
      'billing',
    ]);

    const pathByName = Object.fromEntries(skeleton.nodes.map(node => [node.name, node.path]));
    expect(pathByName.auth).toBe(nodePath.join('src', 'auth'));
    expect(pathByName.billing).toBe(nodePath.join('src', 'billing'));
  });

  it('gives every node a non-empty purpose and flags a node missing one', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.every(node => node.purpose.trim().length > 0)).toBe(true);

    expect(purposeFloorViolations([{ name: 'blanked', path: 'src/blanked', purpose: '' }])).toEqual(
      ['blanked'],
    );
  });

  it('does not list a file outside any module as a node', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'scripts'), { recursive: true });
    writeFileSync(nodePath.join(context.directory, 'scripts', 'build.ts'), 'export {};\n');

    const skeleton = extractSkeleton(context.directory);

    const names = skeleton.nodes.map(node => node.name);
    expect(names).not.toContain('build.ts');
    expect(names).not.toContain('scripts');
  });

  it('produces a minimal skeleton when there is no src directory', () => {
    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });

  it('produces an empty skeleton when src exists but holds no modules', () => {
    mkdirSync(nodePath.join(context.directory, 'src'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });

  it('is content-agnostic — a malformed file in a module never aborts extraction', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
    writeFileSync(
      nodePath.join(context.directory, 'src', 'auth', 'broken.ts'),
      'function ( { this is not valid typescript <<<',
    );

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toContain('auth');
  });
});

describe('extractSkeleton — Go layout (ticket ZD70P1)', () => {
  function writeGoModule(directory: string, modulePath = 'example.com/app'): void {
    writeFileSync(nodePath.join(directory, 'go.mod'), `module ${modulePath}\n\ngo 1.22\n`);
  }

  it('lists the recognized Go layout directories as modules when there is a go.mod', () => {
    writeGoModule(context.directory);
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'internal', 'store'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'pkg', 'api'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['cmd', 'internal', 'pkg']);
    const pathByName = Object.fromEntries(skeleton.nodes.map(node => [node.name, node.path]));
    expect(pathByName.cmd).toBe('cmd');
    expect(pathByName.internal).toBe('internal');
    expect(pathByName.pkg).toBe('pkg');
  });

  it('lists only the recognized Go directories that are present', () => {
    writeGoModule(context.directory);
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'docs'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['cmd']);
  });

  it('keeps the src layout authoritative — go.mod is ignored when src modules exist', () => {
    writeGoModule(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'core'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['core']);
    expect(skeleton.nodes[0]?.path).toBe(nodePath.join('src', 'core'));
  });

  it('produces an empty skeleton for a flat Go package with no recognized layout', () => {
    writeGoModule(context.directory);
    writeFileSync(nodePath.join(context.directory, 'main.go'), 'package main\n');

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });

  it('does not treat cmd/internal/pkg as modules without a go.mod', () => {
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });
});

describe('extractSkeleton — Rust layout (ticket YKFA5X)', () => {
  function writeCargo(directory: string, name = 'app'): void {
    writeFileSync(nodePath.join(directory, 'Cargo.toml'), `[package]\nname = "${name}"\n`);
  }

  function writeRustFile(directory: string, file: string): void {
    mkdirSync(nodePath.join(directory, 'src'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'src', file), '// rust\n');
  }

  it('lists src module files and dirs, excluding the lib.rs/main.rs roots', () => {
    writeCargo(context.directory);
    writeRustFile(context.directory, 'lib.rs');
    writeRustFile(context.directory, 'config.rs');
    mkdirSync(nodePath.join(context.directory, 'src', 'handlers'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['config', 'handlers']);
    const pathByName = Object.fromEntries(skeleton.nodes.map(node => [node.name, node.path]));
    expect(pathByName.config).toBe('src/config.rs');
    expect(pathByName.handlers).toBe('src/handlers');
  });

  it('excludes main.rs as a crate root', () => {
    writeCargo(context.directory);
    writeRustFile(context.directory, 'main.rs');
    writeRustFile(context.directory, 'cli.rs');

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['cli']);
  });

  it('produces an empty skeleton for a crate with only a root file', () => {
    writeCargo(context.directory);
    writeRustFile(context.directory, 'lib.rs');

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });

  it('lists FILE modules even when a dir module is also present (not dir-only)', () => {
    writeCargo(context.directory);
    writeRustFile(context.directory, 'error.rs');
    mkdirSync(nodePath.join(context.directory, 'src', 'store'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['error', 'store']);
  });

  it('does not list src/*.rs files without a Cargo.toml (TS stays dir-only)', () => {
    writeRustFile(context.directory, 'thing.rs');

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes).toEqual([]);
  });
});

describe('extractSkeleton — Python layout (ticket HWSEPV)', () => {
  function writePyproject(directory: string, name = 'app'): void {
    writeFileSync(nodePath.join(directory, 'pyproject.toml'), `[project]\nname = "${name}"\n`);
  }

  it('lists src-layout modules: src packages and src .py files, excluding dunder', () => {
    writePyproject(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'api'), { recursive: true });
    writeFileSync(nodePath.join(context.directory, 'src', 'db.py'), '');
    writeFileSync(nodePath.join(context.directory, 'src', '__init__.py'), '');

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['api', 'db']);
    const pathByName = Object.fromEntries(skeleton.nodes.map(node => [node.name, node.path]));
    expect(pathByName.api).toBe('src/api');
    expect(pathByName.db).toBe('src/db.py');
  });

  it('lists flat-layout root packages and modules, excluding tooling and dunder', () => {
    writePyproject(context.directory);
    mkdirSync(nodePath.join(context.directory, 'core'), { recursive: true });
    writeFileSync(nodePath.join(context.directory, 'core', '__init__.py'), '');
    writeFileSync(nodePath.join(context.directory, 'utils.py'), '');
    writeFileSync(nodePath.join(context.directory, 'conftest.py'), '');
    writeFileSync(nodePath.join(context.directory, '__init__.py'), '');
    mkdirSync(nodePath.join(context.directory, 'tests'), { recursive: true }); // no __init__.py → not a package

    const skeleton = extractSkeleton(context.directory);

    expect(skeleton.nodes.map(node => node.name)).toEqual(['core', 'utils']);
  });

  it('produces an empty skeleton for a project with no recognized modules', () => {
    writePyproject(context.directory);

    expect(extractSkeleton(context.directory).nodes).toEqual([]);
  });

  it('does not extract Python modules without a pyproject.toml', () => {
    writeFileSync(nodePath.join(context.directory, 'thing.py'), '');

    expect(extractSkeleton(context.directory).nodes).toEqual([]);
  });
});

describe('extractSkeleton — maturin (pyproject + Cargo) dispatch (HWSEPV review)', () => {
  it('dispatches a native-extension project to the Python extractor, keeping .py modules', () => {
    // A maturin/pyo3 project ships BOTH a pyproject.toml and a Cargo.toml at root.
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[project]\nname = "mypkg"\n',
    );
    writeFileSync(nodePath.join(context.directory, 'Cargo.toml'), '[package]\nname = "mypkg-rs"\n');
    mkdirSync(nodePath.join(context.directory, 'src', 'mypkg'), { recursive: true });
    writeFileSync(nodePath.join(context.directory, 'src', 'lib.rs'), '');
    writeFileSync(nodePath.join(context.directory, 'src', 'db.py'), '');

    const skeleton = extractSkeleton(context.directory);

    // Python-primary: lists the Python package + module, not the Rust crate; src/db.py is NOT dropped.
    expect(skeleton.nodes.map(node => node.name)).toEqual(['db', 'mypkg']);
  });
});

describe('extractSkeleton — pyproject alongside Go/Rust must not regress them (HWSEPV review)', () => {
  // The pyproject branch is checked first (for maturin), but it must only WIN when it
  // actually yields Python modules. A Go service or a Rust crate that merely carries a
  // stray pyproject.toml (Python helper scripts, ruff/pre-commit config) has NO Python
  // modules, and the ticket promises Go/Rust output is byte-for-byte unchanged — so the
  // dispatch must fall through to the Go/Rust extractor instead of emptying the skeleton.

  it('keeps the Go layout when a non-Python pyproject.toml is also present', () => {
    writeFileSync(
      nodePath.join(context.directory, 'go.mod'),
      'module example.com/app\n\ngo 1.22\n',
    );
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[project]\nname = "tools"\n',
    );
    mkdirSync(nodePath.join(context.directory, 'cmd', 'server'), { recursive: true });
    mkdirSync(nodePath.join(context.directory, 'internal', 'store'), { recursive: true });

    const skeleton = extractSkeleton(context.directory);

    // No __init__.py dirs and no root *.py → Python yields nothing → Go layout stands.
    expect(skeleton.nodes.map(node => node.name)).toEqual(['cmd', 'internal']);
  });

  it('keeps Rust file modules when a non-Python pyproject.toml is also present', () => {
    writeFileSync(nodePath.join(context.directory, 'Cargo.toml'), '[package]\nname = "app"\n');
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[project]\nname = "tools"\n',
    );
    mkdirSync(nodePath.join(context.directory, 'src'), { recursive: true });
    writeFileSync(nodePath.join(context.directory, 'src', 'lib.rs'), '');
    writeFileSync(nodePath.join(context.directory, 'src', 'parser.rs'), '');

    const skeleton = extractSkeleton(context.directory);

    // src/ holds only .rs files → Python src-layout yields nothing → Rust modules stand.
    expect(skeleton.nodes.map(node => node.name)).toEqual(['parser']);
  });
});
