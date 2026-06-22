import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  type Dirent,
} from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './namespace-root.js';

export type DependencyManager = 'bun' | 'pnpm' | 'npm' | 'yarn';
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
const INSTALL_MARKER_FILENAME = '.safeword-deps-fingerprint';
const DEPENDENCY_STATE_FILENAME = 'dependency-readiness.json';
const BUN_LOCKFILES = ['bun.lock', 'bun.lockb'];
const WORKSPACE_SCAN_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.project',
  '.safeword',
  '.safeword-project',
  'node_modules',
]);
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
const PACKAGE_SCRIPT_COMMANDS = new Set(['run', 'test']);
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

const MANAGER_LOCKFILES: Record<DependencyManager, readonly string[]> = {
  bun: BUN_LOCKFILES,
  pnpm: ['pnpm-lock.yaml'],
  npm: ['package-lock.json'],
  yarn: ['yarn.lock'],
};

// Lockfile-only precedence when nothing declares a manager — mirrors install.ts:
// a bun lockfile beats pnpm-lock.yaml, then yarn.lock, then package-lock.json.
const LOCKFILE_PRECEDENCE: readonly DependencyManager[] = ['bun', 'pnpm', 'yarn', 'npm'];

export function detectDependencyPlan(projectDirectory: string): DependencyPlan | undefined {
  const packageJson = readJsonFile<Record<string, unknown>>(
    nodePath.join(projectDirectory, 'package.json'),
  );
  if (packageJson === undefined) return undefined;

  const packageManager =
    typeof packageJson.packageManager === 'string' ? packageJson.packageManager : undefined;

  switch (detectDependencyManager(projectDirectory, packageManager)) {
    case 'bun':
      return buildBunPlan(projectDirectory, packageJson);
    case 'pnpm':
      return buildPnpmPlan(projectDirectory);
    case 'npm':
      return buildNpmPlan(projectDirectory, packageJson);
    case 'yarn':
      return buildYarnPlan(projectDirectory, packageJson, packageManager);
    default:
      return undefined;
  }
}

/**
 * Resolve the readiness-supported package manager (bun, pnpm, npm, or yarn), or
 * undefined when unsupported. An explicit `packageManager` declaration is
 * authoritative (honored when its lockfile exists); otherwise a pnpm workspace
 * forces pnpm (beats a coexisting bun lockfile — mirrors install.ts); otherwise
 * the manager is chosen by lockfile in install.ts precedence (bun > pnpm-lock >
 * yarn > npm). Every manager requires its lockfile to produce a plan, so a
 * declared-but-uninstalled manager (or a stray foreign lockfile in another
 * manager's project) abstains rather than misfiring (#321/#323/#327).
 */
function detectDependencyManager(
  projectDirectory: string,
  packageManager: string | undefined,
): DependencyManager | undefined {
  const declared = parseDeclaredManager(packageManager);
  if (declared !== undefined) {
    return managerLockfilePresent(projectDirectory, declared) ? declared : undefined;
  }

  if (existsSync(nodePath.join(projectDirectory, 'pnpm-workspace.yaml'))) {
    return managerLockfilePresent(projectDirectory, 'pnpm') ? 'pnpm' : undefined;
  }

  return LOCKFILE_PRECEDENCE.find(manager => managerLockfilePresent(projectDirectory, manager));
}

function parseDeclaredManager(packageManager: string | undefined): DependencyManager | undefined {
  const match = packageManager?.match(/^(bun|pnpm|npm|yarn)@/);
  return match ? (match[1] as DependencyManager) : undefined;
}

function managerLockfilePresent(projectDirectory: string, manager: DependencyManager): boolean {
  return MANAGER_LOCKFILES[manager].some(lockfile =>
    existsSync(nodePath.join(projectDirectory, lockfile)),
  );
}

function buildBunPlan(
  projectDirectory: string,
  packageJson: Record<string, unknown>,
): DependencyPlan {
  const bunLockfile =
    BUN_LOCKFILES.find(lockfile => existsSync(nodePath.join(projectDirectory, lockfile))) ??
    'bun.lock';
  return {
    manager: 'bun',
    installCommand: { binary: 'bun', args: ['ci'], display: 'bun ci' },
    installArtifact: INSTALL_ARTIFACT,
    inputPaths: uniqueSorted([
      'package.json',
      bunLockfile,
      ...collectWorkspacePackageJsonPaths(projectDirectory, packageJson),
    ]),
  };
}

