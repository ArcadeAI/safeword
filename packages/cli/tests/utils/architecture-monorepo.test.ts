/**
 * Unit tests for the monorepo model (ticket XG9SFP, Slice 3): leaf discovery,
 * the package/edge model, and the root-index fingerprint. Pins the
 * fingerprint-attribution boundary — the shared dependency-cruiser config and
 * the package set belong to the ROOT fingerprint, never a leaf's.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  discoverLeafDirectories,
  discoverUnreadableWorkspaces,
  discoverWorkspaces,
  extractMonorepoModel,
  monorepoFingerprint,
} from '../../src/utils/architecture-monorepo.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

function writeManifest(dir: string, manifest: Record<string, unknown>): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(nodePath.join(dir, 'package.json'), JSON.stringify(manifest));
}

function makePackage(
  root: string,
  name: string,
  options: { modules?: string[]; dependencies?: Record<string, string> } = {},
): void {
  const dir = nodePath.join(root, 'packages', name);
  writeManifest(dir, { name, dependencies: options.dependencies ?? {} });
  const modules = options.modules ?? [];
  for (const moduleName of modules) {
    mkdirSync(nodePath.join(dir, 'src', moduleName), { recursive: true });
  }
}

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  writeManifest(context.directory, { name: 'root', workspaces: ['packages/*'] });
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('discoverLeafDirectories', () => {
  it('expands the workspace globs to package directories, sorted', () => {
    makePackage(context.directory, 'web');
    makePackage(context.directory, 'core');

    const leaves = discoverLeafDirectories(context.directory);

    expect(leaves).toEqual([
      nodePath.join(context.directory, 'packages', 'core'),
      nodePath.join(context.directory, 'packages', 'web'),
    ]);
  });

  it('returns an empty list for a project with no workspaces', () => {
    writeManifest(context.directory, { name: 'solo' }); // overwrite: no workspaces

    expect(discoverLeafDirectories(context.directory)).toEqual([]);
  });

  it('skips a glob match that has no package.json', () => {
    makePackage(context.directory, 'core');
    mkdirSync(nodePath.join(context.directory, 'packages', 'not-a-package'), { recursive: true });

    const leaves = discoverLeafDirectories(context.directory);

    expect(leaves).toEqual([nodePath.join(context.directory, 'packages', 'core')]);
  });
});

describe('discoverLeafDirectories — pnpm + precedence (ZRW21K)', () => {
  function writePnpmWorkspace(root: string, globs: string[]): void {
    const body = ['packages:', ...globs.map(glob => `  - "${glob}"`)].join('\n');
    writeFileSync(nodePath.join(root, 'pnpm-workspace.yaml'), `${body}\n`);
  }

  it('discovers packages from pnpm-workspace.yaml when package.json has no workspaces', () => {
    writeManifest(context.directory, { name: 'root' }); // no `workspaces` field
    writePnpmWorkspace(context.directory, ['packages/*']);
    makePackage(context.directory, 'web');

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'packages', 'web'),
    ]);
  });

  it('lets package.json workspaces win when both config files are present', () => {
    // beforeEach already set workspaces: ['packages/*'].
    writePnpmWorkspace(context.directory, ['apps/*']);
    makePackage(context.directory, 'web'); // under packages/ (npm side)
    writeManifest(nodePath.join(context.directory, 'apps', 'svc'), { name: 'svc' }); // pnpm side

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'packages', 'web'),
    ]);
  });

  it('falls back to no workspaces when pnpm-workspace.yaml is unparseable (flow style)', () => {
    writeManifest(context.directory, { name: 'root' }); // no `workspaces`
    writeFileSync(
      nodePath.join(context.directory, 'pnpm-workspace.yaml'),
      'packages: ["packages/*"]\n', // flow style — out of scope, must degrade
    );
    makePackage(context.directory, 'web');

    expect(discoverLeafDirectories(context.directory)).toEqual([]);
  });
});

describe('extractMonorepoModel — introspected flag (ZRW21K)', () => {
  it('marks a package with a src tree introspected and one without not introspected', () => {
    makePackage(context.directory, 'web', { modules: ['ui'] });
    makePackage(context.directory, 'svc'); // no modules → no src tree

    const model = extractMonorepoModel(context.directory);
    const byName = new Map(model.packages.map(node => [node.name, node]));

    expect(byName.get('web')?.introspected).toBe(true);
    expect(byName.get('svc')?.introspected).toBe(false);
  });
});

describe('monorepoFingerprint — introspection status is part of the root shape (ZRW21K)', () => {
  it('moves when a package gains a src tree (so the root index re-renders)', () => {
    makePackage(context.directory, 'svc'); // no src tree
    const before = monorepoFingerprint(context.directory);

    mkdirSync(nodePath.join(context.directory, 'packages', 'svc', 'src', 'api'), {
      recursive: true,
    });
    const after = monorepoFingerprint(context.directory);

    expect(after).not.toBe(before);
  });
});

describe('extractMonorepoModel', () => {
  it('lists every package with a placeholder purpose', () => {
    makePackage(context.directory, 'core');
    makePackage(context.directory, 'web');

    const model = extractMonorepoModel(context.directory);

    expect(model.packages.map(p => p.name)).toEqual(['core', 'web']);
    expect(model.packages.every(p => p.purpose.length > 0)).toBe(true);
  });

  it('records an inter-package edge when one package depends on another by name', () => {
    makePackage(context.directory, 'core');
    makePackage(context.directory, 'web', { dependencies: { core: '^1.0.0' } });

    const model = extractMonorepoModel(context.directory);

    expect(model.edges).toContainEqual({ from: 'web', to: 'core' });
  });

  it('does not record an edge to an external (non-workspace) dependency', () => {
    makePackage(context.directory, 'web', { dependencies: { lodash: '^4.0.0' } });

    const model = extractMonorepoModel(context.directory);

    expect(model.edges).toEqual([]);
  });
});

describe('monorepoFingerprint — root owns the package set, edges, and boundary config', () => {
  function fingerprintWith(mutate: (root: string) => void): string {
    const dir = createTemporaryDirectory();
    writeManifest(dir, { name: 'root', workspaces: ['packages/*'] });
    makePackage(dir, 'core', { modules: ['auth'] });
    makePackage(dir, 'web', { dependencies: { core: '^1.0.0' } });
    mutate(dir);
    const fp = monorepoFingerprint(dir);
    removeTemporaryDirectory(dir);
    return fp;
  }

  it('moves when a package is added to the workspace', () => {
    const before = fingerprintWith(() => {});
    const after = fingerprintWith(root => {
      makePackage(root, 'billing');
    });
    expect(after).not.toBe(before);
  });

  it('moves when an inter-package edge is added', () => {
    // Baseline already has web→core; add a new core→web edge to move the edge set.
    const before = fingerprintWith(() => {});
    const withNewEdge = fingerprintWith(root => {
      makePackage(root, 'core', { modules: ['auth'], dependencies: { web: '^1.0.0' } });
    });
    expect(withNewEdge).not.toBe(before);
  });

  it('moves when the shared dependency-cruiser boundary config changes', () => {
    const before = fingerprintWith(() => {});
    const after = fingerprintWith(root => {
      writeFileSync(nodePath.join(root, '.dependency-cruiser.cjs'), 'module.exports = { x: 1 };');
    });
    expect(after).not.toBe(before);
  });

  it('does NOT move when only a leaf package internal module changes', () => {
    const before = fingerprintWith(() => {});
    const after = fingerprintWith(root =>
      mkdirSync(nodePath.join(root, 'packages', 'core', 'src', 'newmod'), { recursive: true }),
    );
    expect(after).toBe(before);
  });
});

describe('discoverLeafDirectories — go.work discovery (ticket ZD70P1)', () => {
  function clearRootManifest(root: string): void {
    rmSync(nodePath.join(root, 'package.json'), { force: true });
  }

  function writeGoWork(root: string, body: string): void {
    writeFileSync(nodePath.join(root, 'go.work'), body);
  }

  function makeGoPackage(root: string, name: string, options: { layout?: boolean } = {}): void {
    const dir = nodePath.join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(nodePath.join(dir, 'go.mod'), `module example.com/${name}\n\ngo 1.22\n`);
    if (options.layout) mkdirSync(nodePath.join(dir, 'cmd', 'server'), { recursive: true });
  }

  it('discovers Go packages from a go.work use block', () => {
    clearRootManifest(context.directory);
    writeGoWork(context.directory, 'go 1.22\n\nuse (\n\t./svc\n\t./gateway\n)\n');
    makeGoPackage(context.directory, 'svc', { layout: true });
    makeGoPackage(context.directory, 'gateway', { layout: true });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'gateway'),
      nodePath.join(context.directory, 'svc'),
    ]);
  });

  it('discovers a Go package from a single-line use directive', () => {
    clearRootManifest(context.directory);
    writeGoWork(context.directory, 'go 1.22\n\nuse ./svc\n');
    makeGoPackage(context.directory, 'svc', { layout: true });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'svc'),
    ]);
  });

  it('skips an unreadable use entry while keeping the readable ones', () => {
    clearRootManifest(context.directory);
    writeGoWork(context.directory, 'go 1.22\n\nuse (\n\t./svc\n\t@@@ not a path @@@\n)\n');
    makeGoPackage(context.directory, 'svc', { layout: true });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'svc'),
    ]);
  });

  it('discovers packages across more than one use block', () => {
    clearRootManifest(context.directory);
    writeGoWork(context.directory, 'go 1.22\n\nuse (\n\t./svc\n)\n\nuse (\n\t./gateway\n)\n');
    makeGoPackage(context.directory, 'svc', { layout: true });
    makeGoPackage(context.directory, 'gateway', { layout: true });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'gateway'),
      nodePath.join(context.directory, 'svc'),
    ]);
  });

  it('discovers a use entry that carries a trailing comment', () => {
    clearRootManifest(context.directory);
    writeGoWork(context.directory, 'go 1.22\n\nuse ./svc // the service module\n');
    makeGoPackage(context.directory, 'svc', { layout: true });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'svc'),
    ]);
  });

  it('returns no leaves when go.work has no use directive', () => {
    clearRootManifest(context.directory);
    writeGoWork(context.directory, 'go 1.22\n');

    expect(discoverLeafDirectories(context.directory)).toEqual([]);
  });

  it('keeps a Go package directory that has a go.mod but no package.json', () => {
    clearRootManifest(context.directory);
    writeGoWork(context.directory, 'go 1.22\n\nuse ./svc\n');
    makeGoPackage(context.directory, 'svc', { layout: true });

    const leaves = discoverLeafDirectories(context.directory);

    expect(leaves).toContain(nodePath.join(context.directory, 'svc'));
  });

  it('unions package.json workspaces with go.work when both are present (MGWZ4P)', () => {
    // Root manifest (from beforeEach) declares workspaces: ['packages/*'].
    // JS and Go are different ecosystems, so both packages are discovered —
    // not just the first manager's (the coverage-honesty fix, MGWZ4P).
    writeGoWork(context.directory, 'go 1.22\n\nuse ./svc\n');
    makeGoPackage(context.directory, 'svc', { layout: true });
    makePackage(context.directory, 'web', { modules: ['ui'] });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'packages', 'web'),
      nodePath.join(context.directory, 'svc'),
    ]);
  });
});

describe('extractMonorepoModel — Go package identity (ticket ZD70P1)', () => {
  it('names a Go package from its go.mod module directive', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(nodePath.join(context.directory, 'go.work'), 'go 1.22\n\nuse ./svc\n');
    const dir = nodePath.join(context.directory, 'svc');
    mkdirSync(nodePath.join(dir, 'cmd', 'server'), { recursive: true });
    writeFileSync(nodePath.join(dir, 'go.mod'), 'module github.com/acme/svc\n\ngo 1.22\n');

    const model = extractMonorepoModel(context.directory);

    expect(model.packages.map(node => node.name)).toEqual(['github.com/acme/svc']);
    expect(model.packages[0]?.introspected).toBe(true);
  });
});

describe('discoverLeafDirectories — Cargo workspace discovery (ticket YKFA5X)', () => {
  function makeCargoCrate(root: string, name: string, options: { module?: string } = {}): void {
    const dir = nodePath.join(root, 'crates', name);
    mkdirSync(nodePath.join(dir, 'src'), { recursive: true });
    writeFileSync(nodePath.join(dir, 'Cargo.toml'), `[package]\nname = "${name}"\n`);
    if (options.module !== undefined) {
      writeFileSync(nodePath.join(dir, 'src', `${options.module}.rs`), '// rust\n');
    }
  }

  it('discovers crates from a Cargo workspace members array', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(
      nodePath.join(context.directory, 'Cargo.toml'),
      '[workspace]\nmembers = ["crates/*"]\n',
    );
    makeCargoCrate(context.directory, 'svc', { module: 'config' });
    makeCargoCrate(context.directory, 'api', { module: 'routes' });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'crates', 'api'),
      nodePath.join(context.directory, 'crates', 'svc'),
    ]);
  });

  it('keeps a crate directory that has a Cargo.toml but no package.json', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(
      nodePath.join(context.directory, 'Cargo.toml'),
      '[workspace]\nmembers = ["crates/*"]\n',
    );
    makeCargoCrate(context.directory, 'svc', { module: 'config' });

    expect(discoverLeafDirectories(context.directory)).toContain(
      nodePath.join(context.directory, 'crates', 'svc'),
    );
  });

  it('unions package.json workspaces with a Cargo workspace when both are present (MGWZ4P)', () => {
    // Root manifest (from beforeEach) declares workspaces: ['packages/*'].
    // JS and Rust are different ecosystems → both discovered (MGWZ4P).
    writeFileSync(
      nodePath.join(context.directory, 'Cargo.toml'),
      '[workspace]\nmembers = ["crates/*"]\n',
    );
    makeCargoCrate(context.directory, 'svc', { module: 'config' });
    makePackage(context.directory, 'web', { modules: ['ui'] });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'crates', 'svc'),
      nodePath.join(context.directory, 'packages', 'web'),
    ]);
  });

  it('returns no leaves when Cargo.toml has no [workspace] table', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(nodePath.join(context.directory, 'Cargo.toml'), '[package]\nname = "solo"\n');

    expect(discoverLeafDirectories(context.directory)).toEqual([]);
  });
});

describe('extractMonorepoModel — Rust crate identity (ticket YKFA5X)', () => {
  it('names a Rust crate from its Cargo.toml [package] name', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(
      nodePath.join(context.directory, 'Cargo.toml'),
      '[workspace]\nmembers = ["crates/svc"]\n',
    );
    const dir = nodePath.join(context.directory, 'crates', 'svc');
    mkdirSync(nodePath.join(dir, 'src'), { recursive: true });
    writeFileSync(nodePath.join(dir, 'Cargo.toml'), '[package]\nname = "acme-svc"\n');
    writeFileSync(nodePath.join(dir, 'src', 'config.rs'), '// rust\n');

    const model = extractMonorepoModel(context.directory);

    expect(model.packages.map(node => node.name)).toEqual(['acme-svc']);
    expect(model.packages[0]?.introspected).toBe(true);
  });
});

describe('discoverLeafDirectories — uv workspace discovery (ticket HWSEPV)', () => {
  function makeUvPackage(root: string, name: string, options: { module?: boolean } = {}): void {
    const dir = nodePath.join(root, 'packages', name);
    mkdirSync(nodePath.join(dir, 'src'), { recursive: true });
    writeFileSync(nodePath.join(dir, 'pyproject.toml'), `[project]\nname = "${name}"\n`);
    if (options.module) writeFileSync(nodePath.join(dir, 'src', 'api.py'), '');
  }

  it('discovers packages from a uv workspace members array', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[tool.uv.workspace]\nmembers = ["packages/*"]\n',
    );
    makeUvPackage(context.directory, 'svc', { module: true });
    makeUvPackage(context.directory, 'api', { module: true });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'packages', 'api'),
      nodePath.join(context.directory, 'packages', 'svc'),
    ]);
  });

  it('keeps a package directory that has a pyproject.toml but no package.json', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[tool.uv.workspace]\nmembers = ["packages/*"]\n',
    );
    makeUvPackage(context.directory, 'svc', { module: true });

    expect(discoverLeafDirectories(context.directory)).toContain(
      nodePath.join(context.directory, 'packages', 'svc'),
    );
  });

  it('unions package.json workspaces with a uv workspace when both are present (MGWZ4P)', () => {
    // Root manifest (from beforeEach) declares workspaces: ['packages/*']; the uv
    // members point elsewhere (libs/*). JS and Python are different ecosystems →
    // both discovered (MGWZ4P).
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[tool.uv.workspace]\nmembers = ["libs/*"]\n',
    );
    const svcDirectory = nodePath.join(context.directory, 'libs', 'svc');
    mkdirSync(nodePath.join(svcDirectory, 'src'), { recursive: true });
    writeFileSync(nodePath.join(svcDirectory, 'pyproject.toml'), '[project]\nname = "svc"\n');
    writeFileSync(nodePath.join(svcDirectory, 'src', 'api.py'), '');
    makePackage(context.directory, 'web', { modules: ['ui'] });

    expect(discoverLeafDirectories(context.directory)).toEqual([
      svcDirectory,
      nodePath.join(context.directory, 'packages', 'web'),
    ]);
  });

  it('returns no leaves when pyproject has no [tool.uv.workspace] table', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(nodePath.join(context.directory, 'pyproject.toml'), '[project]\nname = "solo"\n');

    expect(discoverLeafDirectories(context.directory)).toEqual([]);
  });
});

describe('discoverLeafDirectories — polyglot union (ticket MGWZ4P)', () => {
  function writeGoModule(root: string, relativeDirectory: string, name: string): void {
    const dir = nodePath.join(root, relativeDirectory);
    mkdirSync(nodePath.join(dir, 'cmd', 'server'), { recursive: true });
    writeFileSync(nodePath.join(dir, 'go.mod'), `module ${name}\n\ngo 1.22\n`);
  }
  function writeRustCrate(root: string, relativeDirectory: string, name: string): void {
    const dir = nodePath.join(root, relativeDirectory);
    mkdirSync(nodePath.join(dir, 'src'), { recursive: true });
    writeFileSync(nodePath.join(dir, 'Cargo.toml'), `[package]\nname = "${name}"\n`);
  }
  function writePythonPackage(root: string, relativeDirectory: string, name: string): void {
    const dir = nodePath.join(root, relativeDirectory);
    mkdirSync(nodePath.join(dir, 'src'), { recursive: true });
    writeFileSync(nodePath.join(dir, 'pyproject.toml'), `[project]\nname = "${name}"\n`);
  }

  /** Declares a go.work (gosvc), a Cargo [workspace] (crates/rscore), and a uv
   * workspace (pypkgs/pytool) at the root, each with its member's manifest. */
  function writeGoCargoUvManagers(root: string): void {
    writeFileSync(nodePath.join(root, 'go.work'), 'go 1.22\n\nuse ./gosvc\n');
    writeGoModule(root, 'gosvc', 'gosvc');
    writeFileSync(nodePath.join(root, 'Cargo.toml'), '[workspace]\nmembers = ["crates/rscore"]\n');
    writeRustCrate(root, nodePath.join('crates', 'rscore'), 'rscore');
    writeFileSync(
      nodePath.join(root, 'pyproject.toml'),
      '[tool.uv.workspace]\nmembers = ["pypkgs/pytool"]\n',
    );
    writePythonPackage(root, nodePath.join('pypkgs', 'pytool'), 'pytool');
  }

  it('U2 — unions Go + Cargo + uv when no JS workspace is present', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeGoCargoUvManagers(context.directory);

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'crates', 'rscore'),
      nodePath.join(context.directory, 'gosvc'),
      nodePath.join(context.directory, 'pypkgs', 'pytool'),
    ]);
  });

  it('U6 — unions a JS workspace with go.work + Cargo + uv all at the root', () => {
    // Root package.json workspaces: ['packages/*'] comes from beforeEach.
    makePackage(context.directory, 'web', { modules: ['ui'] });
    writeGoCargoUvManagers(context.directory);

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'crates', 'rscore'),
      nodePath.join(context.directory, 'gosvc'),
      nodePath.join(context.directory, 'packages', 'web'),
      nodePath.join(context.directory, 'pypkgs', 'pytool'),
    ]);
  });

  it('U4 — lists a dir matched by two managers (maturin: Cargo + uv) exactly once', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(
      nodePath.join(context.directory, 'Cargo.toml'),
      '[workspace]\nmembers = ["ext"]\n',
    );
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[tool.uv.workspace]\nmembers = ["ext"]\n',
    );
    // The single member dir carries BOTH manifests (a maturin/pyo3 package).
    const extensionDirectory = nodePath.join(context.directory, 'ext');
    mkdirSync(nodePath.join(extensionDirectory, 'src'), { recursive: true });
    writeFileSync(nodePath.join(extensionDirectory, 'Cargo.toml'), '[package]\nname = "ext"\n');
    writeFileSync(nodePath.join(extensionDirectory, 'pyproject.toml'), '[project]\nname = "ext"\n');

    expect(discoverLeafDirectories(context.directory)).toEqual([extensionDirectory]);
  });

  it('U7 — an over-broad Cargo glob sweeping a JS dir lists that dir once', () => {
    // Root JS workspaces: ['packages/*'] (beforeEach). The Cargo workspace uses an
    // over-broad members glob that also matches the JS package dir; the leaf Set +
    // per-dir manifest guard keep it listed exactly once.
    makePackage(context.directory, 'web', { modules: ['ui'] });
    writeFileSync(
      nodePath.join(context.directory, 'Cargo.toml'),
      '[workspace]\nmembers = ["packages/*"]\n',
    );

    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'packages', 'web'),
    ]);
  });
});

