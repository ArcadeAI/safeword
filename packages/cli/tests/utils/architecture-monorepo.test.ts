/**
 * Unit tests for the monorepo model (ticket XG9SFP, Slice 3): leaf discovery,
 * the package/edge model, and the root-index fingerprint. Pins the
 * fingerprint-attribution boundary — the shared dependency-cruiser config and
 * the package set belong to the ROOT fingerprint, never a leaf's.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
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
