import { execFile, execSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { expect } from 'vitest';

import { shortHash } from '../src/retro/hash.js';

const execFileAsync = promisify(execFile);

/**
 * Timeout constants for test operations.
 * Centralized to ensure consistency and easy adjustment.
 */
/** Quick operations that don't spawn processes (10s) */
export const TIMEOUT_QUICK = 10_000;
/** Sync CLI operations without bun install (30s) */
export const TIMEOUT_SYNC = 30_000;
/**
 * Setup commands that spawn `safeword setup` (git init + scaffolding + tool
 * detection + optional skills pull). 120s: setup under full-suite CPU saturation
 * can far outrun its isolated single-digit-second runtime (issue #419). Paired
 * with `setupOrThrow`'s bounded retry-on-timeout so a transient spike gets a
 * second attempt rather than a false red.
 */
export const TIMEOUT_SETUP = 120_000;
/**
 * Budget that contains a full `setupOrThrow` run including its bounded retry:
 * 2 attempts × TIMEOUT_SETUP + fixture slack. This is the value the base
 * `hookTimeout` (vitest.base.ts) is set to, so every setup-in-`beforeAll`
 * inherits enough headroom without a per-hook override. Test *bodies* that run
 * `setupOrThrow` inline still set it explicitly — `testTimeout`/`hookTimeout`
 * don't apply to an `it()`'s own timeout arg.
 */
export const TIMEOUT_SETUP_HOOK = TIMEOUT_SETUP * 2 + 60_000;
/** Acceptance lanes can spawn their own runners and need headroom under full-suite load (120s) */
export const TIMEOUT_ACCEPTANCE_LANE = 120_000;
/** bun install operations under load or cold cache (120s) */
export const TIMEOUT_BUN_INSTALL = 120_000;

const __dirname = import.meta.dirname;

/**
 * Path to the CLI entry point (built)
 */
const CLI_PATH = nodePath.join(__dirname, '../dist/cli.js');

/**
 * Path to the local safeword CLI package (for file: references in tests)
 */
const SAFEWORD_PATH = nodePath.join(__dirname, '..');

/**
 * safeword reference for test package.json files.
 * Uses file: protocol to install the local built package instead of from npm.
 * This ensures tests run against the current source code.
 */
export const SAFEWORD_VERSION = `file:${SAFEWORD_PATH}`;

export const SKIP_INSTALL_ENV = {
  SAFEWORD_SKIP_INSTALL: '1',
};

/**
 * Skip ONLY the skills pull (`npx skills add`) while still installing JS/Python
 * dependencies. Use for Go setup tests that need real deps (e.g. eslint) but must
 * not make the slow/flaky skills network call.
 */
export const SKIP_SKILLS_ENV = {
  SAFEWORD_SKIP_SKILLS: '1',
};

const SAFEWORD_BASE_DEV_DEPENDENCIES = {
  eslint: '^9.22.0',
  jiti: '^2.2.0',
  safeword: SAFEWORD_VERSION,
  'dependency-cruiser': '^17.0.0',
  knip: '^6.0.0',
  '@cucumber/cucumber': '^13.0.0',
  tsx: '^4.0.0',
  '@types/node': '^25.0.0',
  prettier: '^3.0.0',
};

/**
 * Creates a temporary directory for test isolation
 */
export function createTemporaryDirectory(): string {
  return mkdtempSync(nodePath.join(tmpdir(), 'safeword-test-'));
}

export function installFakeCodexCli(projectRoot: string, version: string): string {
  const fakeBin = nodePath.join(projectRoot, 'bin');
  mkdirSync(fakeBin);
  const fakeCodex = nodePath.join(fakeBin, 'codex');
  writeFileSync(fakeCodex, `#!/usr/bin/env sh\necho "codex ${version}"\n`);
  chmodSync(fakeCodex, 0o755);
  return fakeBin;
}

/**
 * Removes a temporary directory and all contents.
 * Uses rmSync's built-in retry for ENOTEMPTY/EBUSY errors from
 * npm/git processes that haven't released file handles.
 * Wrapped in try-catch to prevent cleanup failures from cascading to test failures.
 * @param dir
 */
export function removeTemporaryDirectory(dir: string): void {
  try {
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 500,
    });
  } catch {
    // Ignore cleanup failures - OS will clean temp directory eventually
    // This prevents ENOTEMPTY race conditions from failing tests
  }
}

/**
 * Creates a minimal package.json in the given directory
 * @param dir
 * @param overrides
 */
