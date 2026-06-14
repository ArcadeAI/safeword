/**
 * Namespace migration — the consensual move of a legacy `.safeword-project/`
 * onto `.project/` (ticket 9MMWS7, epic AQJ95G).
 *
 * `planNamespaceMigration` classifies the install; `executeNamespaceMigration`
 * performs the move (git mv when the directory is tracked, so history is
 * preserved; filesystem rename otherwise) and rewrites stale per-file
 * `paths.*` overrides that pointed into the legacy root. Consent lives in the
 * caller (`safeword upgrade`) — this module never decides to move.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { readConfiguredPath } from './configured-paths.js';
import { isDirectory } from './fs.js';

const LEGACY_ROOT = '.safeword-project';
const DEFAULT_ROOT = '.project';

export type MigrationPlan =
  | 'offer' // legacy-only install — offer the move
  | 'already-current' // .project/ present (or nothing to move) — no offer
  | 'both-dirs' // both roots exist — refuse, manual merge needed
  | 'custom-root' // explicit paths.projectRoot — user opted out of defaults
  | 'blocked'; // target exists but is not a directory — cannot move

export interface MigrationResult {
  method: 'git' | 'rename';
  rewrittenKeys: string[];
}

/** Classify the install for the migration offer. */
export function planNamespaceMigration(cwd: string): MigrationPlan {
  if (readConfiguredPath(cwd, 'projectRoot') !== undefined) return 'custom-root';

  const legacyPath = nodePath.join(cwd, LEGACY_ROOT);
  if (!isDirectory(legacyPath)) return 'already-current';

  const targetPath = nodePath.join(cwd, DEFAULT_ROOT);
  if (isDirectory(targetPath)) return 'both-dirs';
  if (existsSync(targetPath)) return 'blocked';

  return 'offer';
}

/** True when git tracks anything under the legacy directory. */
function isGitTracked(cwd: string): boolean {
  try {
    const output = execSync(`git ls-files --error-unmatch "${LEGACY_ROOT}" 2>/dev/null | head -1`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Rewrite per-file `paths.*` values prefixed with the legacy root so they
 * follow the moved namespace. Surgical: only string values under `paths`
 * that start with `.safeword-project/` are touched.
 */
function rewriteLegacyPathOverrides(cwd: string): string[] {
  const configPath = nodePath.join(cwd, '.safeword', 'config.json');
  if (!existsSync(configPath)) return [];

  let parsed: { paths?: Record<string, unknown> };
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { paths?: Record<string, unknown> };
  } catch {
    return [];
  }
  if (!parsed.paths) return [];

  const rewritten: string[] = [];
  for (const [key, value] of Object.entries(parsed.paths)) {
    if (typeof value === 'string' && value.startsWith(`${LEGACY_ROOT}/`)) {
      parsed.paths[key] = `${DEFAULT_ROOT}${value.slice(LEGACY_ROOT.length)}`;
      rewritten.push(key);
    }
  }
  if (rewritten.length > 0) {
    writeFileSync(configPath, `${JSON.stringify(parsed, undefined, 2)}\n`);
  }
  return rewritten.toSorted((a, b) => a.localeCompare(b));
}

/**
 * Move the legacy namespace to `.project/` and rewrite stale config
 * overrides. Caller must have confirmed consent and a plan of 'offer'.
 * Throws with context when the move itself fails — the tree is unchanged
 * in that case (a directory rename is atomic on one filesystem).
 */
export function executeNamespaceMigration(cwd: string): MigrationResult {
  const method: MigrationResult['method'] = isGitTracked(cwd) ? 'git' : 'rename';

  try {
    if (method === 'git') {
      execSync(`git mv "${LEGACY_ROOT}" "${DEFAULT_ROOT}"`, { cwd, stdio: 'pipe' });
    } else {
      renameSync(nodePath.join(cwd, LEGACY_ROOT), nodePath.join(cwd, DEFAULT_ROOT));
    }
  } catch (error) {
    throw new Error(
      `Failed to move ${LEGACY_ROOT}/ to ${DEFAULT_ROOT}/: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  return { method, rewrittenKeys: rewriteLegacyPathOverrides(cwd) };
}
