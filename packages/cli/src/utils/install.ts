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

/**
 * Detect package manager by lockfile (bun > pnpm > yarn > npm)
 */
export function detectPackageManager(cwd: string): PackageManager {
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
 * Get install command args for package manager
 */
function getInstallArguments(pm: PackageManager): string[] {
  const args: Record<PackageManager, string[]> = {
    npm: ['install', '-D'],
    yarn: ['add', '-D'],
    pnpm: ['add', '-D'],
    bun: ['add', '-D'],
  };
  return args[pm];
}

/**
 * Get display command for logging
 */
function getInstallCommand(pm: PackageManager, packages: string[]): string {
  const cmds: Record<PackageManager, string> = {
    npm: `npm install -D ${packages.join(' ')}`,
    yarn: `yarn add -D ${packages.join(' ')}`,
    pnpm: `pnpm add -D ${packages.join(' ')}`,
    bun: `bun add -D ${packages.join(' ')}`,
  };
  return cmds[pm];
}

/**
 * Get uninstall command for package manager
 */
export function getUninstallCommand(pm: PackageManager, packages: string[]): string {
  const cmds: Record<PackageManager, string> = {
    npm: `npm uninstall ${packages.join(' ')}`,
    yarn: `yarn remove ${packages.join(' ')}`,
    pnpm: `pnpm remove ${packages.join(' ')}`,
    bun: `bun remove ${packages.join(' ')}`,
  };
  return cmds[pm];
}

/**
 * Install packages using detected package manager
 */
export function installDependencies(cwd: string, packages: string[], label = 'packages'): void {
  if (packages.length === 0) return;

  const pm = detectPackageManager(cwd);
  const displayCmd = getInstallCommand(pm, packages);

  info(`\nInstalling ${label}...`);
  info(`Running: ${displayCmd}`);

  try {
    const args = [...getInstallArguments(pm), ...packages];
    execFileSync(pm, args, { cwd, stdio: 'inherit' });
    success(`Installed ${label}`);
  } catch {
    warn(`Failed to install ${label}. Run manually:`);
    listItem(displayCmd);
  }
}

/**
 * MCP servers installed by safeword
 */
export const MCP_SERVERS = {
  context7: {
    command: 'bunx',
    args: ['@upstash/context7-mcp@latest'],
  },
  playwright: {
    command: 'bunx',
    args: ['@playwright/mcp@latest'],
  },
} as const;