export function createPackageJson(dir: string, overrides: Record<string, unknown> = {}): void {
  // Merge devDependencies to ensure local safeword is always included
  const existingDevelopmentDependencies =
    (overrides.devDependencies as Record<string, string>) ?? {};
  const pkg = {
    name: 'test-project',
    version: '1.0.0',
    ...overrides,
    devDependencies: {
      safeword: SAFEWORD_VERSION,
      ...existingDevelopmentDependencies,
    },
  };
  writeFileSync(nodePath.join(dir, 'package.json'), JSON.stringify(pkg, undefined, 2));
}

/**
 * Creates package.json with safeword's base JS/BDD tooling already declared.
 * Use for setup tests that assert generated config rather than real package-manager installs.
 * @param dir
 * @param overrides
 */
export function createSafewordBasePackageJson(
  dir: string,
  overrides: Record<string, unknown> = {},
): void {
  const existingDevelopmentDependencies =
    (overrides.devDependencies as Record<string, string>) ?? {};
  createPackageJson(dir, {
    ...overrides,
    devDependencies: {
      ...SAFEWORD_BASE_DEV_DEPENDENCIES,
      ...existingDevelopmentDependencies,
    },
  });
}

const FRAMEWORK_DEPS = {
  typescript: { devDependencies: { typescript: '^5.0.0' } },
  react: { dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' } },
  nextjs: {
    dependencies: { next: '^14.0.0', react: '^18.0.0', 'react-dom': '^18.0.0' },
  },
} as const;

function createFrameworkPackageJson(
  dir: string,
  framework: keyof typeof FRAMEWORK_DEPS,
  overrides: Record<string, unknown> = {},
): void {
  const frameworkConfig = FRAMEWORK_DEPS[framework];
  createPackageJson(dir, {
    ...('dependencies' in frameworkConfig && { dependencies: frameworkConfig.dependencies }),
    devDependencies: {
      ...('devDependencies' in frameworkConfig && frameworkConfig.devDependencies),
      safeword: SAFEWORD_VERSION,
    },
    ...overrides,
  });
}

export function createTypeScriptPackageJson(
  dir: string,
  overrides: Record<string, unknown> = {},
): void {
  createFrameworkPackageJson(dir, 'typescript', overrides);
}

export function createTypeScriptProjectReadyForSetup(
  dir: string,
  overrides: Record<string, unknown> = {},
): void {
  const existingDevelopmentDependencies =
    (overrides.devDependencies as Record<string, string>) ?? {};
  createTypeScriptPackageJson(dir, {
    ...overrides,
    devDependencies: {
      ...SAFEWORD_BASE_DEV_DEPENDENCIES,
      typescript: '^5.0.0',
      ...existingDevelopmentDependencies,
    },
  });
}

export function createReactPackageJson(dir: string, overrides: Record<string, unknown> = {}): void {
  createFrameworkPackageJson(dir, 'react', overrides);
}

export function createNextJsPackageJson(
  dir: string,
  overrides: Record<string, unknown> = {},
): void {
  createFrameworkPackageJson(dir, 'nextjs', overrides);
}

/**
 * Result from running the CLI
 */
interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /**
   * True when the subprocess was killed by its own timeout (wall-clock), as
   * opposed to exiting with a non-zero code. A timeout is environmental (machine
   * contention); a non-zero exit is a genuine failure. `setupOrThrow` retries the
   * former and fails fast on the latter.
   */
  timedOut: boolean;
}

function normalizeCommandOutput(value?: string | Buffer): string {
  if (!value) {
    return '';
  }

  return value.toString();
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs an arbitrary shell command and captures stdout/stderr.
 * Use this for negative-path assertions where CLI output is expected and should
 * remain asserted in tests instead of leaking to test output.
 */
export function runCommandSync(
  command: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  } = {},
): CommandResult {
  const { cwd = process.cwd(), env = {}, timeout = TIMEOUT_SYNC } = options;

  try {
    const stdout = execSync(command, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      status?: number;
    };
    return {
      stdout: normalizeCommandOutput(execError.stdout),
      stderr: normalizeCommandOutput(execError.stderr),
      exitCode: execError.status ?? 1,
    };
  }
}

/**
 * True when a child-process error indicates the process was killed by its own
 * timeout (wall-clock) rather than exiting with a code. Per Node's child_process
 * docs, on timeout Node sets `killed: true` and a `signal` (the killSignal,
 * default SIGTERM). A real non-zero exit has `killed: false`, `signal: null`, and
 * a NUMERIC `code`; a spawn failure (e.g. ENOENT) also has `killed: false` but a
 * STRING `code`. So the timeout signal is `killed`/`signal` — deliberately NOT a
 * string `code`: keying on that would misread a spawn failure as a timeout and
 * wrongly retry a real failure, which `setupOrThrow` must never do.
 * @param execError
 */
