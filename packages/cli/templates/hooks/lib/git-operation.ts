/**
 * Detect an in-progress git operation (merge / rebase / cherry-pick / revert)
 * so the LOC blast-radius gate can stand down — `git diff HEAD` counts a merge's
 * incoming lines as if they were the agent's uncommitted work, which would trip
 * the threshold and block the very edits needed to resolve the operation
 * (project memory `project_loc_gate_blocks_merge`). Ticket MT27QG.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

/** Markers git writes under its git dir while an operation is mid-flight. The
 * rebase-* entries are directories; the rest are files. */
const OPERATION_MARKERS = [
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'rebase-merge',
  'rebase-apply',
];

export function isGitOperationInProgress(projectDirectory: string): boolean {
  let gitDirectory: string;
  try {
    gitDirectory = execSync('git rev-parse --git-dir', {
      cwd: projectDirectory,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return false; // not a git repo (or git unavailable) — never gate-suppress
  }
  if (gitDirectory.length === 0) return false;

  // `--git-dir` may be relative (`.git`) or absolute (worktrees, custom dirs).
  const base = nodePath.isAbsolute(gitDirectory)
    ? gitDirectory
    : nodePath.join(projectDirectory, gitDirectory);

  return OPERATION_MARKERS.some(marker => existsSync(nodePath.join(base, marker)));
}

export { OPERATION_MARKERS };
