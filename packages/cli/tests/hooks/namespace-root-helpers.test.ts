/**
 * Hook-side namespace-root lib behavior (ticket TAGWZ8). The differential
 * test pins resolveNamespaceRoot against the CLI copy; this file covers the
 * hook-only helpers isNamespacePath, resolveOwningProjectDirectory, and
 * resolveToolProjectDirectory.
 */

import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isNamespacePath,
  readConfiguredPathValue,
  resolveOwningProjectDirectory,
  resolveToolProjectDirectory,
  resolveWorkingProjectDirectory,
} from '../../templates/hooks/lib/namespace-root.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

// `.git` is a directory in a main checkout and a file in a linked worktree;
// the resolvers only need it to exist.
function tree(path: string, { enrolled }: { enrolled: boolean }): string {
  mkdirSync(nodePath.join(path, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(path, '.git'), 'gitdir: elsewhere\n');
  if (enrolled) writeFileSync(nodePath.join(path, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  return path;
}

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

  describe('per tool call', () => {
    it('roots a shell command at the enrolled worktree its cwd is inside', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
      mkdirSync(nodePath.join(worktree, 'packages/cli'), { recursive: true });

      expect(
        resolveToolProjectDirectory(launch, { tool: 'Bash', editedFile: '', cwd: worktree }),
      ).toBe(worktree);
      expect(
        resolveToolProjectDirectory(launch, {
          tool: 'Bash',
          editedFile: '',
          cwd: nodePath.join(worktree, 'packages/cli'),
        }),
      ).toBe(worktree);
    });

    it('roots a shell cwd reached through a symlink at the worktree it lands in', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
      mkdirSync(nodePath.join(worktree, 'packages'), { recursive: true });
      const alias = nodePath.join(launch, 'work-link');
      symlinkSync(nodePath.join(worktree, 'packages'), alias);

      expect(
        resolveToolProjectDirectory(launch, { tool: 'Bash', editedFile: '', cwd: alias }),
      ).toBe(realpathSync(worktree));
    });

    it('keeps the launch checkout for shells in it, without a cwd, or in unenrolled trees', () => {
      const vendored = tree(nodePath.join(launch, 'vendor/lib'), { enrolled: false });

      for (const cwd of [launch, undefined, '', vendored, nodePath.join(root, 'loose')]) {
        expect(resolveToolProjectDirectory(launch, { tool: 'Bash', editedFile: '', cwd })).toBe(
          launch,
        );
      }
    });

    it('resolves edits from the edited file, not the shell cwd', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });

      expect(
        resolveToolProjectDirectory(launch, {
          tool: 'Edit',
          editedFile: ticket(launch),
          cwd: worktree,
        }),
      ).toBe(launch);
      expect(
        resolveToolProjectDirectory(launch, {
          tool: 'Write',
          editedFile: ticket(worktree),
          cwd: launch,
        }),
      ).toBe(worktree);
    });

    it('keeps the launch checkout for other tools', () => {
      const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });

      expect(
        resolveToolProjectDirectory(launch, {
          tool: 'Read',
          editedFile: ticket(worktree),
          cwd: worktree,
        }),
      ).toBe(launch);
    });
  });
});

describe('resolveWorkingProjectDirectory (#5361)', () => {
  let root: string;
  let launch: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = tree(nodePath.join(root, 'launch'), { enrolled: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  it('roots a helper run from inside a worktree at that worktree', () => {
    const worktree = tree(nodePath.join(launch, '.claude/worktrees/wt'), { enrolled: true });
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

describe('readConfiguredPathValue (#5373)', () => {
  let root: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  const writeConfig = (content: string) => {
    writeFileSync(nodePath.join(root, '.safeword', 'config.json'), content);
  };

  it('returns the configured path', () => {
    writeConfig(JSON.stringify({ paths: { projectRoot: 'docs/project' } }));
    expect(readConfiguredPathValue(root, 'projectRoot')).toBe('docs/project');
  });

  it.each(['null', '42', '"text"', '[]', '{"paths":null}', '{"paths":"x"}', '{not json'])(
    'falls back to defaults for config.json containing %s',
    content => {
      writeConfig(content);
      expect(readConfiguredPathValue(root, 'projectRoot')).toBeUndefined();
    },
  );
});
