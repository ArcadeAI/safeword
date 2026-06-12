/**
 * Unit tests for git utilities — the upgrade-time untrack of now-ignored
 * transient state files. Customer issue: a `re-entry.md` / `failure-counts.json`
 * committed before the gitignore rule existed churns the tree every turn and
 * aborts branch switches; a `.gitignore` line alone can't untrack it.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { untrackIgnoredFiles } from '../src/utils/git.js';
import { createTemporaryDirectory, initGitRepo, removeTemporaryDirectory } from './helpers.js';

describe('untrackIgnoredFiles', () => {
  let directory: string;

  beforeEach(() => {
    directory = createTemporaryDirectory();
    initGitRepo(directory);
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  it('untracks a committed transient file but leaves it on disk', () => {
    const relative = '.safeword-project/re-entry.md';
    const absolute = nodePath.join(directory, relative);
    mkdirSync(nodePath.dirname(absolute), { recursive: true });
    writeFileSync(absolute, 'session log\n');
    execSync('git add -A && git commit -q -m init', { cwd: directory });
    expect(execSync('git ls-files', { cwd: directory, encoding: 'utf8' })).toContain(relative);

    untrackIgnoredFiles(directory, [relative]);

    // Removed from the index...
    expect(execSync('git ls-files', { cwd: directory, encoding: 'utf8' })).not.toContain(relative);
    // ...but the on-disk file the hooks read/write is untouched.
    expect(existsSync(absolute)).toBe(true);
  });

  it('is a no-op when the pathspec matches nothing tracked', () => {
    expect(() => {
      untrackIgnoredFiles(directory, ['.safeword-project/failure-counts.json']);
    }).not.toThrow();
  });

  it('is a no-op outside a git repository', () => {
    const plain = createTemporaryDirectory();
    try {
      expect(() => {
        untrackIgnoredFiles(plain, ['.safeword-project/re-entry.md']);
      }).not.toThrow();
    } finally {
      removeTemporaryDirectory(plain);
    }
  });
});
