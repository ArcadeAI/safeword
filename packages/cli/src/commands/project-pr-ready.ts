import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { realpathSync } from 'node:fs';

import { hasSafewordProjectMarker } from '../../templates/hooks/lib/namespace-root.js';
import { evaluatePrReadiness } from '../../templates/hooks/lib/pr-readiness-guard.js';
import {
  type CliResult,
  createResult,
  type Effect,
  invalidOperand,
} from '../cli-protocol/result.js';

const COMMAND = 'project pr-ready';
const CONTEXT_OVERRIDES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_CEILING_DIRECTORIES',
  'GH_REPO',
  'GH_HOST',
];

type Runner = (command: string, args: string[], directory: string) => SpawnSyncReturns<string>;
interface PullRecord {
  number: number;
  headRefOid: string;
  isDraft: boolean;
  state: string;
}

function isPullRecord(
  value: Record<string, unknown>,
): value is Record<string, unknown> & PullRecord {
  return (
    typeof value.number === 'number' &&
    Number.isSafeInteger(value.number) &&
    value.number > 0 &&
    typeof value.headRefOid === 'string' &&
    typeof value.isDraft === 'boolean' &&
    typeof value.state === 'string'
  );
}

function inspectedPull(stdout: string, pull: string | undefined): PullRecord | undefined {
  try {
    const value = JSON.parse(stdout) as unknown;
    if (value === null || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    if (!isPullRecord(record)) return undefined;
    if (pull !== undefined && String(record.number) !== pull) return undefined;
    return record;
  } catch {
    return undefined;
  }
}

function processFailure(result: SpawnSyncReturns<string>, fallback: string): string {
  return (result.stderr ?? '').trim() || result.error?.message || fallback;
}

type ProjectSelection = { ok: true; directory: string } | { ok: false; result: CliResult };

function selectedProject(cwd: string, run: Runner): ProjectSelection {
  const result = run('git', ['rev-parse', '--show-toplevel'], cwd);
  if (result.status !== 0)
    return {
      ok: false,
      result: blocked('PR_READY_NOT_WORKTREE', 'Run from a Git worktree, or select it with --cwd.'),
    };
  try {
    const project = realpathSync(result.stdout.trim());
    if (!hasSafewordProjectMarker(project))
      return {
        ok: false,
        result: blocked(
          'PR_READY_NOT_ENROLLED',
          'The selected worktree is not enrolled with Safeword.',
          project,
        ),
      };
    return { ok: true, directory: project };
  } catch {
    return {
      ok: false,
      result: blocked('PR_READY_NOT_WORKTREE', 'The selected Git worktree cannot be read.'),
    };
  }
}

function localStillCurrent(
  project: string,
  head: string,
  environment: NodeJS.ProcessEnv,
  run: Runner,
): boolean {
  const current = run('git', ['rev-parse', 'HEAD'], project);
  return (
    current.status === 0 &&
    current.stdout.trim() === head &&
    evaluatePrReadiness(project, undefined, environment).ok
  );
}

function blocked(code: string, message: string, project?: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'warning' }],
    data: { command: COMMAND, project_directory: project },
  });
}

