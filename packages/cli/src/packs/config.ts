/**
 * Pack Config Tracking
 *
 * Helpers to read/write installedPacks in .safeword/config.json
 */

import nodePath from 'node:path';
import process from 'node:process';

import { readFileSafe, writeFile } from '../utils/fs.js';

const CONFIG_PATH = '.safeword/config.json';

interface SafewordConfig {
  installedPacks?: string[];
  installAgents?: string;
  /**
   * Packages Safeword added whose install condition stops holding once they are
   * present (e.g. `typescript`), mapped to the version range package.json had
   * when Safeword added them. A package stays Safeword's only while package.json
   * still has that range; once the project changes it, the package is the
   * project's (full uninstall keeps it, lint treats the app by its own stack).
   */
  ownedPackages?: Record<string, string>;
  architectureDocEnforcement?: boolean;
  autoUpgrade?: boolean;
  /** SQL pack options — `fix: true` opts in to edit-time `sqlfluff fix` (#638). */
  sql?: { fix?: boolean };
}

function readConfig(cwd: string): SafewordConfig | undefined {
  const configPath = nodePath.join(cwd, CONFIG_PATH);
  const content = readFileSafe(configPath);
  if (!content) return undefined;
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError('Safeword config must be an object.');
  }
  const config = parsed as SafewordConfig;
  if (config.installedPacks !== undefined && !Array.isArray(config.installedPacks)) {
    throw new TypeError('Safeword config installedPacks must be an array.');
  }
  return config;
}

function writeConfig(cwd: string, config: SafewordConfig): void {
  const configPath = nodePath.join(cwd, CONFIG_PATH);
  writeFile(configPath, JSON.stringify(config, undefined, 2));
}

/** Same syntax as --agents, including the explicit project-only selection "none". */
export function projectInstallAgents(cwd: string): string | undefined {
  return readConfig(cwd)?.installAgents;
}

export function installAgentsNeedUpdate(cwd: string, agents?: string): boolean {
  return agents !== undefined && projectInstallAgents(cwd) !== agents;
}

export function rememberProjectInstallAgents(cwd: string, agents?: string): void {
  if (agents === undefined) return;
  const config = readConfig(cwd) ?? {};
  if (config.installAgents === agents) return;
  writeConfig(cwd, { ...config, installAgents: agents });
}

/**
 * Check if auto-upgrade is enabled for this project.
 * Env vars override config: SAFEWORD_NO_AUTO_UPGRADE or CI disables.
 * Config file: autoUpgrade defaults to true when absent.
 */
export function shouldAutoUpgrade(cwd: string): boolean {
  if (process.env.SAFEWORD_NO_AUTO_UPGRADE) return false;
  if (process.env.CI) return false;
  const config = readConfig(cwd);
  return config?.autoUpgrade !== false;
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

/** Preserve legacy installs while making the first setup explicitly local-only. */
export function applyFreshInstallDefaults(cwd: string): void {
  if (!freshInstallDefaultsNeedUpdate(cwd)) return;
  const config = readConfig(cwd) ?? { installedPacks: [] };
  config.architectureDocEnforcement = false;
  writeConfig(cwd, config);
}

export function freshInstallDefaultsNeedUpdate(cwd: string): boolean {
  return readConfig(cwd)?.architectureDocEnforcement === undefined;
}

/**
 * Add a pack to the installed packs list.
 * Creates config.json if it doesn't exist.
 */
export function addInstalledPack(cwd: string, packId: string): void {
  const config = readConfig(cwd) ?? { installedPacks: [] };
  const installedPacks = config.installedPacks ?? [];

  if (!installedPacks.includes(packId)) {
    config.installedPacks = [...installedPacks, packId];
    writeConfig(cwd, config);
  }
}

/** The project's declared dependencies (dev and runtime) with their ranges. */
function readDeclaredDependencies(cwd: string): Record<string, string> {
  const manifest = readFileSafe(nodePath.join(cwd, 'package.json'));
  if (!manifest) return {};
  const { dependencies = {}, devDependencies = {} } = JSON.parse(manifest) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return { ...dependencies, ...devDependencies };
}

/** The ownership record as written, ignoring anything malformed. */
function readOwnershipRecord(cwd: string): Record<string, string> {
  const owned = readConfig(cwd)?.ownedPackages;
  if (typeof owned !== 'object' || owned === null || Array.isArray(owned)) return {};
  return Object.fromEntries(Object.entries(owned).filter(([, range]) => typeof range === 'string'));
}

/**
 * Packages that are still Safeword's: recorded, and still declared with the
 * range Safeword added.
 *
 * @param cwd - Project root directory
 * @returns Package names (no version specifiers)
 */
export function getOwnedPackages(cwd: string): string[] {
  const declared = readDeclaredDependencies(cwd);
  return Object.entries(readOwnershipRecord(cwd))
    .filter(([name, range]) => declared[name] === range)
    .map(([name]) => name);
}

/**
 * Record, as Safeword-owned, each of `names` that package.json now declares,
 * with the range it declares. Install only adds these packages when the project
 * lacked them, so a declaration present after an install attempt is Safeword's,
 * even when the package manager saved it and then failed. A name already in the
 * record keeps its original range, so a project that changed the range keeps
 * the package. Writes only when a name is new.
 *
 * @param cwd - Project root directory
 * @param names - Package names (no version specifiers) install tried to add
 */
export function recordOwnedPackages(cwd: string, names: readonly string[]): void {
  const declared = readDeclaredDependencies(cwd);
  const record = readOwnershipRecord(cwd);
  const added = names.flatMap(name => {
    const range = declared[name];
    return range === undefined || Object.hasOwn(record, name) ? [] : [[name, range] as const];
  });
  if (added.length === 0) return;
  const config = readConfig(cwd) ?? { installedPacks: [] };
  config.ownedPackages = { ...record, ...Object.fromEntries(added) };
  writeConfig(cwd, config);
}
