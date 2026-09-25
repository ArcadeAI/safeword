/**
 * Test runner utilities for the stop hook.
 *
 * The per-language test command is resolved by the single source of truth —
 * `safeword project test-plan --kind test --json` — not duplicated here. This hook only
 * EXECUTES the resolved test and acceptance commands (timeout-safe, no zombies).
 *
 * Shipped hooks cannot import safeword code, so we reach the resolver via the
 * CLI (the `safewordCliCommand()` installed→source→bunx pattern, mirroring lint.ts).
 * Installed projects should keep Safeword locally resolvable; the bunx fallback
 * needs either a warm package cache or network and fails closed when neither is available.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

type TestCommand = {
  /** Label for output/diagnostics (the runner or script name). */
  script: string;
  /** Concrete shell command to execute. */
  command: string;
  /** Directory to run the command in (the resolved entry's cwd). */
  cwd: string;
  /** False when the plan is visible but its required runner is unavailable. */
  available: boolean;
  /** Human-readable fail-closed diagnostic for an unavailable runner. */
  unavailableReason?: string;
  /** Resolver lane that owns execution policy such as the longer BDD timeout. */
  kind: 'test' | 'bdd';
};

/** One entry of the schema-1 `safeword project test-plan --json` result envelope. */
interface PlanEntry {
  language: string;
  cwd: string;
  command: string;
  runner: string;
  available: boolean;
  unavailableReason?: string;
}

interface TestPlanEnvelope {
  schema_version: 1;
  data?: {
    plan?: PlanEntry[];
  };
}

type TestPlanResolution = { ok: true; commands: TestCommand[] } | { ok: false; reason: string };

export interface TestResult {
  /** Whether tests passed (exit code 0). */
  passed: boolean;
  /** Truncated output from the test run. */
  output: string;
  /** true if no test command was found — caller should skip, not block. */
  skipped: boolean;
  /** true when the canonical test-plan command failed or returned invalid output. */
  resolutionFailed?: boolean;
  /**
   * true when a command failed because its binary was not found (exit 127 /
   * "command not found") — an environment problem (uninstalled toolchain), not a
   * red test. Lets the caller surface an install recovery instead of "tests
   * failed". (Issue #325.)
   */
  toolchainMissing?: boolean;
}

/** Fast feedback cap for test-plan commands (60 seconds). */
const TEST_TIMEOUT_MS = 60_000;

/**
 * The explicit acceptance lane can be materially slower than its unit-test
 * counterpart. Keep it bounded below Codex Stop's 600-second timeout without
 * rejecting a passing BDD suite solely for taking longer than a minute.
 */
const BDD_TEST_TIMEOUT_MS = 5 * 60_000;

/** Resolve the bounded execution budget for a planned test command. */
export function timeoutMsForTestCommand(kind: TestCommand['kind']): number {
  return kind === 'bdd' ? BDD_TEST_TIMEOUT_MS : TEST_TIMEOUT_MS;
}

/** Maximum lines of test output to inject into the block reason. */
const MAX_OUTPUT_LINES = 30;

/** Maximum characters of test output to inject into the block reason. */
const MAX_OUTPUT_CHARS = 3000;

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

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
 * Ask `safeword project test-plan` for the project's test commands. Unavailable entries remain
 * visible and fail closed without being executed. Resolver failures remain distinct from a valid
 * empty plan so the completion gate does not penalize projects that genuinely have no tests.
 */