/**
 * pnpm readiness plan: `pnpm install --frozen-lockfile` (the frozen analog of
 * `bun ci`), fingerprinting package.json, the pnpm lockfile, the workspace
 * config, and the workspace package manifests it globs in.
 */
function buildPnpmPlan(projectDirectory: string): DependencyPlan {
  const workspaceConfigPresent = existsSync(nodePath.join(projectDirectory, 'pnpm-workspace.yaml'));
  return {
    manager: 'pnpm',
    installCommand: {
      binary: 'pnpm',
      args: ['install', '--frozen-lockfile'],
      display: 'pnpm install --frozen-lockfile',
    },
    installArtifact: INSTALL_ARTIFACT,
    inputPaths: uniqueSorted([
      'package.json',
      'pnpm-lock.yaml',
      ...(workspaceConfigPresent ? ['pnpm-workspace.yaml'] : []),
      ...collectPnpmWorkspacePackageJsonPaths(projectDirectory),
    ]),
  };
}

function buildNpmPlan(
  projectDirectory: string,
  packageJson: Record<string, unknown>,
): DependencyPlan {
  return {
    manager: 'npm',
    installCommand: { binary: 'npm', args: ['ci'], display: 'npm ci' },
    installArtifact: INSTALL_ARTIFACT,
    inputPaths: uniqueSorted([
      'package.json',
      'package-lock.json',
      ...collectWorkspacePackageJsonPaths(projectDirectory, packageJson),
    ]),
  };
}

/**
 * yarn readiness plan. Classic (v1) uses `--frozen-lockfile`; berry (v2+) uses
 * `--immutable` (its rename of the same CI guard), detected via a `yarn@<major>`
 * declaration or a `.yarnrc.yml`.
 */
function buildYarnPlan(
  projectDirectory: string,
  packageJson: Record<string, unknown>,
  packageManager: string | undefined,
): DependencyPlan {
  const args = isYarnBerry(projectDirectory, packageManager)
    ? ['install', '--immutable']
    : ['install', '--frozen-lockfile'];
  return {
    manager: 'yarn',
    installCommand: { binary: 'yarn', args, display: `yarn ${args.join(' ')}` },
    installArtifact: INSTALL_ARTIFACT,
    inputPaths: uniqueSorted([
      'package.json',
      'yarn.lock',
      ...collectWorkspacePackageJsonPaths(projectDirectory, packageJson),
    ]),
  };
}