export function wasKilledByTimeout(execError: {
  killed?: boolean;
  signal?: string | null;
}): boolean {
  return execError.killed === true || (execError.signal !== undefined && execError.signal !== null);
}

const SOURCE_DIRECTORY = nodePath.join(__dirname, '../src');
// Holder (not a bare `let`) so the once-per-process memo can be set from inside
// warnIfDistributionStale without tripping no-top-level-assignment-in-function.
const distributionStaleness = { checked: false };

/** mtime (ms) of one dir entry as a source input: recurse into subdirectories,
 * take non-test files, ignore everything else. `*.test.ts` never staleness the
 * runtime bundle, so it is excluded. */
function sourceEntryMtime(
  directory: string,
  entry: { name: string; isDirectory: () => boolean; isFile: () => boolean },
): number | undefined {
  const fullPath = nodePath.join(directory, entry.name);
  if (entry.isDirectory()) return newestSourceMtime(fullPath);
  if (entry.isFile() && !entry.name.endsWith('.test.ts')) {
    // Guarded so the once-per-process warning stays strictly non-blocking: a file
    // vanishing between readdir and stat must not throw out of runCli.
    try {
      return statSync(fullPath).mtimeMs;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Newest mtime (ms) among non-test source files under `directory`, or undefined
 * if the tree is unreadable. */
function newestSourceMtime(directory: string): number | undefined {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return undefined;
  }
  let newest: number | undefined;
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const candidate = sourceEntryMtime(directory, entry);
    if (candidate !== undefined && (newest === undefined || candidate > newest)) {
      newest = candidate;
    }
  }
  return newest;
}

/**
 * Warn once per test process when `dist/cli.js` is older than the newest source
 * file. `runCli`/`runCliSync` exec the built bundle, so a stale dist silently
 * runs old behavior after a `src/` edit — a genuinely correct change then reads
 * as a failing test until the developer diagnoses the build staleness themselves
 * (#697). Non-blocking and self-limiting: the default `test` script rebuilds via
 * the build-lock wrapper (dist newer than src → silent), so this only fires on a
 * direct `vitest run` after editing source without rebuilding. Missing dist is
 * left to the run's own loud module-not-found failure.
 */
function warnIfDistributionStale(): void {
  if (distributionStaleness.checked) return;
  distributionStaleness.checked = true;
  let distributionMtime;
  try {
    distributionMtime = statSync(CLI_PATH).mtimeMs;
  } catch {
    return;
  }
  const newestSource = newestSourceMtime(SOURCE_DIRECTORY);
  if (newestSource !== undefined && newestSource > distributionMtime) {
    process.stderr.write(
      '\n⚠ [safeword tests] dist/cli.js is OLDER than src/ — the CLI under test may be stale.\n' +
        '  Run `bun run --cwd packages/cli build`, then re-run. (issue #697)\n\n',
    );
  }
}

/**
 * Runs the CLI with the given arguments in the specified directory
 * Uses built CLI (dist/cli.js)
 * @param args
 * @param options
 * @param options.cwd
 * @param options.env
 * @param options.timeout
 */
export async function runCli(
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  } = {},
): Promise<CliResult> {
  const { cwd = process.cwd(), env = {}, timeout = TIMEOUT_BUN_INSTALL } = options;
  warnIfDistributionStale();

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, ...env },
      timeout,
    });
    return { stdout, stderr, exitCode: 0, timedOut: false };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      status?: number;
      killed?: boolean;
      signal?: string | null;
    };
    const timedOut = wasKilledByTimeout(execError);
    const exitCode = typeof execError.code === 'number' ? execError.code : (execError.status ?? 1);
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode,
      timedOut,
    };
  }
}

/**
 * Runs the CLI synchronously (for simple tests)
 * @param args
 * @param options
 * @param options.cwd
 * @param options.env
 * @param options.timeout
 */
// eslint-disable-next-line complexity -- Complexity 11, threshold 10; extracting helpers would add indirection without benefit
export function runCliSync(
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  } = {},
): CliResult {
  const { cwd = process.cwd(), env = {}, timeout = TIMEOUT_SYNC } = options;
  warnIfDistributionStale();

  const command = `${process.execPath} ${CLI_PATH} ${args.join(' ')}`;

  try {
    const stdout = execSync(command, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0, timedOut: false };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      status?: number;
      killed?: boolean;
      signal?: string | null;
    };
    const stdout = execError.stdout?.toString() ?? '';
    const stderr = execError.stderr?.toString() ?? '';
    const timedOut = wasKilledByTimeout(execError);
    return { stdout, stderr, exitCode: execError.status ?? 1, timedOut };
  }
}

