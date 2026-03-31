/**
 * Pack Config Tracking
 *
 * Helpers to read/write installedPacks in .safeword/config.json
 */

import nodePath from 'node:path';
import process from 'node:process';

import { readFileSafe, writeFile } from '../utils/fs.js';
import { VERSION } from '../version.js';

const CONFIG_PATH = '.safeword/config.json';

interface SafewordConfig {
  version: string;
  installedPacks: string[];
  autoUpdate?: boolean;
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
 * Check if auto-update is enabled for this project.
 * Env vars override config: SAFEWORD_NO_AUTO_UPDATE or CI disables.
 * Config file: autoUpdate defaults to true when absent.
 */
export function shouldAutoUpdate(cwd: string): boolean {
  if (process.env.SAFEWORD_NO_AUTO_UPDATE) return false;
  if (process.env.CI) return false;
  const config = readConfig(cwd);
  return config?.autoUpdate !== false;
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

/**
 * Add a pack to the installed packs list.
 * Creates config.json if it doesn't exist.
 */
export function addInstalledPack(cwd: string, packId: string): void {
  const config = readConfig(cwd) ?? { version: VERSION, installedPacks: [] };

  if (!config.installedPacks.includes(packId)) {
    config.installedPacks.push(packId);
    writeConfig(cwd, config);
  }
}
