import { statSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';

function holdsProject(directory: string): boolean {
  const marker = nodePath.join(directory, '.safeword');
  return statSync(marker, { throwIfNoEntry: false })?.isDirectory() === true;
}

/**
 * Locate an installed Safeword project strictly above `cwd`, if there is one.
 *
 * `install` treats whatever directory it runs in as the project root. Run from a
 * subdirectory of an installed project it therefore builds a second, nested project
 * there and rewrites that subdirectory's tool configs — so callers look up first and
 * refuse rather than reconciling against a root the user never meant to target.
 */
export function findEnclosingProject(cwd: string): string | undefined {
  let current = nodePath.dirname(nodePath.resolve(cwd));
  let previous = '';
  while (current !== previous) {
    if (holdsProject(current)) return current;
    previous = current;
    current = nodePath.dirname(current);
  }
  return undefined;
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
