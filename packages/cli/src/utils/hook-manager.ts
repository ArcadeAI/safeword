/**
 * Hook-manager world detection (ZJMZ50, #810 child 2).
 *
 * Decides how the boundary-gate shims reach a host repo: `husky` hosts get
 * marker-block appends into `.husky/*`; every other world gets a printed
 * integration snippet (nudge), never an edited config. The rule is
 * conservative-when-contested — safeword appends to `.husky` only when husky
 * is uncontested by another manager's config, or actively confirmed by
 * `core.hooksPath`. A wrong nudge is noise; a wrong append is dead lines in
 * someone else's hook file.
 */

import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';

import type { HookManagerWorld } from '../packs/types.js';
import { exists } from './fs.js';

export type { HookManagerWorld } from '../packs/types.js';

/** Lefthook's recognized config filenames — shared with the nudge's quiesce check. */
export const LEFTHOOK_CONFIGS = [
  'lefthook.yml',
  'lefthook.yaml',
  '.lefthook.yml',
  '.lefthook.yaml',
];
const PRE_COMMIT_CONFIG = '.pre-commit-config.yaml';

/** The repo's configured core.hooksPath, or undefined when unset/unreadable. */
function configuredHooksPath(cwd: string): string | undefined {
  try {
    const value = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return value === '' ? undefined : value;
  } catch {
    return undefined;
  }
}

/** True when a (relative) hooks path lives inside `.husky` — husky's signature. */
function pointsIntoHusky(hooksPath: string): boolean {
  return hooksPath === '.husky' || hooksPath.startsWith('.husky/');
}

/** Which hook-manager world governs this host's git hooks. */
export function detectHookManagerWorld(
  cwd: string,
  allDependencies: Record<string, string>,
): HookManagerWorld {
  const hooksPath = configuredHooksPath(cwd);
  const hasLefthook = LEFTHOOK_CONFIGS.some(name => exists(nodePath.join(cwd, name)));
  const hasPreCommit = exists(nodePath.join(cwd, PRE_COMMIT_CONFIG));

  // An explicit core.hooksPath is the active-manager signal and wins outright.
  if (hooksPath !== undefined) {
    if (pointsIntoHusky(hooksPath)) return 'husky';
    if (hasLefthook) return 'lefthook';
    if (hasPreCommit) return 'pre-commit';
    return 'bare';
  }

  // No active signal (e.g. a fresh clone before `prepare`): another manager's
  // config contests any leftover .husky dir, so nudge instead of appending.
  if (hasLefthook) return 'lefthook';
  if (hasPreCommit) return 'pre-commit';
  if (exists(nodePath.join(cwd, '.husky'))) return 'husky';
  if ('husky' in allDependencies) return 'husky-uninitialized';
  return 'bare';
}