/**
 * Reads a file from the test directory
 * @param dir
 * @param relativePath
 */
export function readTestFile(dir: string, relativePath: string): string {
  return readFileSync(nodePath.join(dir, relativePath), 'utf8');
}

/**
 * Absolute path to the repo root, resolved from this file's location without a
 * subprocess (ticket #335). tests/helpers.ts is three levels below the root:
 * tests → cli → packages → root.
 */
export const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

/** Read a file by its repo-root-relative path. */
export function readRepoFile(relativePath: string): string {
  return readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
}

/**
 * Writes a file to the test directory
 * @param dir
 * @param relativePath
 * @param content
 */
export function writeTestFile(dir: string, relativePath: string, content: string): void {
  const fullPath = nodePath.join(dir, relativePath);
  const parentDirectory = nodePath.dirname(fullPath);
  if (!existsSync(parentDirectory)) {
    mkdirSync(parentDirectory, { recursive: true });
  }
  writeFileSync(fullPath, content);
}

/** A host repo's own cucumber config, for harness-collision fixtures (56JCFZ). */
export const HOST_CUCUMBER_YAML = 'default:\n  paths:\n    - tests/behaviors/**/*.feature\n';

/**
 * A customer-authored `cucumber.mjs` pointing at their own feature directory —
 * the "host harness already present" fixture shared by the collision suites
 * (56JCFZ). Setup must detect it and skip the starter lane; reset must never
 * overwrite or delete it.
 */
export const CUSTOMER_CUCUMBER_MJS = 'export default { paths: ["acceptance/**/*.feature"] };\n';

/**
 * An intentionally-unparseable `.safeword/config.json` body. The lane readers
 * (codify, lint-gherkin, the scaffolded runner) must fall back to default
 * discovery rather than crash on it (56JCFZ, TB2.AC3).
 */
export const UNPARSEABLE_LANE_CONFIG = '{ not json !!!';

/**
 * Minimal package.json shape shared by the BDD-lane / cucumber-collision suites.
 * Every field is optional — each caller asserts on the subset it cares about.
 */
export interface PackageJsonShape {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Parse a fixture's package.json into {@link PackageJsonShape}. */
export function readPackageJson(dir: string): PackageJsonShape {
  return JSON.parse(readTestFile(dir, 'package.json')) as PackageJsonShape;
}

/**
 * Write a `.safeword/config.json` with `paths.features`/`paths.steps` set —
 * the relocated-lane fixture shared by the 56JCFZ suites.
 */
export function writeSafewordPathsConfig(
  dir: string,
  options: { installedPacks?: string[]; features?: string; steps?: string } = {},
): void {
  const { installedPacks, features = 'tests/behaviors', steps = 'tests/steps' } = options;
  writeTestFile(
    dir,
    '.safeword/config.json',
    JSON.stringify(
      { ...(installedPacks && { installedPacks }), paths: { features, steps } },
      undefined,
      2,
    ),
  );
}

/**
 * Checks if a file exists in the test directory
 * @param dir
 * @param relativePath
 */
export function fileExists(dir: string, relativePath: string): boolean {
  return existsSync(nodePath.join(dir, relativePath));
}

/**
 * Initializes a git repository in the given directory
 * @param dir
 */
export function initGitRepo(dir: string): void {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', {
    cwd: dir,
    stdio: 'pipe',
  });
  execSync('git config user.name "Test User"', { cwd: dir, stdio: 'pipe' });
}

/**
 * Build the error `setupOrThrow` throws once its attempts are exhausted. A
 * timeout gets an environmental, retry-aware message distinct from the exit-code
 * failure message, so a real hang stays diagnosable and is never confused with a
 * "dist stale" failure.
 * @param label
 * @param projectDirectory
 * @param result
 * @param maxAttempts
 */
function buildSetupFailureError(
  label: string,
  projectDirectory: string,
  result: CliResult,
  maxAttempts: number,
): Error {
  if (result.timedOut) {
    return new Error(
      `${label} timed out after ${maxAttempts} attempts in ${projectDirectory}.\n` +
        `A timeout is environmental (machine under load — see issue #419), not necessarily a setup bug.\n` +
        `stderr: ${result.stderr || '(empty)'}`,
    );
  }
  return new Error(
    `${label} failed (exit ${result.exitCode}) in ${projectDirectory}.\n` +
      `Likely cause: dist/cli.js missing or stale.\n` +
      `Run: bun install && bun run --cwd packages/cli build\n` +
      `stderr: ${result.stderr || '(empty)'}`,
  );
}

