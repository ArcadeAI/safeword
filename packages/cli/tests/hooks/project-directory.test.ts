/**
 * The one rule every Safeword surface uses to pick its project (#5467):
 * the edited file's enrolled working tree, else the cwd's enrolled working
 * tree, else the launch checkout. A walk stops at the first git working tree;
 * an unenrolled tree yields nothing rather than handing off to an ancestor.
 */

import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveLaunchDirectory,
  resolveProjectDirectory,
  resolveToolProjectDirectory,
} from '../../templates/hooks/lib/project-directory.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

// `.git` is a directory in a main checkout and a file in a linked worktree;
// the resolver only needs it to exist.
function tree(path: string, { enrolled }: { enrolled: boolean }): string {
  mkdirSync(nodePath.join(path, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(path, '.git'), 'gitdir: elsewhere\n');
  if (enrolled) writeFileSync(nodePath.join(path, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  return path;
}

const ticket = (treeRoot: string) => nodePath.join(treeRoot, '.project/tickets/T1-x/ticket.md');

describe('resolveProjectDirectory (#5467)', () => {
  let root: string;
  let launch: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = tree(nodePath.join(root, 'launch'), { enrolled: true });
    vi.spyOn(process, 'cwd').mockReturnValue(root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    removeTemporaryDirectory(root);
  });

  describe('edited file', () => {
    it('keeps the launch checkout for its own files', () => {
      expect(
        resolveProjectDirectory({
          launchDirectory: launch,
          editedFile: ticket(launch),
          cwd: undefined,
        }),
      ).toBe(launch);
    });

    it('roots nested and sibling enrolled worktrees at that worktree', () => {
      const nested = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
      const sibling = tree(nodePath.join(root, 'sibling'), { enrolled: true });
      expect(
        resolveProjectDirectory({
          launchDirectory: launch,
          editedFile: ticket(nested),
          cwd: undefined,
        }),
      ).toBe(nested);
      expect(
        resolveProjectDirectory({
          launchDirectory: launch,
          editedFile: ticket(sibling),
          cwd: undefined,
        }),
      ).toBe(sibling);
    });

    it('wins over the cwd', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
      expect(
        resolveProjectDirectory({
          launchDirectory: launch,
          editedFile: ticket(launch),
          cwd: worktree,
        }),
      ).toBe(launch);
      expect(
        resolveProjectDirectory({
          launchDirectory: launch,
          editedFile: ticket(worktree),
          cwd: launch,
        }),
      ).toBe(worktree);
    });

    it('in an unenrolled tree falls through to the cwd, not to an enrolled ancestor', () => {
      const other = tree(nodePath.join(root, 'other'), { enrolled: true });
      const outer = tree(nodePath.join(root, 'outer'), { enrolled: true });
      const vendored = tree(nodePath.join(outer, 'vendor/lib'), { enrolled: false });
      expect(
        resolveProjectDirectory({
          launchDirectory: launch,
          editedFile: nodePath.join(vendored, 'index.ts'),
          cwd: other,
        }),
      ).toBe(other);
    });

    it('outside any git tree, or empty, falls back to the launch checkout', () => {
      expect(
        resolveProjectDirectory({
          launchDirectory: launch,
          editedFile: nodePath.join(root, 'loose/file.ts'),
          cwd: undefined,
        }),
      ).toBe(launch);
      expect(
        resolveProjectDirectory({ launchDirectory: launch, editedFile: '', cwd: undefined }),
      ).toBe(launch);
    });

    it('resolves through a symlink to the tree the file really lives in', () => {
      const target = tree(nodePath.join(root, 'target'), { enrolled: true });
      mkdirSync(nodePath.join(target, 'src'), { recursive: true });
      const alias = nodePath.join(launch, 'link');
      symlinkSync(nodePath.join(target, 'src'), alias);
      // The file does not exist yet: a Write creating it must still resolve.
      expect(
        resolveProjectDirectory({
          launchDirectory: launch,
          editedFile: nodePath.join(alias, 'new-file.ts'),
          cwd: launch,
        }),
      ).toBe(realpathSync(target));
    });
  });

  describe('cwd', () => {
    it('roots a cwd inside an enrolled worktree at that worktree', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
      const nested = nodePath.join(worktree, 'packages/cli');
      mkdirSync(nested, { recursive: true });
      expect(resolveProjectDirectory({ launchDirectory: launch, cwd: worktree })).toBe(worktree);
      expect(resolveProjectDirectory({ launchDirectory: launch, cwd: nested })).toBe(worktree);
    });

    it('resolves a relative cwd against the launch checkout', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
      expect(
        resolveProjectDirectory({ launchDirectory: launch, cwd: '.claude/worktrees/wt' }),
      ).toBe(worktree);
    });

    it('roots a cwd reached through a symlink at the worktree it lands in', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
      mkdirSync(nodePath.join(worktree, 'packages'), { recursive: true });
      const alias = nodePath.join(launch, 'work-link');
      symlinkSync(nodePath.join(worktree, 'packages'), alias);
      expect(resolveProjectDirectory({ launchDirectory: launch, cwd: alias })).toBe(
        realpathSync(worktree),
      );
    });

    it('keeps the launch spelling when the cwd is the launch checkout by real path', () => {
      const alias = nodePath.join(root, 'launch-link');
      symlinkSync(launch, alias);
      expect(resolveProjectDirectory({ launchDirectory: launch, cwd: alias })).toBe(launch);
    });

    it('never reads the process cwd itself: callers pass the cwd they mean', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
      vi.spyOn(process, 'cwd').mockReturnValue(worktree);
      expect(resolveProjectDirectory({ launchDirectory: launch, cwd: undefined })).toBe(launch);
      expect(resolveProjectDirectory({ launchDirectory: launch, cwd: process.cwd() })).toBe(
        worktree,
      );
    });

    it('falls back to the launch checkout when neither cwd is in an enrolled tree', () => {
      const vendored = tree(nodePath.join(launch, 'vendor/lib'), { enrolled: false });
      for (const cwd of [undefined, '', vendored, nodePath.join(root, 'loose')]) {
        expect(resolveProjectDirectory({ launchDirectory: launch, cwd })).toBe(launch);
      }
    });
  });
});

describe('resolveToolProjectDirectory (#5467)', () => {
  let root: string;
  let launch: string;
  let worktree: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = tree(nodePath.join(root, 'launch'), { enrolled: true });
    worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
    vi.spyOn(process, 'cwd').mockReturnValue(root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    removeTemporaryDirectory(root);
  });

  it('resolves edit tools from the edited file', () => {
    expect(
      resolveToolProjectDirectory(launch, {
        tool: 'Write',
        editedFile: ticket(worktree),
        cwd: launch,
      }),
    ).toBe(worktree);
  });

  it('resolves every other tool from its cwd, ignoring any file path', () => {
    for (const tool of ['Bash', 'Read', 'Grep']) {
      expect(
        resolveToolProjectDirectory(launch, { tool, editedFile: ticket(launch), cwd: worktree }),
      ).toBe(worktree);
    }
  });
});

describe('resolveLaunchDirectory (#5467)', () => {
  it('reads CLAUDE_PROJECT_DIR, else the process cwd', () => {
    expect(resolveLaunchDirectory({ CLAUDE_PROJECT_DIR: '/repo' })).toBe('/repo');
    expect(resolveLaunchDirectory({ CLAUDE_PROJECT_DIR: '' })).toBe(process.cwd());
    expect(resolveLaunchDirectory({})).toBe(process.cwd());
  });
});
