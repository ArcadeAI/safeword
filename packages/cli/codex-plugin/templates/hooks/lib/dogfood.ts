/**
 * Detect the safeword dev (dogfood) repo (ticket 975N5T).
 *
 * In the dev repo, `.safeword/` + `.claude/` are deployed mirrors of the LOCAL
 * canonical source at `packages/cli/templates/` — routinely ahead of the
 * published npm package. The session auto-upgrade must skip this repo: installing
 * the published files over the mirrors regresses unreleased work, and the commit
 * is then (correctly) blocked by the pre-commit dogfood-direction guard.
 *
 * Two signals, OR'd — both are plain file reads, so they stay reliable mid-merge:
 *   - `packages/cli/templates/` exists (the canonical template source; a consumer
 *     project never has this), or
 *   - the root `package.json` is itself named `safeword`.
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

export function isDogfoodRepo(projectDirectory: string): boolean {
  if (existsSync(nodePath.join(projectDirectory, 'packages', 'cli', 'templates'))) return true;
  try {
    const pkg = JSON.parse(
      readFileSync(nodePath.join(projectDirectory, 'package.json'), 'utf8'),
    ) as { name?: unknown };
    return pkg.name === 'safeword';
  } catch {
    // No package.json, or malformed — not a recognizable dogfood signal.
    return false;
  }
}
