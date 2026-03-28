/**
 * Pack Config Tracking
 *
 * Helpers to read/write installedPacks in .safeword/config.json
 */

import nodePath from 'node:path';

import { readFileSafe, writeFile } from '../utils/fs.js';
import { VERSION } from '../version.js';

const CONFIG_PATH = '.safeword/config.json';

interface SafewordConfig {
  version: string;
  installedPacks: string[];
}

function readConfig(cwd: string): SafewordConfig | undefined {
  const configPath = nodePath.join(cwd, CONFIG_PATH);
  const content = readFileSafe(configPath);
  if (!content) return undefined;
  return JSON.parse(content) as SafewordConfig;
}

function writeConfig(cwd: string, config: SafewordConfig): void {
  const configPath = nodePath.join(cwd, CONFIG_PATH);
  writeFile(configPath, JSON.stringify(config, undefined, 2));
}

/**
 * Get the list of installed packs from config.
 *
 * @param cwd - Project root directory
 * @returns Array of installed pack IDs, or empty array if no config
 */
export function getInstalledPacks(cwd: string): string[] {
  const config = readConfig(cwd);
  return config?.installedPacks ?? [];
}

/**
 * Check if a specific pack is installed.
 *
 * @param cwd - Project root directory
 * @param packId - Pack ID to check
 * @returns true if pack is in installedPacks
 */
export function isPackInstalled(cwd: string, packId: string): boolean {
  return getInstalledPacks(cwd).includes(packId);
}

/**
 * Add a pack to the installed packs list.
 * Creates config.json if it doesn't exist.
 *
 * @param cwd - Project root directory
 * @param packId - Pack ID to add
 */
/**
 * Rename a pack ID in the installed packs list.
 * Used for pack renames (e.g., dbt → sql).
 */
export function migratePackId(cwd: string, oldId: string, newId: string): void {
  const config = readConfig(cwd);
  if (!config) return;
  if (!config.installedPacks.includes(oldId)) return;
  if (config.installedPacks.includes(newId)) return;

  config.installedPacks = config.installedPacks.map(p => (p === oldId ? newId : p));
  writeConfig(cwd, config);
}

export function addInstalledPack(cwd: string, packId: string): void {
  const config = readConfig(cwd) ?? { version: VERSION, installedPacks: [] };

  if (!config.installedPacks.includes(packId)) {
    config.installedPacks.push(packId);
    writeConfig(cwd, config);
  }
}
