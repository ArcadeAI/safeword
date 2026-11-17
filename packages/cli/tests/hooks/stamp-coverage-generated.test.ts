/**
 * The implement-phase stamp's required coverage set (issue #5870).
 *
 * A change that regenerates mirrored files can exceed the review packet's file
 * limit, so the stamp must not demand review of files the base branch already
 * marks as generated or vendored. The marking is read from the merge base, so a
 * branch cannot exempt its own hand-written files.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reviewClaimContext } from '../../templates/hooks/lib/verify-stamp-claims.js';

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
}

function write(root: string, relative: string, content: string): void {
  const path = nodePath.join(root, relative);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, content);
}

describe('implement-phase coverage set', () => {
  let root: string;

  const implementationFiles = (): readonly string[] | undefined =>
    reviewClaimContext(root, nodePath.join(root, '.project/tickets/T1')).implementationFiles;

  beforeEach(() => {
    root = mkdtempSync(nodePath.join(tmpdir(), 'stamp-coverage-'));
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test');
    git(root, 'config', 'commit.gpgsign', 'false');
    write(
      root,
      '.gitattributes',
      'mirror/** linguist-generated=true\nvendor/** linguist-vendored=true\nmirror/README.md -linguist-generated\n',
    );
    write(root, 'src/feature.ts', 'export const a = 1;\n');
    write(root, 'mirror/feature.js', 'export const a = 1;\n');
    write(root, 'mirror/README.md', '# Mirror\n');
    write(root, 'vendor/lib.js', 'module.exports = 1;\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'base');
    git(root, 'checkout', '-q', '-b', 'work');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves out files the merge base marks generated or vendored', () => {
    write(root, 'src/feature.ts', 'export const a = 2;\n');
    write(root, 'mirror/feature.js', 'export const a = 2;\n');
    write(root, 'mirror/README.md', '# Mirror v2\n');
    write(root, 'vendor/lib.js', 'module.exports = 2;\n');
    write(root, 'mirror/new.js', 'export {};\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'work');

    expect(
      [...(implementationFiles() ?? [])].toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(['mirror/README.md', 'src/feature.ts']);
  });

  it('still requires review of a file the branch itself marks generated', () => {
    write(root, 'src/feature.ts', 'export const a = 2;\n');
    write(root, '.gitattributes', 'src/** linguist-generated=true\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'self-exempt');
    write(root, '.git/info/attributes', 'src/** linguist-generated=true\n');

    expect(
      [...(implementationFiles() ?? [])].toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(['.gitattributes', 'src/feature.ts']);
  });
});