/** Check and mutate in the command's worktree; host launch-directory hints are not authority. */
export function runProjectPrReady(cwd: string, pull?: string): CliResult {
  if (pull !== undefined && !/^[1-9]\d*$/u.test(pull))
    return invalidOperand(
      COMMAND,
      'Use a positive pull request number, or omit it for the current branch.',
    );
  const override = CONTEXT_OVERRIDES.find(name => Boolean(Reflect.get(process.env, name)));
  if (override !== undefined)
    return blocked(
      'PR_READY_CONTEXT_OVERRIDE',
      `Unset ${override} and select the worktree with --cwd.`,
    );

  // Git config injection and launch-root hints must not redirect the root lookup,
  // the shared receipt's HEAD check, or gh's repository discovery.
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !name.startsWith('GIT_') && name !== 'CLAUDE_PROJECT_DIR',
    ),
  );
  const run = (command: string, args: string[], directory: string) =>
    spawnSync(command, args, {
      cwd: directory,
      env: environment,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
  const selection = selectedProject(cwd, run);
  if (!selection.ok) return selection.result;
  const project = selection.directory;
  // There is no hook session here. Undefined deliberately selects the durable
  // exact-HEAD receipt rather than another session's active ticket.
  const readiness = evaluatePrReadiness(project, undefined, environment);
  if (!readiness.ok)
    return blocked(
      'PR_READY_NOT_FINISHED',
      readiness.reason ?? 'Complete verification and ticket closure first.',
      project,
    );

  const headResult = run('git', ['rev-parse', 'HEAD'], project);
  if (headResult.status !== 0)
    return blocked(
      'PR_READY_HEAD_UNREADABLE',
      'The selected worktree HEAD cannot be read.',
      project,
    );
  return promoteVerified(project, headResult.stdout.trim(), pull, environment, run);
}

function networkEffects(pull: string | undefined, attemptedPull?: number): Effect[] {
  const effects = [
    { kind: 'github-pull-request', target: pull ?? 'current-branch', operation: 'inspect' },
  ];
  if (attemptedPull !== undefined)
    effects.push({
      kind: 'github-pull-request',
      target: String(attemptedPull),
      operation: 'mark-ready',
    });
  return effects;
}

function promoteVerified(
  project: string,
  head: string,
  pull: string | undefined,
  environment: NodeJS.ProcessEnv,
  run: Runner,
): CliResult {
  const viewArguments = [
    'pr',
    'view',
    ...(pull === undefined ? [] : [pull]),
    '--json',
    'number,headRefOid,isDraft,state',
  ];
  const inspected = run('gh', viewArguments, project);
  const failed = (code: string, detail: string, attemptedPull?: number): CliResult =>
    createResult({
      state: 'failed',
      effects: {
        network: networkEffects(pull, attemptedPull),
      },
      errors: [{ code, message: detail, retryable: false }],
      data: { command: COMMAND, project_directory: project },
    });
  if (inspected.status !== 0)
    return failed(
      'PR_READY_INSPECTION_FAILED',
      processFailure(inspected, 'GitHub PR inspection failed.'),
    );

  const record = inspectedPull(inspected.stdout, pull);
  if (record === undefined)
    return failed(
      'PR_READY_INVALID_RESPONSE',
      'GitHub returned incomplete or inconsistent PR metadata; no promotion was attempted.',
    );
  if (record.state !== 'OPEN')
    return failed(
      'PR_READY_NOT_OPEN',
      'The selected pull request is not open; no promotion was attempted.',
    );
  if (record.headRefOid !== head)
    return failed(
      'PR_READY_HEAD_MISMATCH',
      'The PR head differs from the verified worktree HEAD. Check out and verify the PR head before retrying.',
    );
  if (!localStillCurrent(project, head, environment, run))
    return failed(
      'PR_READY_EVIDENCE_CHANGED',
      'Local HEAD or readiness evidence changed during inspection; verify the current commit and retry.',
    );
  const data = {
    command: COMMAND,
    project_directory: project,
    pull_number: record.number,
    head_sha: head,
  };
  if (!record.isDraft)
    return createResult({ state: 'healthy', effects: { network: networkEffects(pull) }, data });
  // Freeze the inspected number instead of resolving the current branch again.
  // GitHub's Ready API has no atomic expected-head condition.
  const promoted = run('gh', ['pr', 'ready', String(record.number)], project);
  if (promoted.status !== 0)
    return failed(
      'PR_READY_PROMOTION_FAILED',
      processFailure(promoted, 'GitHub Ready promotion failed.'),
      record.number,
    );
  return createResult({
    state: 'changed',
    changed: true,
    findings: [
      { code: 'PR_READY', message: 'The verified pull request is Ready.', severity: 'info' },
    ],
    effects: {
      network: networkEffects(pull, record.number),
    },
    data,
  });
}
