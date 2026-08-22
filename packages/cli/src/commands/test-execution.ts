import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  readPersonalExecutionPreference,
  readProjectTestConfig,
} from '../test-execution/config.js';
import {
  type ExecutionMode,
  type ResolvedExecutionMode,
  resolveExecutionMode,
} from '../test-execution/mode.js';
import { evaluateRemoteTestWorkflow } from '../test-execution/remote-workflow-contract.js';
import {
  disableRemoteWorkflow,
  type RemoteWorkflowLifecycleResult,
  setupRemoteWorkflow,
} from '../test-execution/remote-workflow-lifecycle.js';
import {
  classifyRemoteWorkflow,
  REMOTE_WORKFLOW_PATH,
} from '../test-execution/remote-workflow-state.js';
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
      childExit: result.status === 0 ? 1 : result.status,
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
  readonly prepareRemote: boolean;
}

function emptyPlanResult(
  lane: ExecutionRequest['lane'],
  effective: ResolvedExecutionMode,
  planKind: PlanKind,
  decision: ReturnType<typeof executionDecision>,
  execution: PlanExecution,
): CliResult {
  return createResult({
    state: 'action_required',
    exitCode: 2,
    findings: [
      {
        code: 'SAFEWORD_TEST_PLAN_EMPTY',
        message: 'No runnable test plan was found; configure a supported project test command.',
        severity: 'warning',
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

function successfulExecutionResult(
  lane: ExecutionRequest['lane'],
  effective: ResolvedExecutionMode,
  planKind: PlanKind,
  decision: ReturnType<typeof executionDecision>,
  execution: PlanExecution,
): CliResult {
  if (execution.executed === 0) {
    return emptyPlanResult(lane, effective, planKind, decision, execution);
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
  return { lane, commandMode, prepareRemote: options.prepareRemote === true };
}

function remotePreparationFailure(result: ReturnType<typeof spawnSync>): CliResult {
  const error = result.error;
  const message =
    error === undefined
      ? `Remote test setup exited with status ${String(result.status ?? 'unknown')}.`
      : `Remote test setup could not complete (${spawnErrorCode(error)}): ${error.message}`;
  return createResult({
    state: 'failed',
    exitCode: result.status === 0 ? 1 : (result.status ?? 1),
    effects: TEST_COMMAND_EFFECTS,
    errors: [{ code: 'SAFEWORD_REMOTE_SETUP_FAILED', message, retryable: false }],
    data: { command: 'project test', remotePreparation: { executed: true } },
  });
}

function prepareRemoteProject(
  cwd: string,
  command: string | undefined,
  delivery: { readonly json?: boolean },
): CliResult | undefined {
  if (command === undefined) return undefined;
  const [executable, arguments_] = shellInvocation(command);
  const result = spawnSync(executable, arguments_, {
    cwd,
    env: process.env,
    encoding: 'utf8',
    stdio: delivery.json === true ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    ...(delivery.json === true && { maxBuffer: JSON_RUNNER_OUTPUT_LIMIT_BYTES }),
  });
  return result.error === undefined && result.status === 0
    ? undefined
    : remotePreparationFailure(result);
}

function resolveExecutionContext(
  cwd: string,
  request: ExecutionRequest,
  delivery: { readonly json?: boolean },
): CliResult | { readonly effective: ResolvedExecutionMode } {
  const personal = readPersonalExecutionPreference(cwd);
  if (personal.error !== undefined) {
    return invalidExecutionRequest(
      `Personal test-execution configuration at ${personal.path} ${personal.error}.`,
    );
  }
  const project = readProjectTestConfig(cwd);
  if (project.error !== undefined) {
    return invalidExecutionRequest(
      `Project test configuration at ${project.path} ${project.error}.`,
    );
  }
  const preparationFailure = request.prepareRemote
    ? prepareRemoteProject(cwd, project.setupCommand, delivery)
    : undefined;
  if (preparationFailure !== undefined) return preparationFailure;
  return {
    effective: resolveExecutionMode({
      command: request.commandMode,
      personal: personal.mode,
      project: project.mode,
    }),
  };
}

export function runProjectTests(
  cwd: string,
  options: Readonly<Record<string, unknown>>,
  delivery: { readonly json?: boolean } = {},
): CliResult {
  const request = parseExecutionRequest(options);
  if ('state' in request) return request;
  const { lane } = request;
  const context = resolveExecutionContext(cwd, request, delivery);
  if ('state' in context) return context;
  const { effective } = context;
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

  return successfulExecutionResult(lane, effective, planKind, decision, execution);
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
  const project = readProjectTestConfig(cwd);
  if (project.error !== undefined) {
    return invalidExecutionRequest(
      `Project test configuration at ${project.path} ${project.error}.`,
    );
  }
  const effective = resolveExecutionMode({ personal: personal.mode, project: project.mode });
  const personalOrigin = nodePath.relative(cwd, personal.path).split(nodePath.sep).join('/');
  return createResult({
    state: 'healthy',
    data: {
      command: 'project test-execution status',
      effective,
      remote: { available: REMOTE_EXECUTION_AVAILABLE },
      scopes: [
        { source: 'command', mode: 'not applicable' },
        { source: 'personal', mode: personal.mode, path: personalOrigin },
        { source: 'project', mode: project.mode, path: '.safeword/config.json' },
        { source: 'built-in', mode: 'local' },
      ],
    },
  });
}

function bundledRemoteWorkflow(): { readonly content?: string; readonly error?: CliResult } {
  try {
    return {
      content: readFileSync(
        nodePath.join(getTemplatesDirectory(), 'workflows', 'remote-tests.yml'),
        'utf8',
      ),
    };
  } catch {
    return {
      error: createResult({
        state: 'failed',
        errors: [
          {
            code: 'REMOTE_WORKFLOW_BUNDLE_UNAVAILABLE',
            message: 'Safeword could not read its bundled remote-test workflow.',
            retryable: false,
          },
        ],
      }),
    };
  }
}

function validatedBundledRemoteWorkflow(): CliResult | { readonly content: string } {
  const bundled = bundledRemoteWorkflow();
  if (bundled.error !== undefined || bundled.content === undefined) {
    return bundled.error ?? invalidExecutionRequest('Bundled remote workflow is unavailable.');
  }
  const contract = evaluateRemoteTestWorkflow(bundled.content);
  return contract.accepted
    ? { content: bundled.content }
    : createResult({
        state: 'failed',
        errors: [
          {
            code: 'REMOTE_WORKFLOW_CONTRACT_INVALID',
            message: 'Safeword refused to publish a bundled workflow that failed its contract.',
            retryable: false,
            detail: contract.violations.join(', '),
          },
        ],
      });
}

export function observeRemoteWorkflowStatus(cwd: string): CliResult {
  const bundled = bundledRemoteWorkflow();
  if (bundled.error !== undefined || bundled.content === undefined) {
    return bundled.error ?? invalidExecutionRequest('Bundled remote workflow is unavailable.');
  }
  const workflow = classifyRemoteWorkflow(cwd, bundled.content);
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

function residueFindings(workflow: RemoteWorkflowLifecycleResult) {
  return workflow.warningCode === 'REMOTE_WORKFLOW_RESIDUE'
    ? [
        {
          code: workflow.warningCode,
          message: `Safeword left inert temporary workflow residue at ${workflow.residuePath ?? 'an unknown path'}; remove it when convenient.`,
          severity: 'warning' as const,
        },
      ]
    : [];
}

function lifecycleFailure(command: string, workflow: RemoteWorkflowLifecycleResult): CliResult {
  const code = workflow.code ?? 'REMOTE_WORKFLOW_RETRY';
  const retryable = workflow.retryable ?? false;
  const conflictMessage = command.endsWith(' disable')
    ? 'Safeword left the customer-owned workflow unchanged. Move it aside, then run the command again.'
    : 'Safeword will not overwrite this workflow path. Follow the reported action, then run the command again.';
  return createResult({
    state: workflow.state === 'failed' ? 'failed' : 'action_required',
    exitCode: workflow.state === 'failed' ? 1 : 2,
    errors: [
      {
        code,
        message:
          code === 'REMOTE_WORKFLOW_CONFLICT'
            ? conflictMessage
            : 'Safeword could not complete remote workflow setup safely.',
        retryable,
        detail: [workflow.operation, workflow.filesystemCode, workflow.path]
          .filter(Boolean)
          .join(' '),
      },
    ],
    findings: residueFindings(workflow),
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
  const project = readProjectTestConfig(cwd);
  if (project.error !== undefined) {
    return invalidExecutionRequest(
      `Project test configuration at ${project.path} ${project.error}.`,
    );
  }
  const effective = resolveExecutionMode({
    personal: personal.mode,
    project: project.mode,
  });
  const bundled = validatedBundledRemoteWorkflow();
  if ('state' in bundled) return bundled;
  const workflow = setupRemoteWorkflow(cwd, bundled.content, effective.mode);
  if (!workflow.ok) return lifecycleFailure('project test-execution remote setup', workflow);
  return createResult({
    state: workflow.changed ? 'changed' : 'healthy',
    effects: workflow.changed
      ? {
          files: [
            {
              kind: 'create',
              target: REMOTE_WORKFLOW_PATH,
              operation: 'write',
            },
          ],
        }
      : undefined,
    findings: [
      ...residueFindings(workflow),
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
  const bundled = bundledRemoteWorkflow();
  if (bundled.error !== undefined || bundled.content === undefined) {
    return bundled.error ?? invalidExecutionRequest('Bundled remote workflow is unavailable.');
  }
  const workflow = disableRemoteWorkflow(cwd, bundled.content);
  if (!workflow.ok) return lifecycleFailure('project test-execution remote disable', workflow);
  return createResult({
    state: workflow.changed ? 'changed' : 'healthy',
    effects: workflow.changed
      ? {
          files: [
            {
              kind: 'delete',
              target: REMOTE_WORKFLOW_PATH,
              operation: 'remove managed workflow',
            },
          ],
        }
      : undefined,
    findings: residueFindings(workflow),
    data: { command: 'project test-execution remote disable', workflow },
  });
}
