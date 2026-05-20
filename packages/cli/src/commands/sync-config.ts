/**
 * Sync Config command - Regenerate depcruise config from current project structure
 *
 * Used by `/audit` slash command to refresh config before running checks.
 */

import { writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { detectArchitecture } from '../utils/boundaries.js';
import {
  type DepCruiseArchitecture,
  detectWorkspaces,
  generateDepCruiseConfigFile,
  generateDepCruiseMainConfig,
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
export function syncConfigCore(cwd: string, arch: DepCruiseArchitecture): SyncConfigResult {
  const safewordDirectory = nodePath.join(cwd, '.safeword');
  const result: SyncConfigResult = {
    generatedConfig: false,
    createdMainConfig: false,
  };

  // Generate and write .safeword/depcruise-config.cjs (CJS for compatibility)
  const generatedConfigPath = nodePath.join(safewordDirectory, 'depcruise-config.cjs');
  const generatedConfig = generateDepCruiseConfigFile(arch);
  writeFileSync(generatedConfigPath, generatedConfig);
  result.generatedConfig = true;

  // Create main config if not exists (self-healing)
  // Use .cjs extension to work in ESM projects (type: "module")
  const mainConfigPath = nodePath.join(cwd, '.dependency-cruiser.cjs');
  if (!exists(mainConfigPath)) {
    const mainConfig = generateDepCruiseMainConfig();
    writeFileSync(mainConfigPath, mainConfig);
    result.createdMainConfig = true;
  }

  return result;
}

/**
 * Build full architecture info by combining detected layers with workspaces
 */
export function buildArchitecture(cwd: string): DepCruiseArchitecture {
  const arch = detectArchitecture(cwd);
  const workspaces = detectWorkspaces(cwd);
  return { ...arch, workspaces };
}

/**
 * Check if architecture was detected (layers, monorepo structure, or workspaces)
 */
export function hasArchitectureDetected(arch: DepCruiseArchitecture): boolean {
  return arch.elements.length > 0 || arch.isMonorepo || (arch.workspaces?.length ?? 0) > 0;
}

/**
 * CLI command: Sync depcruise config with current project structure
 */

export async function syncConfig(): Promise<void> {
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

  // Detect current architecture and workspaces
  const arch = buildArchitecture(cwd);
  const result = syncConfigCore(cwd, arch);

  if (result.generatedConfig) {
    info('Generated .safeword/depcruise-config.cjs');
  }
  if (result.createdMainConfig) {
    info('Created .dependency-cruiser.cjs');
  }

  success('Config synced');
}
