/**
 * Sync Config command - Regenerate depcruise config from current project structure
 *
 * Default mode writes config to disk. `--check` mode reports drift without writing —
 * used by `/audit` to detect stale config without polluting the working tree.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { detectArchitecture } from '../utils/boundaries.js';
import {
  type DependencyCruiseArchitecture,
  detectWorkspaces,
  generateDependencyCruiseConfigFile,
  generateDependencyCruiseMainConfig,
} from '../utils/depcruise-config.js';
import { exists } from '../utils/fs.js';
import { error, info, success } from '../utils/output.js';

interface SyncConfigResult {
  generatedConfig: boolean;
  createdMainConfig: boolean;
}

/**
 * Core sync logic - writes depcruise configs to disk
 * Can be called from setup or as standalone command
 */
export function syncConfigCore(cwd: string, arch: DependencyCruiseArchitecture): SyncConfigResult {
  const safewordDirectory = nodePath.join(cwd, '.safeword');
  const result: SyncConfigResult = {
    generatedConfig: false,
    createdMainConfig: false,
  };

  // Generate and write .safeword/depcruise-config.cjs (CJS for compatibility)
  const generatedConfigPath = nodePath.join(safewordDirectory, 'depcruise-config.cjs');
  const generatedConfig = generateDependencyCruiseConfigFile(arch);
  writeFileSync(generatedConfigPath, generatedConfig);
  result.generatedConfig = true;

  // Create main config if not exists (self-healing)
  // Use .cjs extension to work in ESM projects (type: "module")
  const mainConfigPath = nodePath.join(cwd, '.dependency-cruiser.cjs');
  if (!exists(mainConfigPath)) {
    const mainConfig = generateDependencyCruiseMainConfig();
    writeFileSync(mainConfigPath, mainConfig);
    result.createdMainConfig = true;
  }

  return result;
}

/**
 * Build full architecture info by combining detected layers with workspaces
 */
export function buildArchitecture(cwd: string): DependencyCruiseArchitecture {
  const arch = detectArchitecture(cwd);
  const workspaces = detectWorkspaces(cwd);
  return { ...arch, workspaces };
}

/**
 * Check if architecture was detected (layers, monorepo structure, or workspaces)
 */
export function hasArchitectureDetected(arch: DependencyCruiseArchitecture): boolean {
  return arch.elements.length > 0 || arch.isMonorepo || (arch.workspaces?.length ?? 0) > 0;
}

/**
 * Check if generated config matches on-disk content. No writes.
 * Returns { matches: true } when bytes are byte-equal.
 * Returns { matches: false, reason } when on-disk is missing or differs.
 */
function checkConfig(
  cwd: string,
  arch: DependencyCruiseArchitecture,
): { matches: true } | { matches: false; reason: 'missing' | 'drifted' } {
  const generatedConfigPath = nodePath.join(cwd, '.safeword', 'depcruise-config.cjs');
  if (!exists(generatedConfigPath)) {
    return { matches: false, reason: 'missing' };
  }
  const generated = generateDependencyCruiseConfigFile(arch);
  const onDisk = readFileSync(generatedConfigPath, 'utf8');
  return generated === onDisk ? { matches: true } : { matches: false, reason: 'drifted' };
}

/**
 * CLI command: Sync depcruise config with current project structure
 */

export async function syncConfig(options: { check?: boolean } = {}): Promise<void> {
  // Public CLI command contract is Promise<void>; body is sync today but the
  // signature reserves room for async I/O. Token await keeps the contract honest.
  await Promise.resolve();
  const cwd = process.cwd();
  const safewordDirectory = nodePath.join(cwd, '.safeword');

  // Check if .safeword exists
  if (!exists(safewordDirectory)) {
    error('Not configured. Run `safeword setup` first.');
    process.exit(1);
  }

  const arch = buildArchitecture(cwd);

  if (options.check) {
    const result = checkConfig(cwd, arch);
    if (result.matches) {
      success('Config in sync');
      return;
    }
    const message =
      result.reason === 'missing'
        ? 'Missing .safeword/depcruise-config.cjs — run `safeword sync-config` to generate it.'
        : 'Stale .safeword/depcruise-config.cjs — run `safeword sync-config` to refresh.';
    error(message);
    process.exit(1);
  }

  const result = syncConfigCore(cwd, arch);

  if (result.generatedConfig) {
    info('Generated .safeword/depcruise-config.cjs');
  }
  if (result.createdMainConfig) {
    info('Created .dependency-cruiser.cjs');
  }

  success('Config synced');
}
