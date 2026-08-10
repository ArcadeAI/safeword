import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  generatedTreeDifferences,
  reconcileGeneratedTree,
} from '../scripts/generated-tree-differences.js';

function tree(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-generated-tree-'));
  for (const [relative, content] of Object.entries(files)) {
    const path = nodePath.join(root, relative);
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  }
  return root;
}

describe('generated tree freshness', () => {
  it('reports missing, changed, and obsolete shipped files in stable order', () => {
    const generated = tree({ 'changed.js': 'new', 'missing.js': 'expected' });
    const shipped = tree({ 'changed.js': 'old', 'obsolete.js': 'stale' });

    expect(generatedTreeDifferences(generated, shipped)).toEqual([
      'changed changed.js',
      'missing missing.js',
      'unexpected obsolete.js',
    ]);
  });

  it('allows only explicitly named authored shipped files', () => {
    const generated = tree({ 'runtime/cli.js': 'bundle' });
    const shipped = tree({ 'runtime/cli.js': 'bundle', 'README.md': 'authored' });

    expect(generatedTreeDifferences(generated, shipped, ['README.md'])).toEqual([]);
  });

  it('makes generation remediate stale files while preserving authored files', () => {
    const generated = tree({ 'runtime/cli.js': 'new', 'hooks/current.ts': 'current' });
    const shipped = tree({
      'runtime/cli.js': 'old',
      'hooks/obsolete.ts': 'obsolete',
      'README.md': 'authored',
    });

    reconcileGeneratedTree(generated, shipped, ['README.md']);

    expect(generatedTreeDifferences(generated, shipped, ['README.md'])).toEqual([]);
    expect(readFileSync(nodePath.join(shipped, 'runtime/cli.js'), 'utf8')).toBe('new');
    expect(existsSync(nodePath.join(shipped, 'hooks/obsolete.ts'))).toBe(false);
    expect(readFileSync(nodePath.join(shipped, 'README.md'), 'utf8')).toBe('authored');
  });

  it('refuses to reconcile through a shipped symbolic link', () => {
    const generated = tree({ 'runtime/cli.js': 'new' });
    const shipped = tree({});
    const outside = tree({ 'cli.js': 'outside' });
    symlinkSync(outside, nodePath.join(shipped, 'runtime'));

    expect(() => {
      reconcileGeneratedTree(generated, shipped);
    }).toThrow('Refusing to reconcile generated files through symbolic link: runtime');
    expect(readFileSync(nodePath.join(outside, 'cli.js'), 'utf8')).toBe('outside');
  });

  it('refuses to inspect or copy a generated symbolic link', () => {
    const generated = tree({});
    const shipped = tree({});
    const outside = tree({ 'secret.js': 'outside' });
    symlinkSync(nodePath.join(outside, 'secret.js'), nodePath.join(generated, 'runtime.js'));

    expect(() => generatedTreeDifferences(generated, shipped)).toThrow(
      'Refusing to reconcile generated files through symbolic link: runtime.js',
    );
    expect(() => {
      reconcileGeneratedTree(generated, shipped);
    }).toThrow('Refusing to reconcile generated files through symbolic link: runtime.js');
    expect(existsSync(nodePath.join(shipped, 'runtime.js'))).toBe(false);
  });

  it('replaces an obsolete shipped directory with a generated file', () => {
    const generated = tree({ runtime: 'new file' });
    const shipped = tree({ 'runtime/obsolete.js': 'obsolete' });

    reconcileGeneratedTree(generated, shipped);

    expect(readFileSync(nodePath.join(shipped, 'runtime'), 'utf8')).toBe('new file');
    expect(generatedTreeDifferences(generated, shipped)).toEqual([]);
  });
});