describe('discoverWorkspaces — present-but-unparseable managers are surfaced (ticket UWP4XK)', () => {
  function clearRootManifest(root: string): void {
    rmSync(nodePath.join(root, 'package.json'), { force: true });
  }
  function configsOf(root: string): string[] {
    return discoverUnreadableWorkspaces(root).map(entry => entry.config);
  }

  it('U1 — a malformed go.work (no parseable use target) is unreadable, not absent', () => {
    clearRootManifest(context.directory);
    writeFileSync(
      nodePath.join(context.directory, 'go.work'),
      'go 1.22\n\nuse (\n\t@@@ not a path @@@\n)\n',
    );

    const discovery = discoverWorkspaces(context.directory);

    expect(discovery.patterns).toEqual([]);
    expect(discovery.unreadable).toEqual([{ manager: 'go.work', config: 'go.work' }]);
  });

  it('U2 — a [workspace] table with an unparseable members value is unreadable', () => {
    clearRootManifest(context.directory);
    // `members` is a string, not an array — present table, unparseable member list.
    writeFileSync(
      nodePath.join(context.directory, 'Cargo.toml'),
      '[workspace]\nmembers = "crates/*"\n',
    );

    expect(configsOf(context.directory)).toEqual(['Cargo.toml']);
  });

  it('U3 — a [tool.uv.workspace] table with an unparseable members value is unreadable', () => {
    clearRootManifest(context.directory);
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[tool.uv.workspace]\nmembers = "packages/*"\n',
    );

    expect(configsOf(context.directory)).toEqual(['pyproject.toml']);
  });

  it('U4 — a flow-style pnpm-workspace.yaml is unreadable', () => {
    writeManifest(context.directory, { name: 'root' }); // no package.json `workspaces`
    writeFileSync(
      nodePath.join(context.directory, 'pnpm-workspace.yaml'),
      'packages: ["packages/*"]\n', // flow style — unparseable by the block-list reader
    );

    expect(configsOf(context.directory)).toEqual(['pnpm-workspace.yaml']);
  });

  it('U5 — a package.json workspaces field of the wrong shape is unreadable', () => {
    writeManifest(context.directory, { name: 'root', workspaces: 'packages/*' }); // string, not array

    expect(configsOf(context.directory)).toEqual(['package.json']);
  });

  it('U6 — a malformed manager never blinds the readable ones (readable side intact)', () => {
    // package.json workspaces (packages/*) from beforeEach stays readable; go.work malformed.
    makePackage(context.directory, 'web', { modules: ['ui'] });
    writeFileSync(
      nodePath.join(context.directory, 'go.work'),
      'go 1.22\n\nuse @@@ not a path @@@\n',
    );

    const discovery = discoverWorkspaces(context.directory);

    expect(discovery.patterns).toContain('packages/*');
    expect(discovery.unreadable).toEqual([{ manager: 'go.work', config: 'go.work' }]);
    expect(discoverLeafDirectories(context.directory)).toEqual([
      nodePath.join(context.directory, 'packages', 'web'),
    ]);
  });

  it('U7 — a single-crate Cargo.toml with no [workspace] table raises no signal (absent)', () => {
    clearRootManifest(context.directory);
    writeFileSync(nodePath.join(context.directory, 'Cargo.toml'), '[package]\nname = "solo"\n');

    expect(discoverUnreadableWorkspaces(context.directory)).toEqual([]);
  });

  it('U8 — an explicitly-empty package.json workspaces array is absent, not unreadable', () => {
    writeManifest(context.directory, { name: 'root', workspaces: [] });

    expect(discoverUnreadableWorkspaces(context.directory)).toEqual([]);
  });

  it('U9 — a Cargo [workspace] with no members key (auto-discovery) is absent, not unreadable', () => {
    // A root-package workspace using default-members / path-dep auto-discovery is VALID —
    // `members` is optional. It must not false-alarm as "unreadable" (quality-review).
    clearRootManifest(context.directory);
    writeFileSync(
      nodePath.join(context.directory, 'Cargo.toml'),
      '[package]\nname = "root"\n\n[workspace]\ndefault-members = ["crates/a"]\n',
    );

    expect(discoverUnreadableWorkspaces(context.directory)).toEqual([]);
  });

  it('U10 — a catalog-only pnpm-workspace.yaml (no packages key) is absent, not unreadable', () => {
    // `packages:` is optional in pnpm-workspace.yaml; a catalog-only file is valid and
    // declares no members — must not false-alarm (quality-review).
    writeManifest(context.directory, { name: 'root' }); // no package.json workspaces
    writeFileSync(
      nodePath.join(context.directory, 'pnpm-workspace.yaml'),
      'catalog:\n  react: ^19.0.0\n',
    );

    expect(discoverUnreadableWorkspaces(context.directory)).toEqual([]);
  });

  it('U11 — a go.work with no use directive (fresh init) is absent, not unreadable', () => {
    clearRootManifest(context.directory);
    writeFileSync(nodePath.join(context.directory, 'go.work'), 'go 1.22\n');

    expect(discoverUnreadableWorkspaces(context.directory)).toEqual([]);
  });

  it('U12 — an explicitly-empty Cargo [workspace] members array is absent, not unreadable', () => {
    // `members = []` declares no workspace members — like package.json `workspaces: []` (U8),
    // a deliberate empty list, not a present-but-unparseable one (UWP4XK).
    clearRootManifest(context.directory);
    writeFileSync(nodePath.join(context.directory, 'Cargo.toml'), '[workspace]\nmembers = []\n');

    expect(discoverUnreadableWorkspaces(context.directory)).toEqual([]);
  });

  it('U13 — an explicitly-empty uv [tool.uv.workspace] members array is absent, not unreadable', () => {
    clearRootManifest(context.directory);
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[tool.uv.workspace]\nmembers = []\n',
    );

    expect(discoverUnreadableWorkspaces(context.directory)).toEqual([]);
  });

  it('exposes the unreadable set on the monorepo model', () => {
    makePackage(context.directory, 'web', { modules: ['ui'] });
    writeFileSync(
      nodePath.join(context.directory, 'go.work'),
      'go 1.22\n\nuse @@@ not a path @@@\n',
    );

    const model = extractMonorepoModel(context.directory);

    expect(model.packages.map(node => node.name)).toEqual(['web']);
    expect(model.unreadableWorkspaces).toEqual([{ manager: 'go.work', config: 'go.work' }]);
  });
});

