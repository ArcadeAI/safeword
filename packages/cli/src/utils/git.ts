/**
 * Git utilities for CLI operations
 */

import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';

import { exists } from './fs.js';

/**
 * Check if directory is a git repository
 * @param cwd
 */
export function isGitRepo(cwd: string): boolean {
  return exists(nodePath.join(cwd, '.git'));
}

/**
 * Stop tracking files that are now gitignored but were committed before the
 * ignore rule existed (e.g. safeword's transient hook state). `git rm --cached`
 * removes them from the index only — the on-disk files, which the hooks
 * read/write directly, are left untouched. Behaviour-neutral; it just clears
 * the perpetual-dirty-tree churn that aborts branch switches. No-op outside a
 * git repo or when a pathspec matches nothing (`--ignore-unmatch`).
 * @param cwd   project root
 * @param paths gitignore-relative pathspecs to untrack (globs allowed)
 */
export function untrackIgnoredFiles(cwd: string, paths: readonly string[]): void {
  if (!isGitRepo(cwd)) return;
  for (const pattern of paths) {
    try {
      execFileSync('git', ['rm', '--cached', '--ignore-unmatch', '--', pattern], {
        cwd,
        stdio: 'pipe',
      });
    } catch {
      // Best-effort: an un-removable path must never fail the upgrade.
    }
  }
}