/**
 * Run `safeword setup` (or variant) in a fixture and throw a loud, actionable
 * error if it fails. Use this in `beforeAll`/`beforeEach` blocks where a silent
 * setup failure would cascade into misleading test failures across the file.
 *
 * The most common silent-failure mode: `dist/cli.js` missing or stale in a fresh
 * worktree. Without this assertion, every subsequent test in the file fails with
 * "Module not found" or exit-code mismatches that look unrelated to setup.
 *
 * Retries ONCE, and ONLY on a wall-clock timeout. A timeout is environmental —
 * `safeword setup` spawned in a `beforeAll` can outrun its timeout when the machine
 * is saturated by parallel test/build processes (issue #419), succeeding cleanly in
 * isolation and on uncontended CI. A non-zero *exit* is a genuine failure and fails
 * fast/loud with no retry, so a real setup regression is never masked.
 * @param projectDirectory
 * @param setupArgs CLI args including the command (default: ['setup', '--yes'])
 */
export async function setupOrThrow(
  projectDirectory: string,
  setupArguments: string[] = ['setup', '--yes'],
  cliOptions: { env?: Record<string, string>; timeout?: number } = {},
  // Injectable for tests: defaults to the real CLI runner. Lets unit tests drive
  // the retry policy deterministically without spawning (or actually timing out)
  // a subprocess. Production callers never pass this.
  runner: typeof runCli = runCli,
): Promise<CliResult> {
  const label = `safeword ${setupArguments.join(' ')}`;
  // One retry (2 attempts). A transient contention spike usually clears by the
  // second attempt; a persistent timeout across both attempts is a real hang and
  // surfaces as a distinct, diagnosable error below.
  const maxAttempts = 2;
  let lastResult: CliResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await runner(setupArguments, { cwd: projectDirectory, ...cliOptions });
    if (result.exitCode === 0) {
      return result;
    }
    lastResult = result;
    // Retry ONLY on timeout, never on a real non-zero exit.
    if (result.timedOut && attempt < maxAttempts) {
      // Loud breadcrumb (not silent) so a recovered timeout is visible in output.
      // stderr, not console.*, to sidestep console spies in unrelated suites.
      process.stderr.write(
        `[setupOrThrow] ${label} timed out (attempt ${attempt}/${maxAttempts}) in ${projectDirectory} — ` +
          `retrying once. This is environmental (machine contention, issue #419), not a setup regression.\n`,
      );
      continue;
    }
    break;
  }

  // Defensive: the loop body always assigns lastResult before it can break/exhaust.
  if (!lastResult) {
    throw new Error(`${label} produced no result in ${projectDirectory}.`);
  }
  throw buildSetupFailureError(label, projectDirectory, lastResult, maxAttempts);
}

/**
 * Creates a configured project (runs setup) for tests that need pre-configured state.
 * Includes base packages in devDependencies to prevent sync attempts during tests.
 * @param dir
 */
export async function createConfiguredProject(dir: string): Promise<void> {
  createTypeScriptPackageJson(dir, {
    devDependencies: {
      typescript: '^5.0.0',
      // Include safeword base packages to prevent sync attempts during upgrade tests
      ...SAFEWORD_BASE_DEV_DEPENDENCIES,
    },
  });
  initGitRepo(dir);
  await setupOrThrow(dir, ['setup'], { env: SKIP_INSTALL_ENV });
}

/**
 * Measures execution time of a function in milliseconds
 * @param fn
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
  const start = performance.now();
  const result = await fn();
  const timeMs = performance.now() - start;
  return { result, timeMs };
}

/**
 * Writes .safeword/config.json for Language Packs tests.
 * `version` is optional — pass it only to simulate pre-ticket-154 projects
 * carrying the dead `version` field. New configs should omit it.
 * @param dir
 * @param config
 * @param config.installedPacks - Array of installed pack IDs
 * @param config.version - Legacy `version` field (only for migration-test fixtures)
 */
export function writeSafewordConfig(
  dir: string,
  config: { installedPacks?: string[]; version?: string } = {},
): void {
  const { installedPacks = [], version } = config;
  const payload: { installedPacks: string[]; version?: string } = { installedPacks };
  if (version !== undefined) payload.version = version;
  writeTestFile(dir, '.safeword/config.json', JSON.stringify(payload));
}

/**
 * Reads and parses .safeword/config.json
 * @param dir
 */
export function readSafewordConfig(dir: string): {
  installedPacks: string[];
  version?: string;
} {
  return JSON.parse(readTestFile(dir, '.safeword/config.json'));
}

/**
 * Check if a command-line tool is available on the system.
 * Used by tests to conditionally skip when tools aren't installed.
 */
