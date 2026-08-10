import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  readPersonalExecutionPreference,
  readProjectExecutionPreference,
} from '../test-execution/config.js';
import { type ExecutionMode, resolveExecutionMode } from '../test-execution/mode.js';
import { type PlanKind, resolveTestPlan } from '../test-plan/resolve.js';

const REMOTE_EXECUTION_AVAILABLE = false;

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

function parseExecutionRequest(
  options: Readonly<Record<string, unknown>>,
): ExecutionRequest | CliResult {
  const lane = options.lane ?? 'done';
  if (lane !== 'done' && lane !== 'full') {
    return invalidExecutionRequest('Test lane must be done or full.');
  }
  const commandMode = options.execution;
  if (commandMode !== undefined && commandMode !== 'local' && commandMode !== 'remote-preferred') {
    return invalidExecutionRequest('Execution mode must be local or remote-preferred.');
  }
  return { lane, commandMode };
}

export function runProjectTests(
  cwd: string,
  options: Readonly<Record<string, unknown>>,
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
  let executed = 0;

  for (const entry of plan) {
    if (!entry.available) continue;
    const result = spawnSync(entry.command, {
      cwd: entry.cwd,
      env: process.env,
      shell: true,
      stdio: 'inherit',
    });
    executed += 1;
    if (result.status !== 0) {
      return createResult({
        state: 'failed',
        exitCode: result.status ?? 1,
        errors: [
          {
            code: 'SAFEWORD_TEST_EXECUTION_FAILED',
            message: `${entry.runner} exited with status ${String(result.status ?? 'unknown')}.`,
            retryable: false,
          },
        ],
        data: {
          command: 'project test',
          lane,
          effective,
          planKind,
          executed,
          childExit: result.status,
        },
      });
    }
  }

  return createResult({
    state: 'healthy',
    findings: [
      {
        code: 'SAFEWORD_TEST_EXECUTION_SELECTED',
        message: `Test execution used ${effective.mode} mode from ${effective.source}.`,
        severity: 'info',
      },
    ],
    data: {
      command: 'project test',
      lane,
      effective,
      remote: { available: REMOTE_EXECUTION_AVAILABLE },
      planKind,
      executed,
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
        { source: 'command', mode: undefined },
        { source: 'personal', mode: personal.mode, path: personalOrigin },
        { source: 'project', mode: project, path: '.safeword/config.json' },
        { source: 'built-in', mode: 'local' },
      ],
    },
  });
}
