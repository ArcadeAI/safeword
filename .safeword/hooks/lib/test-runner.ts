/**
 * Test runner utilities for the stop hook.
 *
 * The per-language test command is resolved by the single source of truth —
 * `safeword test-plan --kind test --json` — not duplicated here. This hook only
 * EXECUTES the resolved commands (timeout-safe, no zombies) and appends the JS
 * acceptance lane (`test:bdd`), which the resolver does not emit.
 *
 * Shipped hooks cannot import safeword code, so we reach the resolver via the
 * CLI (the `safewordCliCommand()` installed→source→bunx pattern, mirroring lint.ts).
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

type TestCommand = {
  /** Label for output/diagnostics (the runner or script name). */
  script: string;
  /** Concrete shell command to execute. */
  command: string;
  /** Directory to run the command in (the resolved entry's cwd). */
  cwd: string;
};

/** One entry of `safeword test-plan --json` output. */
interface PlanEntry {
  language: string;
  cwd: string;
  command: string;
  runner: string;
  available: boolean;
}

export interface TestResult {
  /** Whether tests passed (exit code 0). */
  passed: boolean;
  /** Truncated output from the test run. */
  output: string;
  /** true if no test command was found — caller should skip, not block. */
  skipped: boolean;
  /**
   * true when a command failed because its binary was not found (exit 127 /
   * "command not found") — an environment problem (uninstalled toolchain), not a
   * red test. Lets the caller surface an install recovery instead of "tests
   * failed". (Issue #325.)
   */
  toolchainMissing?: boolean;
}

/** Timeout for test suite execution (60 seconds). */
const TEST_TIMEOUT_MS = 60_000;

/** Maximum lines of test output to inject into the block reason. */
const MAX_OUTPUT_LINES = 30;

/** Maximum characters of test output to inject into the block reason. */
const MAX_OUTPUT_CHARS = 3000;

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/**
 * Detect package manager by lockfile presence (bun > pnpm > yarn > npm).
 * Used only for the `test:bdd` acceptance lane (the resolver owns the rest).
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

/** Convert a package.json script name into the detected package manager's run command. */
function formatRunCommand(script: string, packageManager: PackageManager): string {
  if (packageManager === 'npm') return script === 'test' ? 'npm test' : `npm run ${script}`;
  return `${packageManager} run ${script}`;
}

/**
 * Resolve the safeword CLI invocation. `SAFEWORD_CLI` (a path to cli.js/cli.ts run
 * via bun) overrides for tests/dev; otherwise the installed package, then the
 * dogfood source, then `bunx`.
 */
function safewordCliCommand(cwd: string): [string, ...string[]] {
  const override = process.env.SAFEWORD_CLI;
  if (override) return ['bun', override];
  const installed = nodePath.join(cwd, 'node_modules', 'safeword', 'dist', 'cli.js');
  if (existsSync(installed)) return ['bun', installed];
  const source = nodePath.join(cwd, 'packages', 'cli', 'src', 'cli.ts');
  if (existsSync(source)) return ['bun', source];
  return ['bunx', 'safeword'];
}

/**
 * Ask `safeword test-plan` for the project's test commands and keep the runnable
 * (available) ones. Returns [] on any failure so the caller skips, never blocks.
 */
function resolvePlanCommands(cwd: string): TestCommand[] {
  const cli = safewordCliCommand(cwd);
  const result = spawnSync(
    cli[0],
    [...cli.slice(1), 'test-plan', '--kind', 'test', '--json', cwd],
    { encoding: 'utf8', timeout: TEST_TIMEOUT_MS },
  );
  if (result.status !== 0 || !result.stdout) return [];
  try {
    const entries = JSON.parse(result.stdout) as PlanEntry[];
    return entries
      .filter(entry => entry.available)
      .map(entry => ({ script: entry.runner, command: entry.command, cwd: entry.cwd }));
  } catch {
    return [];
  }
}

/** The JS acceptance lane (`test:bdd`) — consumer-side, not emitted by the resolver. */
function bddCommand(cwd: string): TestCommand | undefined {
  try {
    const pkg = JSON.parse(readFileSync(nodePath.join(cwd, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    if (pkg.scripts?.['test:bdd']) {
      return {
        script: 'test:bdd',
        command: formatRunCommand('test:bdd', detectPackageManager(cwd)),
        cwd,
      };
    }
  } catch {
    // No package.json — no acceptance lane.
  }
  return undefined;
}

/** Resolved suite (from test-plan) plus the acceptance lane; [] means skip. */
function getTestCommands(cwd: string): TestCommand[] {
  const commands = resolvePlanCommands(cwd);
  const bdd = bddCommand(cwd);
  if (bdd) commands.push(bdd);
  return commands;
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

function runSingleTestCommand(testCommand: TestCommand): {
  passed: boolean;
  output: string;
  toolchainMissing?: boolean;
} {
  try {
    const output = execSync(testCommand.command, {
      cwd: testCommand.cwd,
      timeout: TEST_TIMEOUT_MS,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { passed: true, output: formatCommandOutput(testCommand, output) };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      status?: number;
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
    // Exit 127 (or a shell "command not found") means the runner binary is
    // absent — an uninstalled toolchain, not a failing test.
    const toolchainMissing = err.status === 127 || /command not found|: not found/i.test(combined);
    return {
      passed: false,
      output: formatCommandOutput(
        testCommand,
        combined || `${testCommand.script} exited with non-zero status`,
      ),
      toolchainMissing,
    };
  }
}

/**
 * Run the project's test suite and return the result.
 *
 * - Resolves commands from `safeword test-plan` (single source of truth) + the
 *   `test:bdd` acceptance lane.
 * - Uses execSync for synchronous, timeout-safe execution (no zombie processes).
 * - Returns skipped=true if no runnable command was found (caller should not block).
 */
export function runTests(cwd: string = projectDir): TestResult {
  const commands = getTestCommands(cwd);
  if (commands.length === 0) return { passed: true, output: '', skipped: true };

  const outputs: string[] = [];

  for (const testCommand of commands) {
    const result = runSingleTestCommand(testCommand);
    outputs.push(result.output);
    if (!result.passed)
      return {
        passed: false,
        output: truncateOutput(outputs.join('\n\n')),
        skipped: false,
        toolchainMissing: result.toolchainMissing,
      };
  }

  return { passed: true, output: truncateOutput(outputs.join('\n\n')), skipped: false };
}
