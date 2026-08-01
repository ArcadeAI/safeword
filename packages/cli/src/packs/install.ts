/**
 * Pack Installation
 *
 * Install language packs and update config.
 */

import { isGitRepo } from '../utils/git.js';
import { addInstalledPack, isPackInstalled } from './config.js';
import { LANGUAGE_PACKS } from './registry.js';
import type { SetupResult } from './types.js';

/**
 * Install a language pack.
 *
 * Runs the pack's setup function and updates config.json.
 * Idempotent - does nothing if pack is already installed.
 *
 * @param packId - Pack ID to install (e.g., 'python')
 * @param cwd - Project root directory
 * @throws Error if pack ID is unknown
 */
export function installPack(packId: string, cwd: string): SetupResult {
  // Idempotent - skip if already installed
  if (isPackInstalled(cwd, packId)) {
    return { files: [] };
  }

  const pack = LANGUAGE_PACKS[packId];
  if (!pack) {
    throw new Error(`Unknown pack: ${packId}`);
  }

  const result = pack.setup(cwd, { isGitRepo: isGitRepo(cwd) });
  addInstalledPack(cwd, packId);
  return result;
}
