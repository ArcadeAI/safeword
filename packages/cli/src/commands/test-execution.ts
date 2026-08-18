import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  readPersonalExecutionPreference,
  readProjectExecutionPreference,
} from '../test-execution/config.js';
import {
  type ExecutionMode,
  type ResolvedExecutionMode,
  resolveExecutionMode,
} from '../test-execution/mode.js';
import {
  disableRemoteWorkflow,
  type RemoteWorkflowLifecycleResult,
  setupRemoteWorkflow,
} from '../test-execution/remote-workflow-lifecycle.js';
import { classifyRemoteWorkflow } from '../test-execution/remote-workflow-state.js';
import { type PlanEntry, type PlanKind, resolveTestPlan } from '../test-plan/resolve.js';
import { getTemplatesDirectory } from '../utils/fs.js';

const REMOTE_EXECUTION_AVAILABLE = false;
const JSON_RUNNER_OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;

function shellInvocation(command: string): readonly [string, string[]] {
  if (process.platform === 'win32') {
    return [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command]];
  }
  return ['/bin/sh', ['-c', command]];
}

interface PlanExecution {
  readonly executed: number;
  readonly failedRunner?: string;
  readonly childExit?: number | null;
  readonly childError?: { readonly code: string; readonly message: string };
  readonly childOutput?: readonly {
    readonly runner: string;
    readonly stdout: string;
    readonly stderr: string;
  }[];
}

function spawnPlanEntry(entry: PlanEntry, captureOutput: boolean) {
  const [executable, arguments_] = shellInvocation(entry.command);
  return spawnSync(executable, arguments_, {
    cwd: entry.cwd,
    env: process.env,
    encoding: 'utf8',
    stdio: captureOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    ...(captureOutput && { maxBuffer: JSON_RUNNER_OUTPUT_LIMIT_BYTES }),
  });
}

function spawnErrorCode(error: Error): string {
  return 'code' in error && typeof error.code === 'string' ? error.code : 'SPAWN_ERROR';
}

function executePlanEntry(
  entry: PlanEntry,
  delivery: { readonly json?: boolean },
  previous: PlanExecution,
): PlanExecution {
  const captureOutput = delivery.json === true;
  const result = spawnPlanEntry(entry, captureOutput);
  const execution: PlanExecution = {
    executed: previous.executed + 1,
    ...(captureOutput && {
      childOutput: [
        ...(previous.childOutput ?? []),
        { runner: entry.runner, stdout: result.stdout ?? '', stderr: result.stderr ?? '' },
      ],
    }),
  };
  if (result.error !== undefined) {
    return {
      ...execution,
      failedRunner: entry.runner,
      childExit: result.status,
      childError: { code: spawnErrorCode(result.error), message: result.error.message },
    };
  }
  return result.status === 0
    ? execution
    : { ...execution, failedRunner: entry.runner, childExit: result.status };
}

function executePlan(
  plan: readonly PlanEntry[],
  delivery: { readonly json?: boolean },
): PlanExecution {
  let execution: PlanExecution = { executed: 0 };
  for (const entry of plan) {
    if (!entry.available) continue;
    execution = executePlanEntry(entry, delivery, execution);
    if (execution.failedRunner !== undefined) return execution;
  }
  return execution;
}

const TEST_COMMAND_EFFECTS = {
  network: [
    {
      kind: 'repository-test-command',
      target: 'project-defined test plan',
      operation: 'execute with declared network access',
    },
  ],
} as const;

function executionDecision(effective: ResolvedExecutionMode) {
  const fallbackUsed = effective.mode === 'remote-preferred' && !REMOTE_EXECUTION_AVAILABLE;
  return {
    fallbackUsed,
    data: {
      remote: { available: REMOTE_EXECUTION_AVAILABLE },
      dispatch: { attempted: false },
      fallback: {
        used: fallbackUsed,
        ...(fallbackUsed && { execution: 'local', reason: 'remote-unavailable' }),
      },
    },
  };
}

