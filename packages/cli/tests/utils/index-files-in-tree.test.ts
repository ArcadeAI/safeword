import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { indexFilesInTree } from '../../src/utils/fs';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { force: true, recursive: true });
});

function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-index-'));
  temporaryDirectories.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const abs = nodePath.join(root, relativePath);
    mkdirSync(nodePath.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

describe('indexFilesInTree', () => {
  it('finds requested files at root and in sub-directories in one walk', () => {
    const root = makeRepo({ 'go.mod': '', 'services/api/Cargo.toml': '' });
    const index = indexFilesInTree(root, ['go.mod', 'Cargo.toml']);
    expect(index.get('go.mod')).toBe(root);
    expect(index.get('Cargo.toml')).toBe(nodePath.join(root, 'services/api'));
  });

  it('omits names that are not present', () => {
    const root = makeRepo({ 'go.mod': '' });
    const index = indexFilesInTree(root, ['go.mod', 'Cargo.toml']);
    expect(index.has('Cargo.toml')).toBe(false);
  });

  it('prefers the shallowest occurrence (root over nested)', () => {
    const root = makeRepo({ 'pyproject.toml': '', 'pkg/pyproject.toml': '' });
    expect(indexFilesInTree(root, ['pyproject.toml']).get('pyproject.toml')).toBe(root);
  });

  it('skips excluded directories like node_modules', () => {
    const root = makeRepo({ 'node_modules/dep/Cargo.toml': '' });
    expect(indexFilesInTree(root, ['Cargo.toml']).has('Cargo.toml')).toBe(false);
  });

  it('respects maxDepth', () => {
    const root = makeRepo({ 'a/b/c/go.mod': '' });
    expect(indexFilesInTree(root, ['go.mod'], 1).has('go.mod')).toBe(false);
    expect(indexFilesInTree(root, ['go.mod'], 3).get('go.mod')).toBe(nodePath.join(root, 'a/b/c'));
  });
});
