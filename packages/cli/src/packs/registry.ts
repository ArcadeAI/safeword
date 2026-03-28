/**
 * Pack Registry
 *
 * Central registry of language packs with lookup helpers.
 */

import { getInstalledPacks } from './config.js';
import { golangPack } from './golang/index.js';
import { pythonPack } from './python/index.js';
import { rustPack } from './rust/index.js';
import { sqlPack } from './sql/index.js';
import type { LanguagePack } from './types.js';
import { typescriptPack } from './typescript/index.js';

/**
 * All registered language packs.
 */
export const LANGUAGE_PACKS: Record<string, LanguagePack> = {
  sql: sqlPack,
  golang: golangPack,
  python: pythonPack,
  rust: rustPack,
  typescript: typescriptPack,
};

/**
 * Find the language pack for a file extension.
 *
 * @param ext - File extension including dot (e.g., '.py')
 * @returns The matching pack or undefined
 */
export function findPackForExtension(extension: string): LanguagePack | undefined {
  for (const pack of Object.values(LANGUAGE_PACKS)) {
    if (pack.extensions.includes(extension)) {
      return pack;
    }
  }
  return undefined;
}

/**
 * Detect which languages are present in a project.
 *
 * @param cwd - Project root directory
 * @returns Array of pack IDs for detected languages
 */
export function detectLanguages(cwd: string): string[] {
  const detected: string[] = [];

  for (const pack of Object.values(LANGUAGE_PACKS)) {
    if (pack.detect(cwd)) {
      detected.push(pack.id);
    }
  }

  return detected;
}

/**
 * Get pack IDs for detected languages that aren't installed.
 *
 * @param cwd - Project root directory
 * @returns Array of missing pack IDs
 */
export function getMissingPacks(cwd: string): string[] {
  const detected = detectLanguages(cwd);
  const installed = getInstalledPacks(cwd);
  return detected.filter(packId => !installed.includes(packId));
}