function resolvePlanCommands(cwd: string, kind: 'test' | 'bdd'): TestPlanResolution {
  const cli = safewordCliCommand(cwd);
  const result = spawnSync(
    cli[0],
    [...cli.slice(1), 'project', 'test-plan', '--kind', kind, '--json', cwd],
    {
      encoding: 'utf8',
      timeout: TEST_TIMEOUT_MS,
      env: { ...process.env, SAFEWORD_NO_UPDATE_CHECK: '1' },
    },
  );
  if (result.error || !result.stdout) {
    const detail = result.stderr?.trim() || result.error?.message || `exited ${result.status}`;
    return { ok: false, reason: `Test plan could not be resolved: ${detail}` };
  }
  try {
    const envelope = JSON.parse(result.stdout) as TestPlanEnvelope;
    if (envelope.schema_version !== 1 || !Array.isArray(envelope.data?.plan)) {
      return { ok: false, reason: 'Test plan could not be resolved: invalid response.' };
    }
    const invalidEntry = envelope.data.plan.find(
      entry =>
        typeof entry.command !== 'string' ||
        entry.command.trim().length === 0 ||
        typeof entry.cwd !== 'string' ||
        entry.cwd.trim().length === 0 ||
        typeof entry.runner !== 'string' ||
        entry.runner.trim().length === 0 ||
        typeof entry.language !== 'string' ||
        entry.language.trim().length === 0 ||
        typeof entry.available !== 'boolean',
    );
    if (invalidEntry) {
      return { ok: false, reason: 'Test plan could not be resolved: invalid plan entry.' };
    }
    const unavailableWithoutReason = envelope.data.plan.find(
      entry => !entry.available && !entry.unavailableReason,
    );
    if (unavailableWithoutReason) {
      return {
        ok: false,
        reason: 'Test plan could not be resolved: unavailable runner has no diagnostic.',
      };
    }
    return {
      ok: true,
      commands: envelope.data.plan.map(entry => ({
        script: entry.runner,
        command: entry.command,
        cwd: entry.cwd,
        available: entry.available,
        unavailableReason: entry.unavailableReason,
        kind,
      })),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid JSON';
    return { ok: false, reason: `Test plan could not be resolved: ${detail}` };
  }
}

/** Resolved unit/native and acceptance suites, both owned by test-plan. */
function getTestCommands(cwd: string): TestPlanResolution {
  const tests = resolvePlanCommands(cwd, 'test');
  if (!tests.ok) return tests;
  const acceptance = resolvePlanCommands(cwd, 'bdd');
  if (!acceptance.ok) return acceptance;
  return { ok: true, commands: [...tests.commands, ...acceptance.commands] };
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

/**
 * Test commands are application processes, not hook children. A Codex Stop
 * handler carries its own runtime identity in these variables; forwarding them
 * makes tests that intentionally exercise another runtime misidentify itself.
 */
function testSubprocessEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment.SAFEWORD_AGENT_RUNTIME;
  delete environment.CODEX_THREAD_ID;
  return environment;
}

function runSingleTestCommand(testCommand: TestCommand): {
  passed: boolean;
  output: string;
  toolchainMissing?: boolean;
} {
  if (!testCommand.available) {
    return {
      passed: false,
      output: testCommand.unavailableReason ?? `${testCommand.script} is not installed.`,
      toolchainMissing: true,
    };
  }
  const timeoutMs = timeoutMsForTestCommand(testCommand.kind);
  try {
    const output = execSync(testCommand.command, {
      cwd: testCommand.cwd,
      timeout: timeoutMs,
      stdio: 'pipe',
      encoding: 'utf8',
      env: testSubprocessEnvironment(),
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
          timeoutMs / 1000
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
 * - Resolves unit/native and acceptance commands from `safeword project test-plan`.
 * - Uses execSync for synchronous, timeout-safe execution (no zombie processes).
 * - Returns skipped=true if no runnable command was found (caller should not block).
 */
export function runTests(cwd: string = projectDir): TestResult {
  const resolution = getTestCommands(cwd);
  if (!resolution.ok) {
    return {
      passed: false,
      output: truncateOutput(resolution.reason),
      skipped: false,
      resolutionFailed: true,
    };
  }
  const { commands } = resolution;
  if (commands.length === 0) return { passed: true, output: '', skipped: true };

  const outputs: string[] = [];
  const unavailableDiagnostics: string[] = [];
  let passed = true;
  let toolchainMissing = false;

  for (const testCommand of commands) {
    const result = runSingleTestCommand(testCommand);
    outputs.push(result.output);
    if (!testCommand.available) unavailableDiagnostics.push(result.output);
    passed &&= result.passed;
    toolchainMissing ||= result.toolchainMissing === true;
  }

  const truncatedOutput = truncateOutput(outputs.join('\n\n'));
  const omittedDiagnostics = unavailableDiagnostics.filter(
    diagnostic => !truncatedOutput.includes(diagnostic),
  );
  const output =
    omittedDiagnostics.length === 0
      ? truncatedOutput
      : truncateOutput(`${truncatedOutput}\n\n${omittedDiagnostics.join('\n')}`);

  return {
    passed,
    output,
    skipped: false,
    ...(toolchainMissing ? { toolchainMissing: true } : {}),
  };
}
