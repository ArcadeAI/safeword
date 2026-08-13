import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
  type Dirent,
} from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from './namespace-root.js';
import { commandWords, parseShellCommandList, splitShellSegments } from './shell-segments.js';

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
  status: DependencyReadinessStatus | 'installing' | 'failed';
  reason?: string;
  fingerprint?: string;
  installCommand?: string;
  message?: string;
  updatedAt: string;
}

export type DependencyBootstrapResult =
  | { status: 'ready' | 'unsupported' }
  | { status: 'bootstrapped'; message: string }
  | { status: 'action_required' | 'failed'; message: string };

const INSTALL_ARTIFACT = 'node_modules';
const INSTALL_MARKER_FILENAME = '.safeword-deps-fingerprint';
const DEPENDENCY_STATE_FILENAME = 'dependency-readiness.json';
const DEPENDENCY_BOOTSTRAP_LOCK_DIRECTORY = '.dependency-bootstrap.lock';
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
const BUNX_BOOLEAN_OPTIONS = new Set(['--bun', '--no-install', '--silent', '--verbose']);
const SAFEWORD_GLOBAL_BOOLEAN_OPTIONS = new Set([
  '--json',
  '--no-input',
  '--offline',
  '--quiet',
  '--verbose',
  '--version',
  '-V',
  '-v',
]);
const SAFEWORD_GLOBAL_OPTIONS_WITH_VALUES = new Set(['--cwd']);
const SAFEWORD_RECOVERY_COMMANDS = new Set(['doctor', 'plan', 'setup', 'status']);
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
      if (usesYarnPlugAndPlay(projectDirectory, packageManager)) return undefined;
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
  if (packageManager !== undefined && packageManager.trim().length > 0) {
    const declared = parseDeclaredManager(packageManager);
    return declared !== undefined && managerLockfilePresent(projectDirectory, declared)
      ? declared
      : undefined;
  }

  if (existsSync(nodePath.join(projectDirectory, 'pnpm-workspace.yaml'))) {
    return managerLockfilePresent(projectDirectory, 'pnpm') ? 'pnpm' : undefined;
  }

  return LOCKFILE_PRECEDENCE.find(manager => managerLockfilePresent(projectDirectory, manager));
}

