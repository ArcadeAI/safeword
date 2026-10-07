import { statSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';

function holdsProject(directory: string): boolean {
  const marker = nodePath.join(directory, '.safeword');
  return statSync(marker, { throwIfNoEntry: false })?.isDirectory() === true;
}

/** A `.git` directory or a worktree's `.git` file marks a repository root. */
function isGitCheckoutRoot(directory: string): boolean {
  return statSync(nodePath.join(directory, '.git'), { throwIfNoEntry: false }) !== undefined;
}

/**
 * Locate an installed Safeword project strictly above `cwd`, if there is one.
 *
 * `install` treats whatever directory it runs in as the project root. Run from a
 * subdirectory of an installed project it therefore builds a second, nested project
 * there and rewrites that subdirectory's tool configs — so callers look up first and
 * refuse rather than reconciling against a root the user never meant to target.
 *
 * The search stops at a git repository root: a worktree under
 * `.claude/worktrees/<name>` is its own checkout, not a subdirectory of the
 * project it happens to sit inside (#5479, #5318).
 */
export function findEnclosingProject(cwd: string): string | undefined {
  let current = nodePath.resolve(cwd);
  for (;;) {
    if (isGitCheckoutRoot(current)) return undefined;
    const parent = nodePath.dirname(current);
    if (parent === current) return undefined;
    if (holdsProject(parent)) return parent;
    current = parent;
  }
}

/** Refuse a nested install, naming the project the caller almost certainly meant. */
export function nestedProjectRefused(cwd: string, root: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'CLI_NESTED_PROJECT',
        message: `\`install\` targets the directory it runs in, and \`${root}\` is already a Safeword project.`,
        severity: 'error',
        detail: `Installing into \`${cwd}\` would create a second project nested inside that one and rewrite this directory's tool configuration. Run \`safeword install\` from \`${root}\` instead.`,
      },
    ],
    nextActions: [{ command: 'safeword install', mutates: true, requiresHuman: true }],
    data: { command: 'install', projectRoot: root, requestedRoot: cwd },
  });
}
