/**
 * Unit tests for isGitOperationInProgress — the git-operation-aware LOC gate
 * guard (ticket MT27QG). Detects merge/rebase/cherry-pick/revert via the
 * markers git writes under its git dir, so the LOC gate stands down mid-merge.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isGitOperationInProgress } from '../../../../.safeword/hooks/lib/git-operation';
import { createTemporaryDirectory, initGitRepo, removeTemporaryDirectory } from '../helpers.js';

describe('isGitOperationInProgress', () => {
  let directory: string;

  beforeEach(() => {
    directory = createTemporaryDirectory();
    initGitRepo(directory);
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  function gitPath(...segments: string[]): string {
    return nodePath.join(directory, '.git', ...segments);
  }

  it('merge_in_progress_is_detected', () => {
    writeFileSync(gitPath('MERGE_HEAD'), 'abc123\n');
    expect(isGitOperationInProgress(directory)).toBe(true);
  });

  it('rebase_in_progress_is_detected', () => {
    mkdirSync(gitPath('rebase-merge'), { recursive: true });
    expect(isGitOperationInProgress(directory)).toBe(true);
  });

  it('cherry_pick_in_progress_is_detected', () => {
    writeFileSync(gitPath('CHERRY_PICK_HEAD'), 'abc123\n');
    expect(isGitOperationInProgress(directory)).toBe(true);
  });

  it('revert_in_progress_is_detected', () => {
    writeFileSync(gitPath('REVERT_HEAD'), 'abc123\n');
    expect(isGitOperationInProgress(directory)).toBe(true);
  });

  it('clean_repo_returns_false', () => {
    expect(isGitOperationInProgress(directory)).toBe(false);
  });

  it('non_git_directory_returns_false', () => {
    const plain = createTemporaryDirectory();
    try {
      expect(isGitOperationInProgress(plain)).toBe(false);
    } finally {
      removeTemporaryDirectory(plain);
    }
  });
});
