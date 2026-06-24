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

  it('lets package.json workspaces win over go.work when both are present', () => {
    // Root manifest (from beforeEach) declares workspaces: ['packages/*'].
    writeGoWork(context.directory, 'go 1.22\n\nuse ./svc\n');
    makeGoPackage(context.directory, 'svc', { layout: true });
    makePackage(context.directory, 'web', { modules: ['ui'] });

    const leaves = discoverLeafDirectories(context.directory);

    expect(leaves).toEqual([nodePath.join(context.directory, 'packages', 'web')]);
    expect(leaves).not.toContain(nodePath.join(context.directory, 'svc'));
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