function isCommandAvailable(command: string): boolean {
  try {
    const result = execSync(`${command} --version`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return result.length > 0;
  } catch {
    return false;
  }
}

/** Check if Ruff is installed (for Python linting tests) */
export function isRuffInstalled(): boolean {
  return isCommandAvailable('ruff');
}

/** Check if uv is installed (for Python package manager tests) */
export function isUvInstalled(): boolean {
  return isCommandAvailable('uv');
}

/** Check if Poetry is installed (for Python package manager tests) */
export function isPoetryInstalled(): boolean {
  return isCommandAvailable('poetry');
}

/** Check if mypy is installed (for Python type checking tests) */
export function isMypyInstalled(): boolean {
  return isCommandAvailable('mypy');
}

/** Check if golangci-lint is installed (for Go linting tests) */
export function isGolangciLintInstalled(): boolean {
  return isCommandAvailable('golangci-lint');
}

/**
 * Creates a Python-only project with pyproject.toml
 * @param dir
 * @param options
 * @param options.framework - Optional framework dependency (django, flask, fastapi)
 * @param options.manager - Package manager indicator (poetry, uv, pip, pipenv)
 */
export function createPythonProject(
  dir: string,
  options: {
    framework?: string;
    manager?: 'poetry' | 'uv' | 'pip' | 'pipenv';
  } = {},
): void {
  const { framework, manager = 'pip' } = options;

  let content = `[project]
name = "test-python-project"
version = "0.1.0"
`;

  if (framework) {
    content += `dependencies = ["${framework}"]\n`;
  }

  // Add manager-specific config and lockfiles for proper detection
  // Detection logic in python-setup.ts checks lockfiles first
  switch (manager) {
    case 'poetry': {
      // Poetry requires name, version, and python constraint in [tool.poetry]
      // Without python constraint, poetry assumes Python 2.7+ which fails modern deps like ruff
      // Don't create poetry.lock - let poetry create it during `poetry add`
      // Detection will work via [tool.poetry] section (see detectPythonPackageManager)
      content += `\n[tool.poetry]\nname = "test-python-project"\nversion = "0.1.0"\n\n[tool.poetry.dependencies]\npython = "^3.10"\n`;
      break;
    }
    case 'uv': {
      // uv requires requires-python in pyproject.toml
      content += `requires-python = ">=3.10"\n`;
      // Create valid minimal uv.lock for detection (must match pyproject.toml requires-python)
      writeTestFile(
        dir,
        'uv.lock',
        `version = 1
revision = 2
requires-python = ">=3.10"

[[package]]
name = "test-python-project"
version = "0.1.0"
source = { virtual = "." }
`,
      );

      break;
    }
    case 'pipenv': {
      // Create Pipfile for detection
      writeTestFile(dir, 'Pipfile', '[[source]]\nurl = "https://pypi.org/simple"\n');
      break;
    }
    case 'pip': {
      // pip is the default - no special config or lockfiles needed
      break;
    }
  }

  writeTestFile(dir, 'pyproject.toml', content);
}

/**
 * Creates a Go project with go.mod and main.go
 * @param dir
 * @param options
 * @param options.module - Module name (defaults to 'example.com/test-project')
 */
export function createGoProject(dir: string, options: { module?: string } = {}): void {
  const module = options.module ?? 'example.com/test-project';

  writeTestFile(
    dir,
    'go.mod',
    `module ${module}

go 1.22
`,
  );

  writeTestFile(
    dir,
    'main.go',
    `// Package main is the entry point.
package main

import "fmt"

func main() {
	fmt.Println("hello")
}
`,
  );
}

/**
 * Runs ESLint on a file and returns the spawn result.
 * Provides consistent interface for linting tests.
 * @param dir - Project directory with eslint.config.mjs
 * @param file - File path relative to project directory
 * @param extraArgs - Additional CLI arguments (e.g., ['--rule', 'some-rule: error'])
 */
export function runEslint(
  dir: string,
  file: string,
  extraArguments: string[] = [],
): SpawnSyncReturns<string> {
  return spawnSync('bunx', ['eslint', file, ...extraArguments], {
    cwd: dir,
    encoding: 'utf8',
  });
}

/**
 * Gets reconcile test utilities without running reconcile.
 * Use this when you need to set up files before running reconcile.
 * @param dir - Project directory
 * @param options - Setup options
 * @param options.packageJson - Custom package.json content (created if provided)
 */
export async function getReconcileTestUtilities(
  dir: string,
  options: { packageJson?: Record<string, unknown> } = {},
) {
  const { packageJson } = options;

  const { reconcile } = await import('../src/reconcile.js');
  const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
  const { createProjectContext } = await import('../src/utils/context.js');

  if (packageJson) {
    writeFileSync(nodePath.join(dir, 'package.json'), JSON.stringify(packageJson, undefined, 2));
  }

  return { reconcile, SAFEWORD_SCHEMA, createProjectContext };
}

/**
 * Sets up a project for reconcile tests by creating package.json and running install.
 * Reduces boilerplate in reconcile-based tests.
 * @param dir - Project directory
 * @param options - Setup options
 * @param options.mode - Reconcile mode (defaults to 'install')
 * @param options.packageJson - Custom package.json content
 * @returns Reconcile result and utilities for further testing
 */
export async function setupReconcileTest(
  dir: string,
  options: {
    mode?: 'install' | 'upgrade' | 'uninstall';
    packageJson?: Record<string, unknown>;
  } = {},
) {
  const { mode = 'install', packageJson = { name: 'test', version: '1.0.0' } } = options;

  const { reconcile, SAFEWORD_SCHEMA, createProjectContext } = await getReconcileTestUtilities(
    dir,
    {
      packageJson,
    },
  );

  const ctx = createProjectContext(dir);
  const result = await reconcile(SAFEWORD_SCHEMA, mode, ctx);

  return { reconcile, SAFEWORD_SCHEMA, ctx, result };
}

/**
 * Runs the post-tool-lint hook on a file.
 * Simulates Claude Code PostToolUse event for lint testing.
 * @param projectDirectory - Project directory with safeword hooks installed
 * @param filePath - Absolute path to the file being linted
 */
export function runLintHook(projectDirectory: string, filePath: string): SpawnSyncReturns<string> {
  const hookInput = JSON.stringify({
    session_id: 'test-session',
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: filePath },
  });

  return spawnSync('bash', ['-c', `echo '${hookInput}' | bun .safeword/hooks/post-tool-lint.ts`], {
    cwd: projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    encoding: 'utf8',
    timeout: 30_000,
    killSignal: 'SIGKILL',
  });
}

