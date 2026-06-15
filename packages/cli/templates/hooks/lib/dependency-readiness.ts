import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './namespace-root.js';

export type DependencyManager = 'bun';
export type DependencyReadinessStatus = 'ready' | 'missing' | 'stale' | 'unsupported';

export interface InstallCommand {
  binary: string;
  args: string[];
  display: string;
}

export interface DependencyPlan {
  manager: DependencyManager;
  installCommand: InstallCommand;
  installArtifact: string;
  inputPaths: string[];
}

export interface DependencyReadiness {
  status: DependencyReadinessStatus;
  reason:
    | 'install_artifact_current'
    | 'install_artifact_missing'
    | 'install_artifact_stale'
    | 'no_supported_package_manager';
  installCommand?: string;
  fingerprint?: string;
  plan?: DependencyPlan;
}

export interface DependencyBootstrapConfig {
  autoInstall: boolean;
}

export interface DependencyReadinessState {
  status: DependencyReadinessStatus | 'failed';
  reason?: string;
  fingerprint?: string;
  installCommand?: string;
  message?: string;
  updatedAt: string;
}

const INSTALL_ARTIFACT = 'node_modules';
const DEPENDENCY_STATE_FILENAME = 'dependency-readiness.json';
const BUN_LOCKFILES = ['bun.lock', 'bun.lockb'];
const DEPENDENCY_BINARIES = new Set([
  'cypress',
  'dependency-cruiser',
  'depcruise',
  'eslint',
  'gherkin-lint',
  'jest',
  'jscpd',
  'next',
  'playwright',
  'prettier',
  'tsc',
  'tsup',
  'tsx',
  'turbo',
  'vite',
  'vitest',
]);

export function detectDependencyPlan(projectDirectory: string): DependencyPlan | undefined {
  const packageJson = readJsonFile<Record<string, unknown>>(
    nodePath.join(projectDirectory, 'package.json'),
  );
  if (packageJson === undefined) return undefined;

  const bunLockfile = BUN_LOCKFILES.find(lockfile =>
    existsSync(nodePath.join(projectDirectory, lockfile)),
  );
  const packageManager = packageJson.packageManager;
  const usesBun =
    (typeof packageManager === 'string' && packageManager.startsWith('bun@')) ||
    bunLockfile !== undefined;

  if (!usesBun || bunLockfile === undefined) return undefined;

  const inputPaths = uniqueSorted([
    'package.json',
    bunLockfile,
    ...collectWorkspacePackageJsonPaths(projectDirectory, packageJson),
  ]);

  return {
    manager: 'bun',
    installCommand: {
      binary: 'bun',
      args: ['ci'],
      display: 'bun ci',
    },
    installArtifact: INSTALL_ARTIFACT,
    inputPaths,
  };
}

export function dependencyInputFingerprint(projectDirectory: string, plan: DependencyPlan): string {
  const hash = createHash('sha256');

  for (const inputPath of plan.inputPaths.toSorted()) {
    hash.update(inputPath);
    hash.update('\0');
    try {
      hash.update(readFileSync(nodePath.join(projectDirectory, inputPath)));
    } catch {
      hash.update('<missing>');
    }
    hash.update('\0');
  }

  return hash.digest('hex');
}

export function getDependencyReadiness(projectDirectory: string): DependencyReadiness {
  const plan = detectDependencyPlan(projectDirectory);
  if (plan === undefined) {
    return {
      status: 'unsupported',
      reason: 'no_supported_package_manager',
    };
  }

  const fingerprint = dependencyInputFingerprint(projectDirectory, plan);
  const installCommand = plan.installCommand.display;
  const artifactPath = nodePath.join(projectDirectory, plan.installArtifact);

  if (!isDirectory(artifactPath)) {
    return {
      status: 'missing',
      reason: 'install_artifact_missing',
      installCommand,
      fingerprint,
      plan,
    };
  }

  if (isInstallArtifactStale(projectDirectory, plan, artifactPath)) {
    return {
      status: 'stale',
      reason: 'install_artifact_stale',
      installCommand,
      fingerprint,
      plan,
    };
  }

  return {
    status: 'ready',
    reason: 'install_artifact_current',
    installCommand,
    fingerprint,
    plan,
  };
}

export function readDependencyBootstrapConfig(projectDirectory: string): DependencyBootstrapConfig {
  const configPath = nodePath.join(projectDirectory, '.safeword', 'config.json');
  const parsed = readJsonFile<{ dependencyBootstrap?: { autoInstall?: unknown } }>(configPath);

  return {
    autoInstall: parsed?.dependencyBootstrap?.autoInstall === true,
  };
}

export function isDependencyBackedCommand(command: string): boolean {
  const segments = command
    .split(/\n|&&|\|\||;/)
    .map(segment => segment.trim())
    .filter(Boolean);

  return segments.some(segment => isDependencyBackedSegment(segment));
}

export function getDependencyReadinessStatePath(projectDirectory: string): string {
  return nodePath.join(resolveNamespaceRoot(projectDirectory), DEPENDENCY_STATE_FILENAME);
}

