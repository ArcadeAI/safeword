import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { findEnclosingProject } from '../../src/lifecycle/nested-install.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

function projectWithSubdirectory(): { root: string; nested: string } {
  const root = createTemporaryDirectory();
  temporaryDirectories.push(root);
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  const nested = nodePath.join(root, 'packages/cli');
  mkdirSync(nested, { recursive: true });
  return { root, nested };
}

afterAll(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
});

describe('enclosing project detection', () => {
  it('reports the installed project above a subdirectory', () => {
    const { root, nested } = projectWithSubdirectory();
    expect(findEnclosingProject(nested)).toBe(root);
  });

  it('ignores the project rooted at the directory itself', () => {
    const { root } = projectWithSubdirectory();
    expect(findEnclosingProject(root)).toBeUndefined();
  });

  it('reports nothing for a directory outside any project', () => {
    const bare = createTemporaryDirectory();
    temporaryDirectories.push(bare);
    const nested = nodePath.join(bare, 'packages/cli');
    mkdirSync(nested, { recursive: true });
    expect(findEnclosingProject(nested)).toBeUndefined();
  });

  it('does not mistake a `.safeword` file for an installed project root', () => {
    const bare = createTemporaryDirectory();
    temporaryDirectories.push(bare);
    const nested = nodePath.join(bare, 'packages/cli');
    mkdirSync(nested, { recursive: true });
    writeFileSync(nodePath.join(bare, '.safeword'), 'not a project');
    expect(findEnclosingProject(nested)).toBeUndefined();
  });
});

describe('enclosing project detection across git worktrees (#5479, #5318)', () => {
  function worktreeInsideProject(): { root: string; worktree: string } {
    const { root } = projectWithSubdirectory();
    const worktree = nodePath.join(root, '.claude/worktrees/feature');
    mkdirSync(worktree, { recursive: true });
    writeFileSync(nodePath.join(worktree, '.git'), 'gitdir: ../../../.git/worktrees/feature\n');
    return { root, worktree };
  }

  it('treats a git worktree nested under a project as its own project root', () => {
    const { worktree } = worktreeInsideProject();
    expect(findEnclosingProject(worktree)).toBeUndefined();
  });

  it('still reports the worktree for a subdirectory inside an installed worktree', () => {
    const { worktree } = worktreeInsideProject();
    mkdirSync(nodePath.join(worktree, '.safeword'));
    const nested = nodePath.join(worktree, 'packages/cli');
    mkdirSync(nested, { recursive: true });
    expect(findEnclosingProject(nested)).toBe(worktree);
  });

  it('does not look past a git repository boundary to a project above it', () => {
    const { worktree } = worktreeInsideProject();
    const nested = nodePath.join(worktree, 'packages/cli');
    mkdirSync(nested, { recursive: true });
    expect(findEnclosingProject(nested)).toBeUndefined();
  });
});
