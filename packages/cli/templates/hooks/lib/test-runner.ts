/**
 * Test runner utilities for the stop hook.
 * Detects and executes the project's test suite directly.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

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
 * Detect the test command from package.json scripts.test.
 * Returns null if package.json is absent or has no test script.
 */
function getTestCommand(cwd: string): string | null {
  const packageJsonPath = nodePath.join(cwd, 'package.json');
  try {
    const content = readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
    if (!pkg.scripts?.test) return null;
    const pm = detectPackageManager(cwd);
    // Use 'run test' for bun/npm/pnpm/yarn to invoke the scripts.test command
    return pm === 'npm' ? 'npm test' : `${pm} run test`;
  } catch {
    return null;
  }
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

/**
 * Run the project's test suite directly and return the result.
 *
 * - Detects test command from package.json scripts.test
 * - Uses execFileSync for synchronous, timeout-safe execution (no zombie processes)
 * - Returns skipped=true if no test command found (caller should not block)
 */
export function runTests(cwd: string): TestResult {
  const command = getTestCommand(cwd);
  if (!command) return { passed: true, output: '', skipped: true };

  try {
    const output = execFileSync(command, {
      cwd,
      shell: true,
      timeout: TEST_TIMEOUT_MS,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { passed: true, output: truncateOutput(output), skipped: false };
  } catch (error) {
    const stdout = (error as NodeJS.ErrnoException & { stdout?: string }).stdout ?? '';
    const stderr = (error as NodeJS.ErrnoException & { stderr?: string }).stderr ?? '';
    const combined = stdout + stderr;
    return {
      passed: false,
      output: truncateOutput(combined || `Tests exited with non-zero status`),
      skipped: false,
    };
  }
}