// ============================================================================
// Rust Test Helpers
// ============================================================================

/**
 * Check if cargo is installed
 */
function isCargoInstalled(): boolean {
  return isCommandAvailable('cargo');
}

function isRustComponentInstalled(component: string): boolean {
  if (!isCargoInstalled()) return false;
  const result = spawnSync('rustup', ['component', 'list', '--installed'], {
    encoding: 'utf8',
  });
  return result.stdout?.includes(component) ?? false;
}

export function isClippyInstalled(): boolean {
  return isRustComponentInstalled('clippy');
}

export function isRustfmtInstalled(): boolean {
  return isRustComponentInstalled('rustfmt');
}

/**
 * Creates a single-crate Rust project with Cargo.toml
 * @param dir - Directory to create project in
 * @param options - Project options
 * @param options.name - Package name (default: 'test-project')
 * @param options.edition - Rust edition (default: '2021')
 */
export function createRustProject(
  dir: string,
  options: { name?: string; edition?: string } = {},
): void {
  const name = options.name ?? 'test-project';
  const edition = options.edition ?? '2021';

  writeTestFile(
    dir,
    'Cargo.toml',
    `[package]
name = "${name}"
version = "0.1.0"
edition = "${edition}"

[dependencies]
`,
  );

  // Create src directory with main.rs
  mkdirSync(nodePath.join(dir, 'src'), { recursive: true });
  writeTestFile(
    dir,
    'src/main.rs',
    `fn main() {
    println!("Hello, world!");
}
`,
  );
}

/**
 * Creates a Rust workspace with multiple crates
 * @param dir - Directory to create workspace in
 * @param options - Workspace options
 * @param options.members - Crate names (default: ['crate-a', 'crate-b'])
 * @param options.edition - Rust edition (default: '2021')
 * @param options.useGlob - Use glob pattern `"crates/*"` instead of explicit member list
 */
export function createRustWorkspace(
  dir: string,
  options: { members?: string[]; edition?: string; useGlob?: boolean } = {},
): void {
  const members = options.members ?? ['crate-a', 'crate-b'];
  const edition = options.edition ?? '2021';

  const memberEntries = members.map(m => `"crates/${m}"`).join(', ');
  const membersField = options.useGlob ? '["crates/*"]' : `[${memberEntries}]`;

  // Root workspace Cargo.toml
  writeTestFile(
    dir,
    'Cargo.toml',
    `[workspace]
members = ${membersField}
resolver = "2"
`,
  );

  // Create each member crate
  for (const member of members) {
    const cratePath = nodePath.join('crates', member);
    mkdirSync(nodePath.join(dir, cratePath, 'src'), { recursive: true });

    writeTestFile(
      dir,
      nodePath.join(cratePath, 'Cargo.toml'),
      `[package]
name = "${member}"
version = "0.1.0"
edition = "${edition}"

[dependencies]
`,
    );

    writeTestFile(
      dir,
      nodePath.join(cratePath, 'src', 'lib.rs'),
      `pub fn hello() -> &'static str {
    "Hello from ${member}!"
}
`,
    );
  }
}