export function writeDependencyReadinessState(
  projectDirectory: string,
  state: Omit<DependencyReadinessState, 'updatedAt'> & { updatedAt?: string },
): void {
  try {
    const statePath = getDependencyReadinessStatePath(projectDirectory);
    mkdirSync(nodePath.dirname(statePath), { recursive: true });
    writeFileSync(
      statePath,
      JSON.stringify(
        {
          ...state,
          updatedAt: state.updatedAt ?? new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch {
    // Hook state is best-effort. Readiness enforcement should not crash because
    // a namespace directory is unwritable or temporarily unavailable.
  }
}

export function readDependencyReadinessState(
  projectDirectory: string,
): DependencyReadinessState | undefined {
  return readJsonFile<DependencyReadinessState>(getDependencyReadinessStatePath(projectDirectory));
}

export function toDependencyReadinessState(
  readiness: DependencyReadiness,
): Omit<DependencyReadinessState, 'updatedAt'> {
  return {
    status: readiness.status,
    reason: readiness.reason,
    fingerprint: readiness.fingerprint,
    installCommand: readiness.installCommand,
  };
}

export function formatDependencyRecovery(readiness: DependencyReadiness): string {
  const installCommand = readiness.installCommand ?? 'install dependencies';
  const problem =
    readiness.status === 'stale'
      ? 'dependency inputs changed after the last install'
      : 'dependencies are not installed in this worktree';

  return [
    `SAFEWORD: ${problem}.`,
    `Run \`${installCommand}\` from the project root, then retry the command.`,
  ].join('\n');
}

function collectWorkspacePackageJsonPaths(
  projectDirectory: string,
  rootPackageJson: Record<string, unknown>,
): string[] {
  const patterns = readWorkspacePatterns(rootPackageJson);
  const packageJsonPaths: string[] = [];

  for (const pattern of patterns) {
    packageJsonPaths.push(...expandWorkspacePattern(projectDirectory, pattern));
  }

  return packageJsonPaths;
}

function readWorkspacePatterns(rootPackageJson: Record<string, unknown>): string[] {
  const rawWorkspaces = rootPackageJson.workspaces;

  if (Array.isArray(rawWorkspaces)) {
    return rawWorkspaces.filter((value): value is string => typeof value === 'string');
  }

  if (
    rawWorkspaces !== null &&
    typeof rawWorkspaces === 'object' &&
    Array.isArray((rawWorkspaces as { packages?: unknown }).packages)
  ) {
    return (rawWorkspaces as { packages: unknown[] }).packages.filter(
      (value): value is string => typeof value === 'string',
    );
  }

  return [];
}

function expandWorkspacePattern(projectDirectory: string, pattern: string): string[] {
  const normalizedPattern = pattern.replaceAll('\\', '/').replace(/^\.?\//, '');
  if (normalizedPattern.includes('**')) return [];

  const starIndex = normalizedPattern.indexOf('*');
  if (starIndex === -1) {
    const packageJsonPath = normalizedPattern.endsWith('/package.json')
      ? normalizedPattern
      : `${normalizedPattern.replace(/\/$/, '')}/package.json`;
    return existsSync(nodePath.join(projectDirectory, packageJsonPath)) ? [packageJsonPath] : [];
  }

  const prefix = normalizedPattern.slice(0, starIndex);
  const suffix = normalizedPattern.slice(starIndex + 1);
  if (suffix.includes('*')) return [];

  const baseDirectory = nodePath.join(projectDirectory, prefix);
  if (!isDirectory(baseDirectory)) return [];

  return readdirSync(baseDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const expanded = `${prefix}${entry.name}${suffix}`;
      return expanded.endsWith('/package.json')
        ? expanded
        : `${expanded.replace(/\/$/, '')}/package.json`;
    })
    .filter(relativePath => existsSync(nodePath.join(projectDirectory, relativePath)));
}

function isDependencyBackedSegment(segment: string): boolean {
  const normalized = stripLeadingEnvironmentAssignments(segment);
  if (normalized.length === 0) return false;
  if (isInstallSegment(normalized)) return false;

  const [rawBinary, ...args] = normalized.split(/\s+/);
  if (rawBinary === undefined) return false;

  const binary = rawBinary.replace(/^["']|["']$/g, '');
  const basename = nodePath.basename(binary);

  if (binary.includes('node_modules/.bin/')) return true;

  if (basename === 'bun') {
    return args[0] === 'run' || args[0] === 'test';
  }

  if (basename === 'bunx') return true;

  if (basename === 'npm' || basename === 'pnpm' || basename === 'yarn') {
    return args[0] === 'run' || args[0] === 'test';
  }

  return DEPENDENCY_BINARIES.has(basename);
}

function isInstallSegment(segment: string): boolean {
  return /^(bun|npm|pnpm|yarn)\s+(ci|install|i|add|remove|rm|update|upgrade)\b/.test(segment);
}

function stripLeadingEnvironmentAssignments(segment: string): string {
  let remaining = segment.trim();

  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(remaining)) {
    const [, rest = ''] = remaining.match(/^[A-Za-z_][A-Za-z0-9_]*=\S+\s*(.*)$/) ?? [];
    remaining = rest.trim();
  }

  return remaining;
}

function isInstallArtifactStale(
  projectDirectory: string,
  plan: DependencyPlan,
  artifactPath: string,
): boolean {
  const artifactMtime = getMtimeMs(artifactPath);
  if (artifactMtime === undefined) return true;

  const latestInputMtime = Math.max(
    ...plan.inputPaths.map(
      inputPath => getMtimeMs(nodePath.join(projectDirectory, inputPath)) ?? 0,
    ),
  );

  return artifactMtime + 1000 < latestInputMtime;
}

function readJsonFile<T>(filePath: string): T | undefined {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function getMtimeMs(path: string): number | undefined {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return undefined;
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].toSorted();
}
