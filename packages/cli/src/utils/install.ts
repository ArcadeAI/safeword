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

function pnpmWorkspaceFlags(pm: PackageManager, cwd: string): string[] {
  return pm === 'pnpm' && isPnpmWorkspace(cwd) ? ['-w'] : [];
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

export interface DependencyInstallResult {
  readonly attempted: boolean;
  readonly installed: boolean;
  readonly command?: string;
  readonly error?: string;
}

function reportInstallStart(label: string, command: string): void {
  info(`\nInstalling ${label}...`);
  info(`Running: ${command}`);
}

function reportInstallFailure(label: string, command: string): void {
  warn(`Failed to install ${label}. Run manually:`);
  listItem(command);
}

function reportWhen(enabled: boolean, report: () => void): void {
  if (enabled) report();
}

export function installDependencies(
  cwd: string,
  packages: string[],
  label = 'packages',
  options: { report?: boolean } = {},
): DependencyInstallResult {
  if (packages.length === 0 || process.env.SAFEWORD_SKIP_INSTALL) {
    return { attempted: false, installed: false };
  }

  const pm = detectPackageManager(cwd);
  const { install } = PM_COMMANDS[pm];
  // pnpm workspaces require -w to install at the workspace root
  const extraFlags = pnpmWorkspaceFlags(pm, cwd);
  const flagString = extraFlags.length > 0 ? ` ${extraFlags.join(' ')}` : '';
  const displayCommand = `${pm} ${install} ${DEV_FLAG}${flagString} ${packages.join(' ')}`;

  reportWhen(options.report !== false, () => {
    reportInstallStart(label, displayCommand);
  });

  try {
    execFileSync(pm, [install, DEV_FLAG, ...extraFlags, ...packages], {
      cwd,
      stdio: 'pipe',
      timeout: 120_000,
    });
    reportWhen(options.report !== false, () => {
      success(`Installed ${label}`);
    });
    return { attempted: true, installed: true, command: displayCommand };
  } catch (installError) {
    reportWhen(options.report !== false, () => {
      reportInstallFailure(label, displayCommand);
    });
    return {
      attempted: true,
      installed: false,
      command: displayCommand,
      error: installError instanceof Error ? installError.message : String(installError),
    };
  }
}

export function uninstallDependencies(
  cwd: string,
  packages: string[],
  options: { report?: boolean } = {},
): DependencyInstallResult {
  if (packages.length === 0 || process.env.SAFEWORD_SKIP_INSTALL) {
    return { attempted: false, installed: false };
  }
  const pm = detectPackageManager(cwd);
  const { uninstall } = PM_COMMANDS[pm];
  const extraFlags = pnpmWorkspaceFlags(pm, cwd);
  const displayCommand =
    `${pm} ${uninstall} ${extraFlags.join(' ')} ${packages.join(' ')}`.replaceAll(/\s+/g, ' ');
  try {
    execFileSync(pm, [uninstall, ...extraFlags, ...packages], {
      cwd,
      stdio: 'pipe',
      timeout: 120_000,
    });
    reportWhen(options.report !== false, () => {
      success('Uninstalled Safeword packages');
    });
    return { attempted: true, installed: true, command: displayCommand };
  } catch (uninstallError) {
    reportWhen(options.report !== false, () => {
      warn('Failed to uninstall Safeword packages. Run manually:');
      listItem(displayCommand);
    });
    return {
      attempted: true,
      installed: false,
      command: displayCommand,
      error: uninstallError instanceof Error ? uninstallError.message : String(uninstallError),
    };
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
