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
    // Seed a tracked file so "no-op" is observable, not vacuous: the index
    // must be byte-identical after the unmatched untrack, not merely un-thrown.
    writeFileSync(nodePath.join(directory, 'keep.txt'), 'tracked\n');
    execSync('git add -A && git commit -q -m init', { cwd: directory });
    const indexBefore = execSync('git ls-files', { cwd: directory, encoding: 'utf8' });

    untrackIgnoredFiles(directory, ['.safeword-project/failure-counts.json']);

    expect(execSync('git ls-files', { cwd: directory, encoding: 'utf8' })).toBe(indexBefore);
    expect(existsSync(nodePath.join(directory, 'keep.txt'))).toBe(true);
  });

  it('is a no-op outside a git repository', () => {
    const plain = createTemporaryDirectory();
    try {
      const relative = '.safeword-project/re-entry.md';
      const absolute = nodePath.join(plain, relative);
      mkdirSync(nodePath.dirname(absolute), { recursive: true });
      writeFileSync(absolute, 'session log\n');

      expect(() => {
        untrackIgnoredFiles(plain, [relative]);
      }).not.toThrow();

      // The named file survives on disk — nothing was deleted in lieu of untracking.
      expect(existsSync(absolute)).toBe(true);
    } finally {
      removeTemporaryDirectory(plain);
    }
  });
});