function isYarnBerry(projectDirectory: string, packageManager: string | undefined): boolean {
  if (packageManager?.startsWith('yarn@')) {
    const major = Number.parseInt(packageManager.slice('yarn@'.length), 10);
    return Number.isFinite(major) && major >= 2;
  }
  return existsSync(nodePath.join(projectDirectory, '.yarnrc.yml'));
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

  // The content-fingerprint marker is the authoritative freshness signal: it
  // survives content-preserving operations (rebase, checkout, clone, cp) that
  // bump input mtimes without changing input content. mtime is only a bootstrap
  // fallback for the first check after an install, before any hook has stamped
  // the marker — so it is consulted only when the marker is absent or stale.
  const markerFresh = readInstallMarker(projectDirectory, plan) === fingerprint;

  if (!markerFresh && isInstallArtifactStale(projectDirectory, plan, artifactPath)) {
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

export function writeInstallMarker(projectDirectory: string, readiness: DependencyReadiness): void {
  if (readiness.status !== 'ready') return;
  const { plan, fingerprint } = readiness;
  if (plan === undefined || fingerprint === undefined) return;

  try {
    writeFileSync(installMarkerPath(projectDirectory, plan), fingerprint);
  } catch {
    // The marker shares node_modules' lifecycle and is best-effort. A failure
    // to stamp it simply falls back to the mtime check on the next read.
  }
}

function readInstallMarker(projectDirectory: string, plan: DependencyPlan): string | undefined {
  try {
    return readFileSync(installMarkerPath(projectDirectory, plan), 'utf8').trim();
  } catch {
    return undefined;
  }
}

function installMarkerPath(projectDirectory: string, plan: DependencyPlan): string {
  return nodePath.join(projectDirectory, plan.installArtifact, INSTALL_MARKER_FILENAME);
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
    `${problem}.`,
    `Run \`${installCommand}\` from the project root, then retry the command.`,
  ].join('\n');
}

function collectWorkspacePackageJsonPaths(
  projectDirectory: string,
  rootPackageJson: Record<string, unknown>,
): string[] {
  return expandWorkspacePatterns(projectDirectory, readWorkspacePatterns(rootPackageJson));
}

function collectPnpmWorkspacePackageJsonPaths(projectDirectory: string): string[] {
  return expandWorkspacePatterns(projectDirectory, readPnpmWorkspacePackages(projectDirectory));
}

/**
 * Extract the `packages:` block-list globs from pnpm-workspace.yaml without a
 * YAML dependency (hooks are zero-third-party). Handles the standard block
 * sequence, quotes, comments, and `!` negation (passed through to
 * expandWorkspacePatterns). An inline flow sequence (`packages: [...]`) yields
 * nothing — uncommon in pnpm-workspace.yaml.
 */
function readPnpmWorkspacePackages(projectDirectory: string): string[] {
  let content: string;
  try {
    content = readFileSync(nodePath.join(projectDirectory, 'pnpm-workspace.yaml'), 'utf8');
  } catch {
    return [];
  }

  const patterns: string[] = [];
  let insidePackages = false;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/(^|\s)#.*$/, '');
    if (!insidePackages) {
      if (/^packages:\s*$/.test(line)) insidePackages = true;
      continue;
    }
    const item = line.match(/^\s*-\s*(.+?)\s*$/);
    if (item?.[1] !== undefined) {
      patterns.push(stripYamlQuotes(item[1]));
      continue;
    }
    // A new top-level key (non-indented, non-comment, non-item) ends the block.
    if (/^[^\s#-]/.test(line)) insidePackages = false;
  }
  return patterns;
}

function stripYamlQuotes(value: string): string {
  const trimmed = value.trim();
  const quoted =
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'));
  return quoted ? trimmed.slice(1, -1) : trimmed;
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

interface WorkspacePattern {
  pattern: string;
  negated: boolean;
}

function expandWorkspacePatterns(projectDirectory: string, rawPatterns: string[]): string[] {
  const patterns = rawPatterns
    .map(normalizeWorkspacePattern)
    .filter((pattern): pattern is WorkspacePattern => pattern !== undefined);
  const positivePatterns = patterns.filter(pattern => !pattern.negated);
  const negativePatterns = patterns.filter(pattern => pattern.negated);
  const packageJsonPaths = new Set<string>();

  for (const { pattern } of positivePatterns) {
    for (const packageJsonPath of expandPositiveWorkspacePattern(projectDirectory, pattern)) {
      if (!isExcludedWorkspacePackage(packageJsonPath, negativePatterns)) {
        packageJsonPaths.add(packageJsonPath);
      }
    }
  }

  return [...packageJsonPaths];
}

function normalizeWorkspacePattern(rawPattern: string): WorkspacePattern | undefined {
  let pattern = rawPattern.trim().replaceAll('\\', '/');
  const negated = pattern.startsWith('!');
  if (negated) pattern = pattern.slice(1);

  pattern = pattern.replace(/^\.?\//, '').replace(/\/+$/, '');
  if (pattern.length === 0) return undefined;

  return { pattern, negated };
}

function expandPositiveWorkspacePattern(projectDirectory: string, pattern: string): string[] {
  if (!hasGlobSyntax(pattern)) {
    const packageJsonPath = pattern.endsWith('/package.json') ? pattern : `${pattern}/package.json`;
    return existsSync(nodePath.join(projectDirectory, packageJsonPath)) ? [packageJsonPath] : [];
  }

  return collectPackageJsonPathsUnder(
    projectDirectory,
    workspacePatternBaseDirectory(pattern),
  ).filter(packageJsonPath => matchesWorkspacePattern(pattern, packageJsonPath, true));
}

function collectPackageJsonPathsUnder(
  projectDirectory: string,
  relativeBaseDirectory: string,
): string[] {
  const baseDirectory = nodePath.join(projectDirectory, relativeBaseDirectory);
  if (!isDirectory(baseDirectory)) return [];

  const packageJsonPaths: string[] = [];
  const pendingDirectories = [baseDirectory];

  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    if (directory === undefined) continue;

    const relativeDirectory = normalizeRelativePath(nodePath.relative(projectDirectory, directory));
    const packageJsonPath =
      relativeDirectory.length > 0 ? `${relativeDirectory}/package.json` : 'package.json';
    if (existsSync(nodePath.join(directory, 'package.json'))) {
      packageJsonPaths.push(packageJsonPath);
    }

    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || WORKSPACE_SCAN_EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      pendingDirectories.push(nodePath.join(directory, entry.name));
    }
  }

  return packageJsonPaths;
}

function isExcludedWorkspacePackage(
  packageJsonPath: string,
  negativePatterns: WorkspacePattern[],
): boolean {
  return negativePatterns.some(({ pattern }) =>
    matchesWorkspacePattern(pattern, packageJsonPath, false),
  );
}

function matchesWorkspacePattern(
  pattern: string,
  packageJsonPath: string,
  unsupportedGlobDefault: boolean,
): boolean {
  const target = pattern.endsWith('/package.json')
    ? packageJsonPath
    : packageJsonPath.replace(/\/package\.json$/, '');
  const matcher = workspacePatternMatcher(pattern);
  if (matcher === undefined) return unsupportedGlobDefault;
  return matcher.test(target);
}

function workspacePatternMatcher(pattern: string): RegExp | undefined {
  if (/[?[\]{}]/.test(pattern)) return undefined;

  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    const afterNext = pattern[index + 2];
    if (char === undefined) continue;

    if (char === '*' && next === '*' && afterNext === '/') {
      source += '(?:.*/)?';
      index += 2;
      continue;
    }

    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
      continue;
    }

    if (char === '*') {
      source += '[^/]*';
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`${source}$`);
}

function workspacePatternBaseDirectory(pattern: string): string {
  const globIndex = firstGlobSyntaxIndex(pattern);
  if (globIndex === -1) {
    return pattern.endsWith('/package.json')
      ? normalizeRelativePath(nodePath.dirname(pattern))
      : pattern;
  }

  const staticPrefix = pattern.slice(0, globIndex);
  const slashIndex = staticPrefix.lastIndexOf('/');
  return slashIndex === -1 ? '' : staticPrefix.slice(0, slashIndex);
}

function firstGlobSyntaxIndex(pattern: string): number {
  const indexes = ['*', '?', '[', '{']
    .map(char => pattern.indexOf(char))
    .filter(index => index !== -1);
  return indexes.length === 0 ? -1 : Math.min(...indexes);
}

function hasGlobSyntax(pattern: string): boolean {
  return firstGlobSyntaxIndex(pattern) !== -1;
}

function normalizeRelativePath(path: string): string {
  return path.replaceAll('\\', '/');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  return isPackageScriptCommand(subcommand);
}

function isNpmDependencyBackedCommand(args: string[]): boolean {
  const subcommand = firstCommandArgument(args, PACKAGE_MANAGER_OPTIONS_WITH_VALUES);
  return isPackageScriptCommand(subcommand) || subcommand === 'exec';
}

function isPackageManagerDependencyBackedCommand(args: string[]): boolean {
  const subcommand = firstCommandArgument(args, PACKAGE_MANAGER_OPTIONS_WITH_VALUES);
  return (
    isPackageScriptCommand(subcommand) ||
    subcommand === 'exec' ||
    (subcommand !== undefined && DEPENDENCY_BINARIES.has(subcommand))
  );
}

function isPackageScriptCommand(command: string | undefined): boolean {
  return command !== undefined && PACKAGE_SCRIPT_COMMANDS.has(command);
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