function invalidExecutionRequest(message: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'SAFEWORD_TEST_EXECUTION_INVALID', message, retryable: false }],
  });
}

interface ExecutionRequest {
  readonly lane: 'done' | 'full';
  readonly commandMode?: ExecutionMode;
}

function executionModeValues(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseExecutionRequest(
  options: Readonly<Record<string, unknown>>,
): ExecutionRequest | CliResult {
  const lane = options.lane ?? 'done';
  if (lane !== 'done' && lane !== 'full') {
    return invalidExecutionRequest('Test lane must be done or full.');
  }
  const requestedModes = executionModeValues(options.execution);
  if (requestedModes.length > 1) {
    return invalidExecutionRequest('Execution mode may be specified only once.');
  }
  const commandMode = requestedModes[0];
  if (commandMode !== undefined && commandMode !== 'local' && commandMode !== 'remote-preferred') {
    return invalidExecutionRequest('Execution mode must be local or remote-preferred.');
  }
  return { lane, commandMode };
}

export function runProjectTests(
  cwd: string,
  options: Readonly<Record<string, unknown>>,
  delivery: { readonly json?: boolean } = {},
): CliResult {
  const request = parseExecutionRequest(options);
  if ('state' in request) return request;
  const { lane, commandMode } = request;

  const personal = readPersonalExecutionPreference(cwd);
  if (personal.error !== undefined) {
    return invalidExecutionRequest(
      `Personal test-execution configuration at ${personal.path} ${personal.error}.`,
    );
  }
  const project = readProjectExecutionPreference(cwd);
  const effective = resolveExecutionMode({
    command: commandMode,
    personal: personal.mode,
    project,
  });
  const planKind: PlanKind = lane === 'full' ? 'verify' : 'test';
  const plan = resolveTestPlan(cwd, { kind: planKind });
  const decision = executionDecision(effective);
  const execution = executePlan(plan, delivery);
  if (execution.failedRunner !== undefined) {
    const failureMessage =
      execution.childError === undefined
        ? `${execution.failedRunner} exited with status ${String(execution.childExit ?? 'unknown')}.`
        : `${execution.failedRunner} could not complete (${execution.childError.code}): ${execution.childError.message}`;
    return createResult({
      state: 'failed',
      exitCode: execution.childExit ?? 1,
      effects: TEST_COMMAND_EFFECTS,
      errors: [
        {
          code: 'SAFEWORD_TEST_EXECUTION_FAILED',
          message: failureMessage,
          retryable: false,
        },
      ],
      data: {
        command: 'project test',
        lane,
        effective,
        ...decision.data,
        planKind,
        ...execution,
      },
    });
  }

  return createResult({
    state: 'healthy',
    effects: TEST_COMMAND_EFFECTS,
    findings: [
      {
        code: 'SAFEWORD_TEST_EXECUTION_SELECTED',
        message: decision.fallbackUsed
          ? `Remote execution from ${effective.source} is unavailable; used the local plan before dispatch.`
          : `Test execution used ${effective.mode} mode from ${effective.source}.`,
        severity: 'info',
      },
    ],
    data: {
      command: 'project test',
      lane,
      effective,
      ...decision.data,
      planKind,
      ...execution,
    },
  });
}

export function observeTestExecutionStatus(cwd: string): CliResult {
  const personal = readPersonalExecutionPreference(cwd);
  if (personal.error !== undefined) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'SAFEWORD_TEST_EXECUTION_INVALID',
          message: `Personal test-execution configuration at ${personal.path} ${personal.error}.`,
          retryable: false,
        },
      ],
    });
  }
  const project = readProjectExecutionPreference(cwd);
  const effective = resolveExecutionMode({ personal: personal.mode, project });
  const personalOrigin = nodePath.relative(cwd, personal.path);
  return createResult({
    state: 'healthy',
    data: {
      command: 'project test-execution status',
      effective,
      remote: { available: REMOTE_EXECUTION_AVAILABLE },
      scopes: [
        { source: 'command', mode: 'not applicable' },
        { source: 'personal', mode: personal.mode, path: personalOrigin },
        { source: 'project', mode: project, path: '.safeword/config.json' },
        { source: 'built-in', mode: 'local' },
      ],
    },
  });
}

