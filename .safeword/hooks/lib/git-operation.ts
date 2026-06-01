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

export function isGitOperationInProgress(_projectDirectory: string): boolean {
  return false; // STUB — real implementation in GREEN
}

export { OPERATION_MARKERS };
