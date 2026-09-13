import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { executeNoShellCommand } from '../review/red-execution.js';
import type {
  DeliveryCommandInvocation,
  DeliveryProofSpecification,
} from './delivery-checklist.js';

const DELIVERY_PROOF_TIMEOUT_MS = 120_000;

export type DeliveryProofSubject =
  | { readonly ok: true; readonly revision: string }
  | {
      readonly ok: false;
      readonly code: 'proof_subject_dirty' | 'proof_subject_unavailable';
      readonly message: string;
    };

export type CurrentDeliveryProofSubject =
  | Extract<DeliveryProofSubject, { readonly ok: false }>
  | { readonly ok: true; readonly current: boolean; readonly revision: string };

function git(
  projectRoot: string,
  args: readonly string[],
): { readonly status: number | null; readonly stdout: string } {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: result.status, stdout: result.stdout };
}

function executionPlanPathspec(projectRoot: string, executionPlanPath: string): string | undefined {
  const relative = nodePath.relative(projectRoot, nodePath.resolve(projectRoot, executionPlanPath));
  if (
    relative === '' ||
    nodePath.isAbsolute(relative) ||
    relative === '..' ||
    relative.startsWith(`..${nodePath.sep}`)
  ) {
    return undefined;
  }
  return `:(top,exclude)${relative.split(nodePath.sep).join('/')}`;
}

function unavailable(message: string): Extract<DeliveryProofSubject, { readonly ok: false }> {
  return { ok: false, code: 'proof_subject_unavailable', message };
}

/** Capture a committed proof subject while ignoring only this ticket's Execution Plan. */
export function captureDeliveryProofSubject(input: {
  readonly projectRoot: string;
  readonly executionPlanPath: string;
}): DeliveryProofSubject {
  const excludedPlan = executionPlanPathspec(input.projectRoot, input.executionPlanPath);
  if (excludedPlan === undefined) return unavailable('Execution Plan path is outside the project.');
  const head = git(input.projectRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (head.status !== 0) return unavailable('The contribution has no readable committed revision.');
  const status = git(input.projectRoot, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--',
    '.',
    excludedPlan,
  ]);
  if (status.status !== 0) return unavailable('Safeword could not inspect the contribution state.');
  if (status.stdout !== '') {
    return {
      ok: false,
      code: 'proof_subject_dirty',
      message: 'Commit or remove changes outside execution-plan.md before recording proof.',
    };
  }
  return { ok: true, revision: head.stdout.trim() };
}

/** Decide currency without letting the plan-only receipt commit stale itself. */
export function currentDeliveryProofSubject(input: {
  readonly projectRoot: string;
  readonly executionPlanPath: string;
  readonly producingRevision: string;
}): CurrentDeliveryProofSubject {
  const captured = captureDeliveryProofSubject(input);
  if (!captured.ok) return captured;
  const excludedPlan = executionPlanPathspec(input.projectRoot, input.executionPlanPath);
  if (excludedPlan === undefined) return unavailable('Execution Plan path is outside the project.');
  const ancestor = git(input.projectRoot, [
    'merge-base',
    '--is-ancestor',
    input.producingRevision,
    captured.revision,
  ]);
  if (ancestor.status !== 0 && ancestor.status !== 1) {
    return unavailable('Safeword could not compare the producing revision with the current one.');
  }
  if (ancestor.status === 1) return { ok: true, current: false, revision: captured.revision };
  const difference = git(input.projectRoot, [
    'diff',
    '--quiet',
    input.producingRevision,
    captured.revision,
    '--',
    '.',
    excludedPlan,
  ]);
  if (difference.status !== 0 && difference.status !== 1) {
    return unavailable('Safeword could not compare the contribution contents.');
  }
  return { ok: true, current: difference.status === 0, revision: captured.revision };
}

interface DeliveryCommandProofSpecification extends DeliveryProofSpecification {
  readonly method: 'command';
  readonly invocation: DeliveryCommandInvocation;
}

export interface DeliveryProofExecutionResult {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly termination: {
    readonly exitCode: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly timedOut: boolean;
  };
  readonly stdout: { readonly bytes: number; readonly sha256: string };
  readonly stderr: { readonly bytes: number; readonly sha256: string };
}

export async function executeDeliveryCommandProof(input: {
  readonly projectRoot: string;
  readonly specification: DeliveryCommandProofSpecification;
}): Promise<DeliveryProofExecutionResult> {
  return executeNoShellCommand({
    projectRoot: input.projectRoot,
    argv: input.specification.invocation.argv,
    cwd: input.specification.invocation.cwd,
    timeoutMs: DELIVERY_PROOF_TIMEOUT_MS,
  });
}