// ---------------------------------------------------------------------------
// PreToolUse hook assertion helpers (shared by write-time and commit-time
// gate integration tests — ticket J7VBGJ cross-scenario refactor).
// ---------------------------------------------------------------------------

export interface HookResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Assert a PreToolUse hook allowed the action (exit 0, no deny in stdout). */
export function expectHookAllow(result: HookResult): void {
  expect(result.status).toBe(0);
  if (result.stdout.trim() !== '') {
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string };
    };
    expect(parsed.hookSpecificOutput?.permissionDecision).not.toBe('deny');
  }
}

/** Assert a PreToolUse hook denied the action with a reason containing a substring. */
export function expectHookDeny(result: HookResult, reasonShouldContain: string): void {
  expect(result.status).toBe(0);
  const parsed = JSON.parse(result.stdout) as {
    hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string };
  };
  expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
  expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain(reasonShouldContain);
}

/**
 * Spawn an installed hook script with a JSON payload on stdin — the delivery
 * shape Claude Code uses. Shared by the hook integration suites so each file
 * doesn't re-hand-roll the spawnSync/env/timeout plumbing.
 */
export function spawnHookScript(
  hookPath: string,
  cwd: string,
  payload: Record<string, unknown>,
): HookResult {
  const result = spawnSync('bun', [hookPath], {
    input: JSON.stringify(payload),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// ---------------------------------------------------------------------------
// Retro draft-spool fixtures (shared by the retro spool/nudge/filing-gate unit
// suites and the stop-hook integration suites — ticket GH628F cross-scenario
// refactor; previously copy-pasted in eight files).
// ---------------------------------------------------------------------------

/**
 * A canonical post-egress retro draft, keyed by signature. The body carries the
 * `safeword-retro-signature` marker that dedup and drain semantics key on.
 */
export function retroDraft(
  signature: string,
  title = 'A friction',
): { signature: string; title: string; body: string; labels: string[] } {
  return {
    signature,
    title,
    body: `body for ${title}\n<!-- safeword-retro-signature: ${signature} -->`,
    labels: ['self-report', 'retro', 'rough-edge'],
  };
}

/**
 * A retro draft sealed the way `buildDraft` seals it: `bodyDigest` over the
 * final body (JDK0F0). Digest-less `retroDraft` stays the legacy fixture.
 */
export function sealedRetroDraft(
  signature: string,
  title = 'A friction',
): ReturnType<typeof retroDraft> & { bodyDigest: string } {
  const base = retroDraft(signature, title);
  return { ...base, bodyDigest: shortHash(base.body) };
}

/** Append one shape-valid ack line to a session's retro ack file (GH644A fixtures). */
export function appendRetroAck(
  dir: string,
  sessionId: string,
  signature: string,
  issue: number,
): void {
  const file = nodePath.join(dir, '.safeword', 'retro-drafts', `${sessionId}.acks.jsonl`);
  mkdirSync(nodePath.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ signature, issue })}\n`, { flag: 'a' });
}

/** Write `.safeword/config.json` with a `selfReport` block (stop-hook fixtures). */
export function writeSelfReportConfig(dir: string, selfReport: Record<string, boolean>): void {
  writeTestFile(dir, '.safeword/config.json', JSON.stringify({ selfReport }));
}

/** Absolute path of the ticket folder whose slug suffix matches, in a temp project. */
export function ticketFolderBySlug(projectDirectory: string, slug: string): string {
  const ticketsDirectory = nodePath.join(projectDirectory, '.project', 'tickets');
  const match = readdirSync(ticketsDirectory).find(entry => entry.endsWith(`-${slug}`));
  if (match === undefined) throw new Error(`no ticket folder for slug ${slug}`);
  return nodePath.join(ticketsDirectory, match);
}

/** The minted id portion of a `{id}-{slug}` ticket folder, found by slug. */
export function ticketIdBySlug(projectDirectory: string, slug: string): string {
  const [id] = nodePath.basename(ticketFolderBySlug(projectDirectory, slug)).split('-');
  if (id === undefined) throw new Error(`no id in folder for slug ${slug}`);
  return id;
}
