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

/** The git worktree root at/above cwd, or undefined outside any repository. */
export function gitToplevel(cwd: string): string | undefined {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return top === '' ? undefined : top;
  } catch {
    return undefined;
  }
}
