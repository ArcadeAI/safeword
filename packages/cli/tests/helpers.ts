import { execFile, execSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Timeout constants for test operations.
 * Centralized to ensure consistency and easy adjustment.
 */
/** Quick operations that don't spawn processes (10s) */
export const TIMEOUT_QUICK = 10_000;
/** Sync CLI operations without bun install (30s) */
const TIMEOUT_SYNC = 30_000;
/** Setup commands that may run bun install with warm cache (60s) */
export const TIMEOUT_SETUP = 60_000;
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

/**
 * Creates a temporary directory for test isolation
 */
export function createTemporaryDirectory(): string {
  return mkdtempSync(nodePath.join(tmpdir(), 'safeword-test-'));
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
  const existingDevelopmentDeps = (overrides.devDependencies as Record<string, string>) ?? {};
  const pkg = {
    name: 'test-project',
    version: '1.0.0',
    ...overrides,
    devDependencies: {
      safeword: SAFEWORD_VERSION,
      ...existingDevelopmentDeps,
    },
  };
  writeFileSync(nodePath.join(dir, 'package.json'), JSON.stringify(pkg, undefined, 2));
}

/**
 * Creates a TypeScript package.json (with typescript in devDependencies)
 * Also pre-installs local safeword to ensure tests use the current build.
 * @param dir
 * @param overrides
 */
export function createTypeScriptPackageJson(
  dir: string,
  overrides: Record<string, unknown> = {},
): void {
  createPackageJson(dir, {
    devDependencies: {
      typescript: '^5.0.0',
      safeword: SAFEWORD_VERSION,
    },
    ...overrides,
  });
}

/**
 * Creates a React package.json
 * Also pre-installs local safeword to ensure tests use the current build.
 * @param dir
 * @param overrides
 */
export function createReactPackageJson(dir: string, overrides: Record<string, unknown> = {}): void {
  createPackageJson(dir, {
    dependencies: {
      react: '^18.0.0',
      'react-dom': '^18.0.0',
    },
    devDependencies: {
      safeword: SAFEWORD_VERSION,
    },
    ...overrides,
  });
}

/**
 * Creates a Next.js package.json
 * Also pre-installs local safeword to ensure tests use the current build.
 * @param dir
 * @param overrides
 */
export function createNextJsPackageJson(
  dir: string,
  overrides: Record<string, unknown> = {},
): void {
  createPackageJson(dir, {
    dependencies: {
      next: '^14.0.0',
      react: '^18.0.0',
      'react-dom': '^18.0.0',
    },
    devDependencies: {
      safeword: SAFEWORD_VERSION,
    },
    ...overrides,
  });
}

/**
 * Result from running the CLI
 */
interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
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

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, ...env },
      timeout,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      status?: number;
    };
    // execFile sets code to signal name (e.g. 'SIGTERM') on timeout kill
    const exitCode = typeof execError.code === 'number' ? execError.code : (execError.status ?? 1);
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode,
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

  const command = `${process.execPath} ${CLI_PATH} ${args.join(' ')}`;

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
    const stdout = execError.stdout?.toString() ?? '';
    const stderr = execError.stderr?.toString() ?? '';
    return { stdout, stderr, exitCode: execError.status ?? 1 };
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
 * Creates a configured project (runs setup) for tests that need pre-configured state.
 * Includes base packages in devDependencies to prevent sync attempts during tests.
 * @param dir
 */
export async function createConfiguredProject(dir: string): Promise<void> {
  createTypeScriptPackageJson(dir, {
    devDependencies: {
      typescript: '^5.0.0',
      // Include safeword base packages to prevent sync attempts during upgrade tests
      eslint: '^9.0.0',
      prettier: '^3.0.0',
      'eslint-config-prettier': '^9.0.0',
      safeword: SAFEWORD_VERSION,
      knip: '^5.0.0',
    },
  });
  initGitRepo(dir);
  await runCli(['setup'], { cwd: dir });
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
 * Measures execution time of a sync function in milliseconds
 * @param fn
 */
export function measureTimeSync<T>(fn: () => T): { result: T; timeMs: number } {
  const start = performance.now();
  const result = fn();
  const timeMs = performance.now() - start;
  return { result, timeMs };
}

/**
 * Writes .safeword/config.json for Language Packs tests
 * @param dir
 * @param config
 * @param config.installedPacks - Array of installed pack IDs
 * @param config.version - Config version (defaults to '0.15.0')
 */
export function writeSafewordConfig(
  dir: string,
  config: { installedPacks?: string[]; version?: string } = {},
): void {
  const { installedPacks = [], version = '0.15.0' } = config;
  writeTestFile(dir, '.safeword/config.json', JSON.stringify({ version, installedPacks }));
}

/**
 * Reads and parses .safeword/config.json
 * @param dir
 */
export function readSafewordConfig(dir: string): {
  version: string;
  installedPacks: string[];
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

// createRustWorkspaceWithGlob removed — use createRustWorkspace({ useGlob: true })

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
