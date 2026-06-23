/**
 * Integration tests for the monorepo self-heal orchestration (ticket XG9SFP,
 * Slice 3): selfHealProject fans a single-repo project to one doc (byte-identical
 * to legacy selfHeal) and a monorepo to a root index + colocated per-leaf docs,
 * each healed independently. Temp-dir fixtures.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  planSelfHealProject,
  readDocumentFingerprint,
  selfHeal,
  selfHealProject,
} from '../../src/utils/architecture-document.js';
import { shapeFingerprint } from '../../src/utils/architecture-fingerprint.js';
import { resolveGeneratedArchitecturePath } from '../../src/utils/configured-paths.js';
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
): string {
  const dir = nodePath.join(root, 'packages', name);
  writeManifest(dir, { name, dependencies: options.dependencies ?? {} });
  const modules = options.modules ?? [];
  for (const moduleName of modules) {
    mkdirSync(nodePath.join(dir, 'src', moduleName), { recursive: true });
  }
  return dir;
}

function leafDocumentPath(root: string, name: string): string {
  return nodePath.join(root, 'packages', name, 'architecture.generated.md');
}

beforeEach(() => {
  context.directory = createTemporaryDirectory();
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('selfHealProject — single-repo path is unchanged', () => {
  it('writes exactly one doc at the single-repo location and no leaf docs', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
    writeManifest(context.directory, { name: 'solo' });

    const results = selfHealProject(context.directory);

    expect(results).toHaveLength(1);
    expect(results[0]?.action).toBe('created');
    expect(existsSync(resolveGeneratedArchitecturePath(context.directory))).toBe(true);
    expect(existsSync(leafDocumentPath(context.directory, 'anything'))).toBe(false);
  });

  it('produces a doc byte-identical to legacy selfHeal for the same tree', () => {
    const projectDirectory = createTemporaryDirectory();
    const legacyDirectory = createTemporaryDirectory();
    const roots = [projectDirectory, legacyDirectory];
    for (const root of roots) {
      mkdirSync(nodePath.join(root, 'src', 'auth'), { recursive: true });
      mkdirSync(nodePath.join(root, 'src', 'billing'), { recursive: true });
      writeManifest(root, { name: 'solo', dependencies: { lodash: '^4' } });
    }

    selfHealProject(projectDirectory);
    selfHeal(legacyDirectory);

    const viaProject = readFileSync(resolveGeneratedArchitecturePath(projectDirectory), 'utf8');
    const viaLegacy = readFileSync(resolveGeneratedArchitecturePath(legacyDirectory), 'utf8');
    expect(viaProject).toBe(viaLegacy);

    removeTemporaryDirectory(projectDirectory);
    removeTemporaryDirectory(legacyDirectory);
  });
});

describe('selfHealProject — monorepo root index + colocated leaves', () => {
  beforeEach(() => {
    writeManifest(context.directory, { name: 'root', workspaces: ['packages/*'] });
  });

  it('writes a root index listing packages with their dependency edges', () => {
    makePackage(context.directory, 'core', { modules: ['auth'] });
    makePackage(context.directory, 'web', { modules: ['ui'], dependencies: { core: '^1' } });

    selfHealProject(context.directory);

    const root = readFileSync(resolveGeneratedArchitecturePath(context.directory), 'utf8');
    expect(root).toContain('## Packages');
    expect(root).toContain('### core');
    expect(root).toContain('### web');
    expect(root).toContain('`web` → `core`');
  });

  it('writes a colocated leaf doc fingerprinted over each package with a src tree', () => {
    const coreDirectory = makePackage(context.directory, 'core', { modules: ['auth'] });

    selfHealProject(context.directory);

    const leaf = readFileSync(leafDocumentPath(context.directory, 'core'), 'utf8');
    expect(leaf).toContain('### auth');
    expect(readDocumentFingerprint(leaf)).toBe(shapeFingerprint(coreDirectory));
  });

  it('emits no leaf doc for a package with no src modules but lists it in the root', () => {
    makePackage(context.directory, 'core', { modules: ['auth'] });
    makePackage(context.directory, 'site'); // no modules

    const results = selfHealProject(context.directory);

    expect(existsSync(leafDocumentPath(context.directory, 'site'))).toBe(false);
    const siteResult = results.find(r => r.path === leafDocumentPath(context.directory, 'site'));
    expect(siteResult?.action).toBe('noop');
    expect(readFileSync(resolveGeneratedArchitecturePath(context.directory), 'utf8')).toContain(
      '### site',
    );
  });

  it('re-syncs only the changed leaf, leaving other leaves untouched', () => {
    makePackage(context.directory, 'core', { modules: ['auth'] });
    makePackage(context.directory, 'web', { modules: ['ui'] });
    selfHealProject(context.directory);
    const webBefore = readFileSync(leafDocumentPath(context.directory, 'web'), 'utf8');

    // Structural change inside core only.
    mkdirSync(nodePath.join(context.directory, 'packages', 'core', 'src', 'billing'), {
      recursive: true,
    });
    const results = selfHealProject(context.directory);

    const coreResult = results.find(r => r.path === leafDocumentPath(context.directory, 'core'));
    const webResult = results.find(r => r.path === leafDocumentPath(context.directory, 'web'));
    expect(coreResult?.action).toBe('healed');
    expect(webResult?.action).toBe('unchanged');
    expect(readFileSync(leafDocumentPath(context.directory, 'web'), 'utf8')).toBe(webBefore);
  });

  it('re-syncs the root but not a leaf when a new package is added', () => {
    makePackage(context.directory, 'core', { modules: ['auth'] });
    selfHealProject(context.directory);
    const coreBefore = readFileSync(leafDocumentPath(context.directory, 'core'), 'utf8');

    makePackage(context.directory, 'web', { modules: ['ui'] });
    const results = selfHealProject(context.directory);

    const rootResult = results.find(
      r => r.path === resolveGeneratedArchitecturePath(context.directory),
    );
    const coreResult = results.find(r => r.path === leafDocumentPath(context.directory, 'core'));
    expect(rootResult?.action).toBe('healed');
    expect(coreResult?.action).toBe('unchanged');
    expect(readFileSync(leafDocumentPath(context.directory, 'core'), 'utf8')).toBe(coreBefore);
  });

  it('planSelfHealProject reports would-change for a stale leaf without writing', () => {
    makePackage(context.directory, 'core', { modules: ['auth'] });
    selfHealProject(context.directory);
    mkdirSync(nodePath.join(context.directory, 'packages', 'core', 'src', 'billing'), {
      recursive: true,
    });

    const actions = planSelfHealProject(context.directory);

    expect(actions).toContain('healed');
  });
});
