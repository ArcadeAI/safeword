/**
 * Test runner utilities for the stop hook.
 * Detects and executes the project's test suite directly.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

type TestCommand = {
  /** package.json script name, e.g. test:done or test:bdd. */
  script: string;
  /** Concrete shell command to execute. */
  command: string;
};

export interface TestResult {
  /** Whether tests passed (exit code 0). */
  passed: boolean;
  /** Truncated output from the test run. */
  output: string;
  /** true if no test command was found — caller should skip, not block. */
  skipped: boolean;
}

/** Timeout for test suite execution (60 seconds). */
const TEST_TIMEOUT_MS = 60_000;

/** Maximum lines of test output to inject into the block reason. */
const MAX_OUTPUT_LINES = 30;

/** Maximum characters of test output to inject into the block reason. */
const MAX_OUTPUT_CHARS = 3000;

/**
 * Detect package manager by lockfile presence (bun > pnpm > yarn > npm).
 * Mirrors the logic in packages/cli/src/utils/install.ts.
 */
function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(nodePath.join(cwd, 'bun.lockb')) || existsSync(nodePath.join(cwd, 'bun.lock')))
    return 'bun';
  if (existsSync(nodePath.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(nodePath.join(cwd, 'yarn.lock'))) return 'yarn';
  if (existsSync(nodePath.join(cwd, 'package-lock.json'))) return 'npm';
  if (process.versions.bun) return 'bun';
  return 'npm';
}

/**
 * Convert a package.json script name into the command for the detected package
 * manager.
 */
function formatRunCommand(script: string, packageManager: PackageManager): string {
  if (packageManager === 'npm') return script === 'test' ? 'npm test' : `npm run ${script}`;
  return `${packageManager} run ${script}`;
}

/** Check whether a CLI tool is on PATH via POSIX `command -v`. */
function isToolAvailable(tool: string): boolean {
  const result = spawnSync('command', ['-v', tool], { shell: true, stdio: 'ignore' });
  return result.status === 0;
}

/**
 * Resolve the Python test command, package-manager aware (uv > poetry > bare
 * pytest). Returns undefined when no Python test toolchain is installed so the
 * caller skips rather than blocks.
 */
function pythonTestCommand(
  cwd: string,
  isAvailable: (tool: string) => boolean,
): TestCommand | undefined {
  const has = (file: string): boolean => existsSync(nodePath.join(cwd, file));
  if (has('uv.lock') && isAvailable('uv')) return { script: 'pytest', command: 'uv run pytest' };
  if (has('poetry.lock') && isAvailable('poetry'))
    return { script: 'pytest', command: 'poetry run pytest' };
  if (isAvailable('pytest')) return { script: 'pytest', command: 'pytest' };
  return undefined;
}

/**
 * Resolve the native test command for a non-JS project from its manifest, or
 * undefined when no supported manifest is present OR the toolchain isn't
 * installed (caller skips, never blocks — mirrors the lint hook's graceful
 * degradation). Pure except for the injected `isAvailable` probe, so the
 * language→command decision is unit-testable without the real toolchains.
 */
export function nativeTestCommand(
  cwd: string,
  isAvailable: (tool: string) => boolean = isToolAvailable,
): TestCommand | undefined {
  const has = (file: string): boolean => existsSync(nodePath.join(cwd, file));
  if (has('pyproject.toml') || has('requirements.txt')) return pythonTestCommand(cwd, isAvailable);
  if (has('go.mod'))
    return isAvailable('go') ? { script: 'go test', command: 'go test ./...' } : undefined;
  if (has('Cargo.toml'))
    return isAvailable('cargo') ? { script: 'cargo test', command: 'cargo test' } : undefined;
  return undefined;
}