function bundledRemoteWorkflow(): string {
  return readFileSync(
    nodePath.join(getTemplatesDirectory(), 'workflows', 'remote-tests.yml'),
    'utf8',
  );
}

export function observeRemoteWorkflowStatus(cwd: string): CliResult {
  const workflow = classifyRemoteWorkflow(cwd, bundledRemoteWorkflow());
  if (workflow.state === 'failed') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REMOTE_WORKFLOW_RETRY',
          message: `Safeword could not confirm the workflow path state at ${workflow.path}; run the command again.`,
          retryable: true,
          detail: workflow.code,
        },
      ],
      data: { command: 'project test-execution remote status' },
    });
  }
  return createResult({
    state: 'healthy',
    data: { command: 'project test-execution remote status', workflow },
  });
}

function lifecycleFailure(command: string, workflow: RemoteWorkflowLifecycleResult): CliResult {
  const code = workflow.code ?? 'REMOTE_WORKFLOW_RETRY';
  const retryable = workflow.retryable ?? false;
  return createResult({
    state: workflow.state === 'failed' ? 'failed' : 'action_required',
    exitCode: 2,
    errors: [
      {
        code,
        message:
          code === 'REMOTE_WORKFLOW_CONFLICT'
            ? 'Safeword will not overwrite this workflow path. Follow the reported action, then run the command again.'
            : 'Safeword could not complete remote workflow setup safely.',
        retryable,
        detail: [workflow.operation, workflow.filesystemCode, workflow.path]
          .filter(Boolean)
          .join(' '),
      },
    ],
    data: { command, workflow },
  });
}

export function setupManagedRemoteWorkflow(cwd: string): CliResult {
  const personal = readPersonalExecutionPreference(cwd);
  if (personal.error !== undefined) {
    return invalidExecutionRequest(
      `Personal test-execution configuration at ${personal.path} ${personal.error}.`,
    );
  }
  const effective = resolveExecutionMode({
    personal: personal.mode,
    project: readProjectExecutionPreference(cwd),
  });
  const workflow = setupRemoteWorkflow(cwd, bundledRemoteWorkflow(), effective.mode);
  if (!workflow.ok) return lifecycleFailure('project test-execution remote setup', workflow);
  return createResult({
    state: workflow.changed ? 'changed' : 'healthy',
    effects: workflow.changed
      ? {
          files: [
            {
              kind: 'create',
              target: '.github/workflows/safeword-tests.yml',
              operation: 'write',
            },
          ],
        }
      : undefined,
    findings: [
      {
        code: 'REMOTE_WORKFLOW_READY',
        message:
          effective.mode === 'remote-preferred'
            ? 'Remote-preferred execution is already selected.'
            : 'Run `safeword project test --execution remote-preferred` to prefer remote execution.',
        severity: 'info',
      },
    ],
    data: { command: 'project test-execution remote setup', workflow },
  });
}

export function disableManagedRemoteWorkflow(cwd: string): CliResult {
  const workflow = disableRemoteWorkflow(cwd, bundledRemoteWorkflow());
  if (!workflow.ok) return lifecycleFailure('project test-execution remote disable', workflow);
  return createResult({
    state: workflow.changed ? 'changed' : 'healthy',
    effects: workflow.changed
      ? {
          destructive: [
            {
              kind: 'delete',
              target: '.github/workflows/safeword-tests.yml',
              operation: 'remove managed workflow',
            },
          ],
        }
      : undefined,
    findings:
      workflow.state === 'customer_owned'
        ? [
            {
              code: 'REMOTE_WORKFLOW_CUSTOMER_OWNED',
              message:
                'No Safeword workflow is installed at this path; the existing workflow is yours and was left unchanged.',
              severity: 'info',
            },
          ]
        : [],
    data: { command: 'project test-execution remote disable', workflow },
  });
}