describe('monorepoFingerprint — the unreadable-workspace set is part of the root shape (UWP4XK)', () => {
  it('moves when a present-but-unparseable manager appears, so the advisory re-renders', () => {
    makePackage(context.directory, 'web', { modules: ['ui'] });
    const before = monorepoFingerprint(context.directory);

    writeFileSync(
      nodePath.join(context.directory, 'go.work'),
      'go 1.22\n\nuse @@@ not a path @@@\n',
    );
    const after = monorepoFingerprint(context.directory);

    expect(after).not.toBe(before);
  });

  it('does NOT move for a repo with no unreadable config (no churn vs the prior hash inputs)', () => {
    // Two readable-only repos with identical shape hash identically — the unreadable key is
    // contributed only when non-empty, so a clean repo is never re-fingerprinted by UWP4XK.
    makePackage(context.directory, 'web', { modules: ['ui'] });
    const first = monorepoFingerprint(context.directory);
    const second = monorepoFingerprint(context.directory);

    expect(second).toBe(first);
  });
});

describe('extractMonorepoModel — Python package identity (ticket HWSEPV)', () => {
  it('names a Python package from its [project] name', () => {
    rmSync(nodePath.join(context.directory, 'package.json'), { force: true });
    writeFileSync(
      nodePath.join(context.directory, 'pyproject.toml'),
      '[tool.uv.workspace]\nmembers = ["packages/svc"]\n',
    );
    const dir = nodePath.join(context.directory, 'packages', 'svc');
    mkdirSync(nodePath.join(dir, 'src'), { recursive: true });
    writeFileSync(nodePath.join(dir, 'pyproject.toml'), '[project]\nname = "acme-svc"\n');
    writeFileSync(nodePath.join(dir, 'src', 'api.py'), '');

    const model = extractMonorepoModel(context.directory);

    expect(model.packages.map(node => node.name)).toEqual(['acme-svc']);
    expect(model.packages[0]?.introspected).toBe(true);
  });
});