function parseDeclaredManager(packageManager: string | undefined): DependencyManager | undefined {
  const match = packageManager?.match(/^(bun|pnpm|npm|yarn)@.+/);
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
 * yarn readiness plan. Classic (v1) uses `--frozen-lockfile`; Berry (v2+) uses
 * `--immutable` (its rename of the same CI guard). Berry is supported only
 * with an explicit node-modules linker because Plug'n'Play has no node_modules
 * artifact for this readiness contract to validate.
 */
function buildYarnPlan(
  projectDirectory: string,
  packageJson: Record<string, unknown>,
  packageManager: string | undefined,
): DependencyPlan {
  const yarnBerry = isYarnBerry(projectDirectory, packageManager);
  const args = yarnBerry ? ['install', '--immutable'] : ['install', '--frozen-lockfile'];
  return {
    manager: 'yarn',
    installCommand: { binary: 'yarn', args, display: `yarn ${args.join(' ')}` },
    installArtifact: INSTALL_ARTIFACT,
    inputPaths: uniqueSorted([
      'package.json',
      'yarn.lock',
      ...(yarnBerry ? ['.yarnrc.yml'] : []),
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

function usesYarnPlugAndPlay(
  projectDirectory: string,
  packageManager: string | undefined,
): boolean {
  if (!isYarnBerry(projectDirectory, packageManager)) return false;

  try {
    const yarnConfig = readFileSync(nodePath.join(projectDirectory, '.yarnrc.yml'), 'utf8');
    return !/^\s*nodeLinker\s*:\s*(['"]?)node-modules\1\s*(?:#.*)?$/mu.test(yarnConfig);
  } catch {
    // Yarn Berry defaults to Plug'n'Play when nodeLinker is not configured.
    return true;
  }
}

export function dependencyInputFingerprint(projectDirectory: string, plan: DependencyPlan): string {
  const hash = createHash('sha256');

  for (const inputPath of plan.inputPaths.toSorted()) {
    hash.update(inputPath);
    hash.update('\0');
    const inputFilePath = nodePath.resolve(projectDirectory, inputPath);
    if (!isProjectPathContained(projectDirectory, inputFilePath)) {
      hash.update('<outside-project>');
      hash.update('\0');
      continue;
    }
    try {
      hash.update(readFileSync(inputFilePath));
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
  const previousState = readDependencyReadinessState(projectDirectory);

  // An installer may delete and partially recreate node_modules before it is
  // interrupted. Preserve the pre-install classification in durable state so
  // a partial tree can never be mistaken for ready merely because it is new.
  if (
    (previousState?.status === 'installing' || previousState?.status === 'failed') &&
    previousState.fingerprint === fingerprint &&
    (previousState.reason === 'install_artifact_missing' ||
      previousState.reason === 'install_artifact_stale')
  ) {
    return {
      status: previousState.reason === 'install_artifact_missing' ? 'missing' : 'stale',
      reason: previousState.reason,
      installCommand,
      fingerprint,
      plan,
    };
  }

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
  // the marker. Once present, a mismatched marker is authoritative: a newer
  // artifact mtime cannot prove that its contents match the dependency inputs.
  const marker = readInstallMarker(projectDirectory, plan);
  const markerMismatch = marker !== undefined && marker !== fingerprint;

  if (
    markerMismatch ||
    (marker === undefined && isInstallArtifactStale(projectDirectory, plan, artifactPath))
  ) {
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

/**
 * Whether a trusted project's SessionStart should auto-install dependencies for this readiness
 * status. A `missing` install artifact (no `node_modules` — e.g. a fresh git
 * worktree) is bootstrapped UNCONDITIONALLY: the worktree is unusable and a
 * commit would bypass the husky guard chain (lint-staged can't resolve its
 * tools), so install regardless of the `autoInstall` opt-in. The opt-in still
 * governs the softer `stale` re-install (deps present but inputs changed).
 * Claude and Codex both load repo-owned SessionStart hooks only after the user
 * trusts the project, so this never installs from an untrusted checkout. (JNVP4W)
 */
export function shouldBootstrapDependencies(
  status: DependencyReadinessStatus,
  autoInstall: boolean,
): boolean {
  if (status === 'missing') return true;
  if (status === 'stale') return autoInstall;
  return false;
}

/**
 * Reconcile dependency readiness without assuming a host hook protocol.
 * Host adapters decide how to surface the typed result: Claude emits
 * SessionStart JSON, while Codex/local setup uses plain output and exit status.
 */
export function bootstrapDependencies(projectDirectory: string): DependencyBootstrapResult {
  let readiness = getDependencyReadiness(projectDirectory);

  if (readiness.status === 'unsupported') return { status: 'unsupported' };

  if (readiness.status === 'ready') {
    writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));
    writeInstallMarker(projectDirectory, readiness);
    return { status: 'ready' };
  }

  const config = readDependencyBootstrapConfig(projectDirectory);
  if (
    shouldBootstrapDependencies(readiness.status, config.autoInstall) &&
    readiness.plan !== undefined
  ) {
    const releaseLock = acquireDependencyBootstrapLock(projectDirectory);
    if (releaseLock === undefined) {
      return {
        status: 'action_required',
        message:
          'another dependency bootstrap is already running; wait for it to finish, then retry.',
      };
    }
    const initialReadiness = readiness;
    const plan = readiness.plan;
    const { binary, args, display } = plan.installCommand;
    try {
      writeDependencyReadinessState(projectDirectory, {
        status: 'installing',
        reason: initialReadiness.reason,
        fingerprint: initialReadiness.fingerprint,
        installCommand: initialReadiness.installCommand,
      });
      const result = spawnSync(binary, args, {
        cwd: projectDirectory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (
        result.status === 0 &&
        initialReadiness.fingerprint !== undefined &&
        isDirectory(nodePath.join(projectDirectory, plan.installArtifact))
      ) {
        stampInstallMarker(projectDirectory, plan, initialReadiness.fingerprint);
        readiness = getDependencyReadinessIgnoringInstallState(projectDirectory);
      }
      if (result.status === 0 && readiness.status === 'ready') {
        writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));
        return {
          status: 'bootstrapped',
          message: `dependencies bootstrapped with \`${display}\`.`,
        };
      }

      const summary = [
        `dependency bootstrap failed while running \`${display}\`.`,
        'Run the install command manually, inspect the package manager output, then retry.',
      ].join('\n');
      const message = [
        summary,
        result.error?.message,
        trimBootstrapOutput(result.stderr) || trimBootstrapOutput(result.stdout),
      ]
        .filter(Boolean)
        .join('\n');

      writeDependencyReadinessState(projectDirectory, {
        status: 'failed',
        reason: initialReadiness.reason,
        fingerprint: initialReadiness.fingerprint,
        installCommand: initialReadiness.installCommand,
        message: summary,
      });
      return { status: 'failed', message };
    } finally {
      releaseLock();
    }
  }

  writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));
  return { status: 'action_required', message: formatDependencyRecovery(readiness) };
}

function trimBootstrapOutput(output: string | undefined): string {
  return output?.trim().split('\n').slice(-20).join('\n') ?? '';
}

export function isDependencyBackedCommand(command: string): boolean {
  const segments = splitShellSegments(command);

  return segments.some(segment => isDependencyBackedSegment(segment));
}

/**
 * A stale-readiness recovery may run its retry in the same Bash call only when
 * the recovery comes first and every following segment depends on its success.
 * This preserves the pre-tool gate for `||`, `;`, and pipes, where a guarded
 * command could otherwise run after a failed or concurrent recovery (#1763).
 *
 * A background `&` also breaks that guarantee: Bash ends the preceding list
 * and runs it asynchronously. The shared tokenizer exposes it as its own
 * control operator, so it cannot look like an all-`&&` recovery chain.
 *
 * Only the LEADING segment is classified. An intermediate segment that undoes
 * the recovery (`bun ci && rm -rf node_modules && bun run test`) still passes:
 * the gate stops an agent from running into a stale worktree by accident, not
 * from dismantling its own recovery on purpose.
 */
export function isDependencyReadinessRecoveryCommand(
  command: string,
  status: DependencyReadinessStatus,
): boolean {
  const segments = parseShellCommandList(command);
  const [first] = segments;
  if (segments.length < 2 || first === undefined || !isRecoverySegment(first.command, status)) {
    return false;
  }
  return segments.slice(0, -1).every(segment => segment.operatorAfter === '&&');
}

/** Package managers whose install/ci/i reconciles `node_modules` against the inputs. */
const INSTALL_MANAGERS = new Set(['bun', 'pnpm', 'npm', 'yarn']);
/** Subcommands that perform a dependency install (not `add`/`remove`, which change inputs). */
const INSTALL_SUBCOMMANDS = new Set(['install', 'i', 'ci']);
/**
 * Flags that prevent an install from fully reconciling project dependencies.
 * Some do not materialize `node_modules` at all; others omit dependencies or
 * skip linking. Treating either as ready would let a recovery retry run with an
 * incomplete tree and would let the post-tool hook stamp a sticky false-ready.
 */
const NON_RECONCILING_INSTALL_FLAGS = new Set([
  '--dry-run',
  '--lockfile-only',
  '--package-lock-only',
  '--production',
  '--prod',
  '-P',
  '--no-dev',
  '--no-optional',
]);
const NON_RECONCILING_INSTALL_OPTIONS = new Set(['--omit', '--only', '--mode']);
/**
 * Flags that make any package manager print-and-exit instead of installing.
 * `bun install --help`, `npm ci --version`, and bare `yarn --version` all
 * carry a real install subcommand (or are classic bare yarn) yet never
 * reconcile `node_modules`, so counting them as installs would stamp a
 * false-ready (EDDABK). Under-counting is safe here — the worst case is the
 * user re-running a real install — so a broad flag list is fine.
 */
const REPORT_ONLY_INSTALL_FLAGS = new Set(['--version', '-v', '--help', '-h']);

/**
 * Whether a command runs a dependency *install* (e.g. `bun ci`, `pnpm install
 * --frozen-lockfile`, `npm ci`, bare `yarn`). A successful install reconciles
 * `node_modules` with the current inputs, so the post-tool hook can stamp the
 * fingerprint marker — making the recommended recovery command clear the
 * stale-readiness block even when the install is a mtime-preserving no-op (#380).
 */
export function isDependencyInstallCommand(command: string): boolean {
  const segments = parseShellCommandList(command);
  return segments.length === 1 && isInstallSegment(segments[0]?.command ?? '');
}

function isInstallSegment(segment: string): boolean {
  const [binary, ...args] = commandWords(segment);
  if (binary === undefined) return false;
  const base = nodePath.basename(binary);
  if (!INSTALL_MANAGERS.has(base)) return false;
  if (hasNonReconcilingInstallOption(args)) return false;
  // A report-only flag (--help/--version) makes the manager print and exit
  // without installing — for every manager, not just classic bare yarn.
  if (args.some(arg => REPORT_ONLY_INSTALL_FLAGS.has(arg))) return false;

  const subcommand = firstCommandArgument(args, PACKAGE_MANAGER_OPTIONS_WITH_VALUES);
  // Classic `yarn` with no subcommand installs.
  if (base === 'yarn' && subcommand === undefined) return true;
  return subcommand !== undefined && INSTALL_SUBCOMMANDS.has(subcommand);
}

function hasNonReconcilingInstallOption(args: string[]): boolean {
  return args.some(arg => {
    const [flag] = arg.split('=', 1);
    if (flag === undefined) return false;
    return NON_RECONCILING_INSTALL_FLAGS.has(flag) || NON_RECONCILING_INSTALL_OPTIONS.has(flag);
  });
}

/**
 * `touch node_modules` is only offered as recovery for a STALE marker, and it
 * only earns the exemption there. With `node_modules` missing, `touch` creates
 * an empty regular FILE of that name and exits 0 — so the retry would run with
 * nothing installed, readiness would stay `missing` forever (the path is not a
 * directory), and the stray file would block the real install that follows.
 */
function isRecoverySegment(segment: string, status: DependencyReadinessStatus): boolean {
  if (isInstallSegment(segment)) return true;
  return status === 'stale' && isTouchNodeModulesSegment(segment);
}

function isTouchNodeModulesSegment(segment: string): boolean {
  const [binary, ...args] = commandWords(segment);
  return (
    nodePath.basename(binary ?? '') === 'touch' && args.length === 1 && args[0] === 'node_modules'
  );
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

  stampInstallMarker(projectDirectory, plan, fingerprint);
}

function stampInstallMarker(
  projectDirectory: string,
  plan: DependencyPlan,
  fingerprint: string,
): void {
  try {
    writeFileSync(installMarkerPath(projectDirectory, plan), fingerprint);
  } catch {
    // The marker shares node_modules' lifecycle and is best-effort. A failure
    // to stamp it simply falls back to the mtime check on the next read.
  }
}

function getDependencyReadinessIgnoringInstallState(projectDirectory: string): DependencyReadiness {
  rmSync(getDependencyReadinessStatePath(projectDirectory), { force: true });
  return getDependencyReadiness(projectDirectory);
}

function acquireDependencyBootstrapLock(projectDirectory: string): (() => void) | undefined {
  const lockPath = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    DEPENDENCY_BOOTSTRAP_LOCK_DIRECTORY,
  );
  mkdirSync(nodePath.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(lockPath);
      writeFileSync(nodePath.join(lockPath, 'pid'), String(process.pid));
      return () => rmSync(lockPath, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return undefined;
      const pid = Number.parseInt(readTextFile(nodePath.join(lockPath, 'pid')) ?? '', 10);
      if (Number.isFinite(pid) && processIsRunning(pid)) return undefined;
      rmSync(lockPath, { recursive: true, force: true });
    }
  }
  return undefined;
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readTextFile(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
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

function dependencyRecoveryCommand(readiness: DependencyReadiness): string {
  const { installCommand, plan, status } = readiness;
  if (installCommand === undefined) return 'install dependencies';

  // A version-bump pull changes the input fingerprint without changing resolved
  // dependencies, so the install reports "no changes" and does not refresh the
  // marker — which would otherwise leave this stale check looping. No package
  // manager offers a cheap "lockfile already satisfied" probe (pnpm#4861), so
  // remove the stale marker and touch the artifact after the install succeeds.
  // This also works when the current app still has an older PostToolUse hook
  // loaded and therefore cannot stamp the new fingerprint itself.
  if (status !== 'stale' || plan === undefined) return installCommand;
  return `${installCommand} && rm -f ${plan.installArtifact}/${INSTALL_MARKER_FILENAME} && touch ${plan.installArtifact}`;
}

export function formatDependencyRecovery(readiness: DependencyReadiness): string {
  const problem =
    readiness.status === 'stale'
      ? "the project's tool list changed since it was last set up, so safeword's checks may be out of date"
      : "this project's tools aren't installed yet, so safeword's checks can't run";

  const lines = [
    `${problem}.`,
    // The recovery may end in a relative `touch`, so the folder has to be the
    // project root — "the project folder" reads as "wherever you are" inside a
    // monorepo package and quietly touches the wrong artifact.
    `Install them with this command from the project root folder, then try again:`,
    `  ${dependencyRecoveryCommand(readiness)}`,
  ];

  return lines.join('\n');
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
    const line = stripYamlComment(rawLine);
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

function stripYamlComment(line: string): string {
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote !== undefined) {
      if (character === quote && line[index - 1] !== '\\') quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === '#' && (index === 0 || /\s/u.test(line[index - 1] ?? ''))) {
      return line.slice(0, index);
    }
  }
  return line;
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

  if (
    nodePath.posix.isAbsolute(pattern) ||
    /^[A-Za-z]:\//.test(pattern) ||
    pattern.split('/').includes('..')
  ) {
    return undefined;
  }

  pattern = pattern.replace(/^\.?\//, '').replace(/\/+$/, '');
  if (pattern.length === 0) return undefined;

  return { pattern, negated };
}

function expandPositiveWorkspacePattern(projectDirectory: string, pattern: string): string[] {
  if (!hasGlobSyntax(pattern)) {
    const packageJsonPath = pattern.endsWith('/package.json') ? pattern : `${pattern}/package.json`;
    const packageJsonFilePath = nodePath.resolve(projectDirectory, packageJsonPath);
    return existsSync(packageJsonFilePath) &&
      isProjectPathContained(projectDirectory, packageJsonFilePath)
      ? [packageJsonPath]
      : [];
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
  if (!isDirectory(baseDirectory) || !isProjectPathContained(projectDirectory, baseDirectory)) {
    return [];
  }

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

function isProjectPathContained(projectDirectory: string, candidatePath: string): boolean {
  const resolvedProjectDirectory = nodePath.resolve(projectDirectory);
  const resolvedCandidatePath = nodePath.resolve(candidatePath);
  if (!isPathWithin(resolvedProjectDirectory, resolvedCandidatePath)) return false;
  if (!existsSync(resolvedCandidatePath)) return true;

  try {
    return isPathWithin(
      realpathSync(resolvedProjectDirectory),
      realpathSync(resolvedCandidatePath),
    );
  } catch {
    return false;
  }
}

function isPathWithin(parentPath: string, candidatePath: string): boolean {
  const relativePath = nodePath.relative(parentPath, candidatePath);
  return (
    relativePath === '' ||
    (!nodePath.isAbsolute(relativePath) &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${nodePath.sep}`))
  );
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
  // Unsupported positive syntax errs toward fingerprinting too much, while
  // unsupported exclusions never hide a package from readiness tracking.
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
  const [binary, ...args] = commandWords(segment);
  if (binary === undefined) return false;

  const basename = nodePath.basename(binary);

  if (binary.includes('node_modules/.bin/')) return true;

  if (basename === 'bun') {
    return isBunDependencyBackedCommand(args);
  }

  if (basename === 'bunx') return !isSafewordRecoverySegment(segment, args);

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

function isSafewordRecoverySegment(segment: string, args: string[]): boolean {
  if (containsShellEvaluationSyntax(segment)) return false;

  let packageIndex = 0;
  while (BUNX_BOOLEAN_OPTIONS.has(args[packageIndex] ?? '')) packageIndex += 1;
  if (args[packageIndex] === '--') packageIndex += 1;

  const packageSpecifier = args[packageIndex];
  if (packageSpecifier === undefined || !/^safeword(?:@[^/@\s]+)?$/.test(packageSpecifier)) {
    return false;
  }

  const command = firstSafewordCommandArgument(args.slice(packageIndex + 1));
  return command !== undefined && SAFEWORD_RECOVERY_COMMANDS.has(command);
}

function containsShellEvaluationSyntax(segment: string): boolean {
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (const char of segment) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (char === "'") {
      if (quote === undefined) quote = char;
      else if (quote === char) quote = undefined;
      continue;
    }
    if (char === '"') {
      if (quote === undefined) quote = char;
      else if (quote === char) quote = undefined;
      continue;
    }
    if (quote !== "'" && (char === '$' || char === '`')) return true;
    if (quote === undefined && (char === '<' || char === '>' || char === '&')) return true;
  }

  return false;
}

// Deliberately not `firstCommandArgument`: that helper skips over options it
// does not recognize, which would let an unknown flag carry an argument the
// classifier then mistakes for a recovery verb. Here an unrecognized option
// means "not a recovery shape", so the segment falls through to the guard.
function firstSafewordCommandArgument(args: string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;

    if (arg === '--') return args[index + 1];
    if (!arg.startsWith('-') || arg === '-') return arg;

    const option = arg.split('=')[0] ?? arg;
    if (SAFEWORD_GLOBAL_OPTIONS_WITH_VALUES.has(option)) {
      if (!arg.includes('=')) index += 1;
      continue;
    }
    if (!SAFEWORD_GLOBAL_BOOLEAN_OPTIONS.has(arg)) return undefined;
  }

  return undefined;
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

/**
 * Directory holding committed git hooks. Husky wires git's `core.hooksPath` to
 * `.husky/_` during `prepare`, which only runs on `npm install` — so a fresh
 * clone/worktree has no hooks wired until deps are installed, and every committed
 * pre-commit guard silently does not run (#364).
 */
export const COMMITTED_HOOKS_DIR = '.husky';

export interface GitHooksWiringInput {
  /** A committed hook (`.husky/pre-commit`) exists in the repo. */
  committedHookExists: boolean;
  /** Current value of git `core.hooksPath` (`''` when unset). */
  currentHooksPath: string;
  /** Whether the directory git's `core.hooksPath` points at holds a usable hook. */
  currentHooksPathActive: boolean;
}

export interface GitHooksWiringDecision {
  action: 'none' | 'wire';
  hooksPath?: string;
}

/**
 * Whether `core.hooksPath` is unset or husky-managed (so safeword may wire it).
 * A non-empty, non-husky value is a deliberate custom hooks path we must not
 * clobber, even when it has no `pre-commit` — the user owns it.
 */
function isHuskyManagedHooksPath(hooksPath: string): boolean {
  const normalized = hooksPath.replace(/\/+$/, '');
  return normalized === '' || normalized === COMMITTED_HOOKS_DIR || normalized === '.husky/_';
}

/**
 * Decide whether to wire git hooks. When a committed `.husky/pre-commit` exists but
 * `core.hooksPath` is unset (or already husky-managed) and has no usable hook, wire
 * it to `.husky` so the committed guard fires — the absence of enforcement becomes
 * self-enforcing. Husky resets `core.hooksPath` to `.husky/_` on its next install,
 * so this is a safe bridge for the fresh-clone window. A deliberate custom
 * `core.hooksPath` is left untouched.
 */
export function decideGitHooksWiring(input: GitHooksWiringInput): GitHooksWiringDecision {
  if (!input.committedHookExists) return { action: 'none' };
  if (input.currentHooksPathActive) return { action: 'none' };
  if (!isHuskyManagedHooksPath(input.currentHooksPath)) return { action: 'none' };
  return { action: 'wire', hooksPath: COMMITTED_HOOKS_DIR };
}

export function readGitHooksPath(cwd: string): string {
  const result = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

export function wireGitHooksIfNeeded(cwd: string): void {
  const committedHookExists = existsSync(nodePath.join(cwd, COMMITTED_HOOKS_DIR, 'pre-commit'));
  const currentHooksPath = readGitHooksPath(cwd);
  const currentHooksPathActive =
    currentHooksPath !== '' && existsSync(nodePath.resolve(cwd, currentHooksPath, 'pre-commit'));
  const decision = decideGitHooksWiring({
    committedHookExists,
    currentHooksPath,
    currentHooksPathActive,
  });
  if (decision.action !== 'wire' || decision.hooksPath === undefined) return;
  spawnSync('git', ['config', 'core.hooksPath', decision.hooksPath], { cwd, stdio: 'ignore' });
}
