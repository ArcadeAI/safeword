/**
 * Shared installation utilities
 *
 * Package manager detection and MCP server constants.
 * Operations are handled by reconcile() in src/reconcile.ts.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { info, listItem, success, warn } from './output.js';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

/** Dev-dependency flag, shared across all package managers. */
const DEV_FLAG = '-D';

/**
 * Package manager command definitions.
 * Single source of truth for install/uninstall args across all managers.
 */
const PM_COMMANDS: Record<PackageManager, { install: string; uninstall: string }> = {
  npm: { install: 'install', uninstall: 'uninstall' },
  yarn: { install: 'add', uninstall: 'remove' },
  pnpm: { install: 'add', uninstall: 'remove' },
  bun: { install: 'add', uninstall: 'remove' },
};

function isPnpmWorkspace(cwd: string): boolean {
  return existsSync(path.join(cwd, 'pnpm-workspace.yaml'));
}

/**
 * Detect package manager by lockfile and workspace config.
 * pnpm-workspace.yaml takes priority over bun.lockb — catalog: protocol
 * requires pnpm even when a bun lockfile also exists.
 */
export function detectPackageManager(cwd: string): PackageManager {
  if (isPnpmWorkspace(cwd)) return 'pnpm';
  if (existsSync(path.join(cwd, 'bun.lockb')) || existsSync(path.join(cwd, 'bun.lock')))
    return 'bun';
  if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (existsSync(path.join(cwd, 'package-lock.json'))) return 'npm';
  // No lockfile found — fall back to current runtime (bun) or npm
  if (process.versions.bun) return 'bun';
  return 'npm';
}

/**
 * Get uninstall command for package manager
 */
export function getUninstallCommand(pm: PackageManager, packages: string[]): string {
  const { uninstall } = PM_COMMANDS[pm];
  return `${pm} ${uninstall} ${packages.join(' ')}`;
}

/**
 * Install packages using detected package manager
 */
export function installDependencies(cwd: string, packages: string[], label = 'packages'): void {
  if (packages.length === 0) return;
  if (process.env.SAFEWORD_SKIP_INSTALL) return;

  const pm = detectPackageManager(cwd);
  const { install } = PM_COMMANDS[pm];
  // pnpm workspaces require -w to install at the workspace root
  const extraFlags = pm === 'pnpm' && isPnpmWorkspace(cwd) ? ['-w'] : [];
  const flagString = extraFlags.length > 0 ? ` ${extraFlags.join(' ')}` : '';
  const displayCommand = `${pm} ${install} ${DEV_FLAG}${flagString} ${packages.join(' ')}`;

  info(`\nInstalling ${label}...`);
  info(`Running: ${displayCommand}`);

  try {
    execFileSync(pm, [install, DEV_FLAG, ...extraFlags, ...packages], {
      cwd,
      stdio: 'pipe',
      timeout: 120_000,
    });
    success(`Installed ${label}`);
  } catch {
    warn(`Failed to install ${label}. Run manually:`);
    listItem(displayCommand);
  }
}

/**
 * MCP servers installed by safeword
 */
export const MCP_SERVERS = {
  context7: {
    url: 'https://mcp.context7.com/mcp',
  },
  playwright: {
    command: 'bunx',
    args: ['@playwright/mcp@latest'],
  },
} as const;
