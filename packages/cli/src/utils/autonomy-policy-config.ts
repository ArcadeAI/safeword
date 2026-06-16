/**
 * Filesystem layer for the autonomy policy (ticket HPQ43R).
 *
 * The project policy lives under `autonomy` in the committed
 * `.safeword/config.json`; a developer's personal override lives under
 * `autonomy` in `.safeword/config.local.json`, which is gitignored
 * (registered in `SAFEWORD_TRANSIENT_PATHS`) so it is never committed.
 *
 * This is the thin, side-effecting caller on top of the pure `resolvePolicy`
 * — kept separate so the resolver stays unit-testable without the disk.
 */

import nodePath from 'node:path';

import { type PostureMap, resolvePolicy } from './autonomy-policy.js';
import { readFileSafe } from './fs.js';

/** Committed, team-wide project policy. */
export const PROJECT_CONFIG_SUBPATH = ['.safeword', 'config.json'];
/** Gitignored, per-developer override. */
export const PERSONAL_CONFIG_SUBPATH = ['.safeword', 'config.local.json'];

function readAutonomyField(cwd: string, subpath: readonly string[]): unknown {
  const content = readFileSafe(nodePath.join(cwd, ...subpath));
  if (content === undefined) return undefined;
  try {
    return (JSON.parse(content) as { autonomy?: unknown }).autonomy;
  } catch {
    // Malformed JSON is treated as absent — resolvePolicy then fails safe.
    return undefined;
  }
}

/**
 * Resolve the effective posture map for `cwd` from the project config and the
 * personal override, applying `resolvePolicy`'s precedence and fail-safe
 * rules. A missing or unreadable file behaves as "no policy at that layer".
 */
export function readAutonomyPolicy(cwd: string): PostureMap {
  return resolvePolicy({
    project: readAutonomyField(cwd, PROJECT_CONFIG_SUBPATH),
    personal: readAutonomyField(cwd, PERSONAL_CONFIG_SUBPATH),
  });
}