/**
 * Detect test commands from package.json scripts. Prefers `test:done` (a
 * gate-tuned fast subset) when present, falling back to `test`, and appends
 * `test:bdd` when present so executable `.feature` scenarios are part of done
 * evidence. Projects whose full test suite exceeds TEST_TIMEOUT_MS should
 * define `test:done` as a meaningful but fast subset — unit tests + drift
 * checks typically work.
 * Returns an empty array if package.json is absent or no runnable test scripts
 * exist.
 */
function getJsTestCommands(cwd: string): TestCommand[] {
  const packageJsonPath = nodePath.join(cwd, 'package.json');
  try {
    const content = readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
    const pm = detectPackageManager(cwd);
    const scripts = pkg.scripts ?? {};
    const commands: TestCommand[] = [];
    const addCommand = (script: string): void => {
      if (commands.some(command => command.script === script)) return;
      commands.push({ script, command: formatRunCommand(script, pm) });
    };

    if (scripts['test:done']) addCommand('test:done');
    else if (scripts.test) addCommand('test');
    if (scripts['test:bdd']) addCommand('test:bdd');

    return commands;
  } catch {
    return [];
  }
}

/**
 * Resolve the test commands to run. A configured JS test script wins (it's the
 * project's chosen suite); otherwise fall back to the native language suite
 * detected from the manifest. Every project gets a package.json (ticket 102b),
 * so the presence of a real `test` script — not the file — is the JS signal.
 * Returns an empty array when nothing runnable is found (caller skips).
 */
function getTestCommands(cwd: string): TestCommand[] {
  const jsCommands = getJsTestCommands(cwd);
  if (jsCommands.length > 0) return jsCommands;
  const native = nativeTestCommand(cwd);
  return native ? [native] : [];
}

function formatCommandOutput(testCommand: TestCommand, output: string): string {
  const trimmed = output.trimEnd();
  return [`$ ${testCommand.command}`, trimmed].filter(Boolean).join('\n');
}

/**
 * Truncate output to the last N lines and at most M characters.
 * Test failures print the summary at the end — we want the tail.
 */
function truncateOutput(output: string): string {
  const lines = output.trimEnd().split('\n');
  const tail = lines.slice(-MAX_OUTPUT_LINES).join('\n');
  if (tail.length <= MAX_OUTPUT_CHARS) return tail;
  // Character cap: take the last MAX_OUTPUT_CHARS characters
  return '...(truncated)\n' + tail.slice(-MAX_OUTPUT_CHARS);
}

function runSingleTestCommand(
  cwd: string,
  testCommand: TestCommand,
): { passed: boolean; output: string } {
  try {
    const output = execSync(testCommand.command, {
      cwd,
      timeout: TEST_TIMEOUT_MS,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { passed: true, output: formatCommandOutput(testCommand, output) };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      killed?: boolean;
    };

    if (err.killed) {
      return {
        passed: false,
        output: `$ ${testCommand.command}\n${testCommand.script} timed out after ${
          TEST_TIMEOUT_MS / 1000
        }s — tests may be too slow or the runner hung.`,
      };
    }

    const combined = (err.stdout ?? '') + (err.stderr ?? '');
    return {
      passed: false,
      output: formatCommandOutput(
        testCommand,
        combined || `${testCommand.script} exited with non-zero status`,
      ),
    };
  }
}

/**
 * Run the project's test suite directly and return the result.
 *
 * - Detects test commands from package.json scripts
 * - Uses execSync for synchronous, timeout-safe execution (no zombie processes)
 * - Returns skipped=true if no test command found (caller should not block)
 */
export function runTests(cwd: string): TestResult {
  const commands = getTestCommands(cwd);
  if (commands.length === 0) return { passed: true, output: '', skipped: true };

  const outputs: string[] = [];

  for (const testCommand of commands) {
    const result = runSingleTestCommand(cwd, testCommand);
    outputs.push(result.output);
    if (!result.passed)
      return { passed: false, output: truncateOutput(outputs.join('\n\n')), skipped: false };
  }

  return { passed: true, output: truncateOutput(outputs.join('\n\n')), skipped: false };
}
