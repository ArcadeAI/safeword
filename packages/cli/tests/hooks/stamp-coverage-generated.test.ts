/**
 * The implement-phase stamp's required coverage set (issue #5870).
 *
 * A change that regenerates mirrored files can exceed the review packet's file
 * limit, so the stamp must not demand review of files the base branch already
 * marks as generated or vendored. The marking is read from the merge base, so a
 * branch cannot exempt its own hand-written files.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reviewClaimContext } from '../../templates/hooks/lib/verify-stamp-claims.js';

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
}

/** Runs `work` with a `git` first on PATH that exits 128 for one subcommand. */
function withFailingGit<T>(subcommand: string, work: () => T): T {
  const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  const shim = mkdtempSync(nodePath.join(tmpdir(), 'stamp-coverage-git-'));
  const shimGit = nodePath.join(shim, 'git');
  writeFileSync(
    shimGit,
    `#!/bin/sh\nfor arg in "$@"; do [ "$arg" = "${subcommand}" ] && exit 128; done\nexec "${realGit}" "$@"\n`,
  );
  chmodSync(shimGit, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${shim}${nodePath.delimiter}${previousPath ?? ''}`;
  try {
    return work();
  } finally {
    process.env.PATH = previousPath;
    rmSync(shim, { recursive: true, force: true });
  }
}

function write(root: string, relative: string, content: string): void {
  const path = nodePath.join(root, relative);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function initRepo(root: string, attributes: string, files: Record<string, string>): void {
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'commit.gpgsign', 'false');
  write(root, '.gitattributes', attributes);
  for (const [relative, content] of Object.entries(files)) write(root, relative, content);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'checkout', '-q', '-b', 'work');
}

function commitAll(root: string, message: string): void {
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', message);
}

/** The project's implement-phase coverage set, sorted for stable comparison. */
function coverageSet(projectDirectory: string): string[] {
  const files = reviewClaimContext(
    projectDirectory,
    nodePath.join(projectDirectory, '.project/tickets/T1'),
  ).implementationFiles;
  return [...(files ?? [])].toSorted((left, right) => left.localeCompare(right));
}

describe('implement-phase coverage set', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(nodePath.join(tmpdir(), 'stamp-coverage-'));
    initRepo(
      root,
      'mirror/** linguist-generated=true\nvendor/** linguist-vendored\nmirror/README.md -linguist-generated\n',
      {
        'src/feature.ts': 'export const a = 1;\n',
        'mirror/feature.js': 'export const a = 1;\n',
        'mirror/README.md': '# Mirror\n',
        'vendor/lib.js': 'module.exports = 1;\n',
      },
    );
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
    commitAll(root, 'work');

    expect(coverageSet(root)).toEqual(['mirror/README.md', 'src/feature.ts']);
  });

  it('keeps a staged edit that the working tree reverts', () => {
    write(root, 'src/feature.ts', 'export const a = 2;\n');
    git(root, 'add', 'src/feature.ts');
    write(root, 'src/feature.ts', 'export const a = 1;\n');
    write(root, 'src/other.ts', 'export const b = 1;\n');

    expect(coverageSet(root)).toEqual(['src/feature.ts', 'src/other.ts']);
  });

  it('still requires a file the branch marks generated in its own .gitattributes', () => {
    write(root, 'src/feature.ts', 'export const a = 2;\n');
    write(root, '.gitattributes', 'src/** linguist-generated=true\n');
    commitAll(root, 'self-exempt');

    expect(coverageSet(root)).toEqual(['.gitattributes', 'src/feature.ts']);
  });

  it('still requires a file marked generated only in .git/info/attributes', () => {
    write(root, 'src/feature.ts', 'export const a = 2;\n');
    commitAll(root, 'work');
    write(root, '.git/info/attributes', 'src/** linguist-generated=true\n');

    expect(coverageSet(root)).toEqual(['src/feature.ts']);
  });

  // Without the injected failure the mirror file would be exempt, so a pass
  // proves both that the failure happened and that it exempted nothing.
  it.each(['check-attr', 'init'])(
    'exempts nothing when the attribute read fails at git %s',
    failingCommand => {
      write(root, 'src/feature.ts', 'export const a = 2;\n');
      write(root, 'mirror/feature.js', 'export const a = 2;\n');
      commitAll(root, 'work');
      const files = withFailingGit(failingCommand, () => coverageSet(root));

      expect(files).toEqual(['mirror/feature.js', 'src/feature.ts']);
    },
  );
});

describe('implement-phase coverage set for a project in a repository subfolder', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(nodePath.join(tmpdir(), 'stamp-coverage-sub-'));
    initRepo(root, 'app/mirror/** linguist-generated=true\n', {
      'app/src/feature.ts': 'export const a = 1;\n',
      'app/mirror/feature.js': 'export const a = 1;\n',
      'other/outside.ts': 'export const c = 1;\n',
    });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('exempts base-marked files under the project and reports project-relative paths', () => {
    write(root, 'app/src/feature.ts', 'export const a = 2;\n');
    write(root, 'app/mirror/feature.js', 'export const a = 2;\n');
    write(root, 'other/outside.ts', 'export const c = 2;\n');
    commitAll(root, 'work');
    write(root, 'app/src/untracked.ts', 'export const d = 1;\n');

    expect(coverageSet(nodePath.join(root, 'app'))).toEqual(['src/feature.ts', 'src/untracked.ts']);
  });
});
