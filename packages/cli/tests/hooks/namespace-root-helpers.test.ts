/**
 * Hook-side namespace-root lib behavior (ticket TAGWZ8). The differential
 * test pins resolveNamespaceRoot against the CLI copy; this file covers the
 * hook-only helpers isNamespacePath and resolveOwningProjectDirectory.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isNamespacePath,
  resolveOwningProjectDirectory,
  resolveWorkingProjectDirectory,
} from '../../templates/hooks/lib/namespace-root.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

describe('isNamespacePath (TAGWZ8)', () => {
  it('matches the default root, absolute and relative', () => {
    expect(isNamespacePath('/repo/.project/tickets/T/ticket.md', 'tickets/')).toBe(true);
    expect(isNamespacePath('.project/tickets/T/ticket.md', 'tickets/')).toBe(true);
  });

  it('matches the legacy root', () => {
    expect(isNamespacePath('.safeword-project/tickets/T/ticket.md', 'tickets/')).toBe(true);
    expect(isNamespacePath('/repo/.safeword-project/learnings/foo.md', 'learnings/')).toBe(true);
  });

  it('rejects roots that merely end with the namespace name', () => {
    // foo.project/ is NOT the namespace root — boundary must be a path
    // separator or string start.
    expect(isNamespacePath('foo.project/tickets/T/ticket.md', 'tickets/')).toBe(false);
    expect(isNamespacePath('/repo/my.safeword-project/tickets/T/ticket.md', 'tickets/')).toBe(
      false,
    );
  });

  it('rejects paths outside the requested subpath', () => {
    expect(isNamespacePath('.project/learnings/foo.md', 'tickets/')).toBe(false);
  });
});

describe('resolveOwningProjectDirectory (#5247)', () => {
  let root: string;
  let launch: string;
  const ticket = (treeRoot: string) => nodePath.join(treeRoot, '.project/tickets/T1-x/ticket.md');

  // `.git` is a directory in a main checkout and a file in a linked worktree;
  // the resolver only needs it to exist.
  function tree(path: string, { enrolled }: { enrolled: boolean }): string {
    mkdirSync(nodePath.join(path, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(path, '.git'), 'gitdir: elsewhere\n');
    if (enrolled) writeFileSync(nodePath.join(path, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    return path;
  }

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = nodePath.join(root, 'launch');
    mkdirSync(nodePath.join(launch, '.git'), { recursive: true });
    mkdirSync(nodePath.join(launch, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(launch, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  it('keeps the launch checkout for its own files', () => {
    expect(resolveOwningProjectDirectory(launch, ticket(launch))).toBe(launch);
  });

  it('roots a nested enrolled worktree at that worktree', () => {
    const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
    expect(resolveOwningProjectDirectory(launch, ticket(worktree))).toBe(worktree);
  });

  it('roots a sibling enrolled worktree outside the launch checkout', () => {
    const worktree = tree(nodePath.join(root, 'sibling'), { enrolled: true });
    expect(resolveOwningProjectDirectory(launch, ticket(worktree))).toBe(worktree);
  });

  it('falls back to the launch checkout when the owning tree is not enrolled', () => {
    const vendored = tree(nodePath.join(launch, 'vendor/lib'), { enrolled: false });
    expect(resolveOwningProjectDirectory(launch, nodePath.join(vendored, 'index.ts'))).toBe(launch);
  });

  it('falls back to the launch checkout for files outside any git tree or with no path', () => {
    expect(resolveOwningProjectDirectory(launch, nodePath.join(root, 'loose/file.ts'))).toBe(
      launch,
    );
    expect(resolveOwningProjectDirectory(launch, '')).toBe(launch);
  });
});

describe('resolveWorkingProjectDirectory (#5361)', () => {
  let root: string;
  let launch: string;

  function enrolledTree(path: string): string {
    mkdirSync(nodePath.join(path, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(path, '.git'), 'gitdir: elsewhere\n');
    writeFileSync(nodePath.join(path, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    return path;
  }

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = enrolledTree(nodePath.join(root, 'launch'));
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  it('roots a helper run from inside a worktree at that worktree', () => {
    const worktree = enrolledTree(nodePath.join(launch, '.claude/worktrees/wt'));
    const nested = nodePath.join(worktree, 'packages/cli');
    mkdirSync(nested, { recursive: true });
    expect(resolveWorkingProjectDirectory(launch, worktree)).toBe(worktree);
    expect(resolveWorkingProjectDirectory(launch, nested)).toBe(worktree);
  });

  it('keeps the launch checkout when run from it or from outside any tree', () => {
    expect(resolveWorkingProjectDirectory(launch, launch)).toBe(launch);
    expect(resolveWorkingProjectDirectory(launch, root)).toBe(launch);
  });
});
