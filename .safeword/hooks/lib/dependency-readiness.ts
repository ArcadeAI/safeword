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
const BUN_OPTIONS_WITH_VALUES = new Set([
  '--config',
  '--conditions',
  '--cwd',
  '--env-file',
  '--import',
  '--install',
  '--preload',
  '--require',
  '-c',
  '-r',
]);
const ENV_OPTIONS_WITH_VALUES = new Set(['--argv0', '--chdir', '--unset', '-a', '-C', '-u']);
const PACKAGE_MANAGER_OPTIONS_WITH_VALUES = new Set([
  '--cwd',
  '--dir',
  '--filter',
  '--prefix',
  '--workspace',
  '-C',
  '-F',
  '-w',
]);
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
  const segments = splitShellSegments(command);

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
  const words = stripExecutionPrefixes(tokenizeShellWords(segment));
  const [binary, ...args] = words;
  if (binary === undefined) return false;

  const basename = nodePath.basename(binary);

  if (binary.includes('node_modules/.bin/')) return true;

  if (basename === 'bun') {
    return isBunDependencyBackedCommand(args);
  }

  if (basename === 'bunx') return true;

  if (basename === 'npx' || basename === 'pnpx' || basename === 'pnx') {
    return isKnownBinaryPackageExecutor(args);
  }

  if (basename === 'npm') {
    return isNpmDependencyBackedCommand(args);
  }

  if (basename === 'pnpm' || basename === 'yarn') {
    return isPackageManagerDependencyBackedCommand(args);
  }

  return DEPENDENCY_BINARIES.has(basename);
}

function isBunDependencyBackedCommand(args: string[]): boolean {
  const subcommand = firstCommandArgument(args, BUN_OPTIONS_WITH_VALUES);
  return subcommand === 'run' || subcommand === 'test';
}

function isNpmDependencyBackedCommand(args: string[]): boolean {
  const subcommand = firstCommandArgument(args, PACKAGE_MANAGER_OPTIONS_WITH_VALUES);
  return subcommand === 'run' || subcommand === 'test' || subcommand === 'exec';
}

function isPackageManagerDependencyBackedCommand(args: string[]): boolean {
  const subcommand = firstCommandArgument(args, PACKAGE_MANAGER_OPTIONS_WITH_VALUES);
  return (
    subcommand === 'run' ||
    subcommand === 'test' ||
    subcommand === 'exec' ||
    (subcommand !== undefined && DEPENDENCY_BINARIES.has(subcommand))
  );
}

function isKnownBinaryPackageExecutor(args: string[]): boolean {
  const target = firstCommandArgument(args, PACKAGE_MANAGER_OPTIONS_WITH_VALUES);
  return target !== undefined && DEPENDENCY_BINARIES.has(target);
}

function firstCommandArgument(
  args: string[],
  optionsWithValues: ReadonlySet<string>,
): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;

    if (arg === '--') {
      return args[index + 1];
    }

    if (!arg.startsWith('-') || arg === '-') {
      return arg;
    }

    if (optionsWithValues.has(arg) && !arg.includes('=')) {
      index += 1;
    }
  }

  return undefined;
}

function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const next = command[index + 1];

    if (char === undefined) continue;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      current += char;
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      current += char;
      if (char === quote) quote = undefined;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === '\n' || char === ';') {
      pushSegment(segments, current);
      current = '';
      continue;
    }

    if ((char === '&' && next === '&') || (char === '|' && next === '|')) {
      pushSegment(segments, current);
      current = '';
      index += 1;
      continue;
    }

    if (char === '|') {
      pushSegment(segments, current);
      current = '';
      continue;
    }

    current += char;
  }

  pushSegment(segments, current);
  return segments;
}

function pushSegment(segments: string[], segment: string): void {
  const trimmed = segment.trim();
  if (trimmed.length > 0) segments.push(trimmed);
}

function tokenizeShellWords(segment: string): string[] {
  const words: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (char === undefined) continue;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      pushWord(words, current);
      current = '';
      continue;
    }

    current += char;
  }

  pushWord(words, current);
  return words;
}

function pushWord(words: string[], word: string): void {
  if (word.length > 0) words.push(word);
}

function stripExecutionPrefixes(words: string[]): string[] {
  let remaining = words;

  while (remaining.length > 0) {
    remaining = stripLeadingEnvironmentAssignments(remaining);
    const [binary, ...args] = remaining;
    if (binary === undefined) return [];

    const basename = nodePath.basename(binary);
    if (basename === 'env') {
      remaining = stripEnvInvocation(args);
      continue;
    }

    if (basename === 'corepack') {
      remaining = args;
      continue;
    }

    return remaining;
  }

  return remaining;
}

function stripLeadingEnvironmentAssignments(words: string[]): string[] {
  let index = 0;
  while (index < words.length && isEnvironmentAssignment(words[index] ?? '')) {
    index += 1;
  }
  return words.slice(index);
}

function stripEnvInvocation(args: string[]): string[] {
  let index = 0;

  while (index < args.length) {
    const arg = args[index];
    if (arg === undefined) break;

    if (isEnvironmentAssignment(arg)) {
      index += 1;
      continue;
    }

    if (arg === '--') {
      index += 1;
      break;
    }

    if (ENV_OPTIONS_WITH_VALUES.has(arg) && !arg.includes('=')) {
      index += 2;
      continue;
    }

    if (arg.startsWith('-')) {
      index += 1;
      continue;
    }

    break;
  }

  return args.slice(index);
}

function isEnvironmentAssignment(word: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(word);
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
