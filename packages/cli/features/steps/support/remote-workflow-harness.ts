import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { parse } from 'yaml';

interface WorkflowStep {
  id?: string;
  run?: string;
  uses?: string;
}

interface WorkflowDocument {
  jobs?: { test?: { steps?: WorkflowStep[] } };
}

export interface RemoteWorkflowResult {
  schema_version: 1;
  status: 'rejected' | 'passed' | 'failed' | 'incomplete';
  lane: 'done' | 'full' | null;
  requested_sha: string | null;
  observed_sha: string | null;
  rejected_reason:
    'invalid_target_sha' | 'invalid_lane' | 'checkout_unavailable' | 'head_mismatch' | null;
}

export interface RemoteWorkflowObservation {
  requestedSha: string;
  checkoutRef: string;
  executedLanes: string[];
  result: RemoteWorkflowResult;
}

export interface RejectedRequestObservation {
  checkoutCount: number;
  testCount: number;
  result: RemoteWorkflowResult;
}

export const REMOTE_WORKFLOW_TEMPLATE = nodePath.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'templates',
  'workflows',
  'remote-tests.yml',
);

function git(cwd: string, ...arguments_: string[]): string {
  return execFileSync('git', arguments_, { cwd, encoding: 'utf8' }).trim();
}

function workflowScripts(): Map<string, string> {
  return new Map(
    workflowSteps()
      .filter((step): step is WorkflowStep & { id: string; run: string } =>
        Boolean(step.id && step.run),
      )
      .map(step => [step.id, step.run]),
  );
}

function workflowSteps(): WorkflowStep[] {
  const workflow = parse(readFileSync(REMOTE_WORKFLOW_TEMPLATE, 'utf8')) as WorkflowDocument;
  return workflow.jobs?.test?.steps ?? [];
}

function runShell(script: string, cwd: string, env: NodeJS.ProcessEnv): number {
  return (
    spawnSync('/bin/bash', ['-e', '-c', script], {
      cwd,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    }).status ?? 1
  );
}

function createNonTipCheckout(root: string): {
  workspace: string;
  divergentWorkspace: string;
  requestedSha: string;
} {
  const source = nodePath.join(root, 'source');
  const workspace = nodePath.join(root, 'workspace');
  const divergentWorkspace = nodePath.join(root, 'divergent-workspace');
  mkdirSync(source);
  git(source, 'init', '-q', '-b', 'main');
  git(source, 'config', 'user.email', 'remote-tests@example.com');
  git(source, 'config', 'user.name', 'Remote tests');
  writeFileSync(nodePath.join(source, 'fixture.txt'), 'requested\n');
  git(source, 'add', 'fixture.txt');
  git(source, 'commit', '-q', '-m', 'requested');
  const requestedSha = git(source, 'rev-parse', 'HEAD');
  writeFileSync(nodePath.join(source, 'fixture.txt'), 'later tip\n');
  git(source, 'commit', '-q', '-am', 'later tip');
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${source}`, divergentWorkspace], {
    encoding: 'utf8',
  });
  git(source, 'branch', 'requested-fixture', requestedSha);
  execFileSync(
    'git',
    ['clone', '-q', '--depth', '1', '--branch', 'requested-fixture', `file://${source}`, workspace],
    { encoding: 'utf8' },
  );
  git(workspace, 'checkout', '-q', '--detach');
  git(workspace, 'branch', '-D', 'requested-fixture');
  return { workspace, divergentWorkspace, requestedSha };
}

function runTestLane(
  root: string,
  workspace: string,
  script: string,
  behavior: 'passes' | 'fails',
  lane: 'done' | 'full',
): { status: number; executedLanes: string[] } {
  const binaryDirectory = nodePath.join(root, 'bin');
  const testArguments = nodePath.join(root, 'test-arguments');
  mkdirSync(binaryDirectory);
  const npx = nodePath.join(binaryDirectory, 'npx');
  writeFileSync(
    npx,
    `#!/bin/sh\nprintf '%s\\n' --safeword-invocation-- "$@" >> "$SAFEWORD_TEST_ARGUMENTS"\nexit ${behavior === 'passes' ? '0' : '1'}\n`,
  );
  chmodSync(npx, 0o755);
  const status = runShell(script, workspace, {
    LANE: lane,
    PATH: `${binaryDirectory}:${process.env.PATH ?? ''}`,
    SAFEWORD_TEST_ARGUMENTS: testArguments,
  });
  const invocations = readFileSync(testArguments, 'utf8')
    .split('--safeword-invocation--\n')
    .filter(Boolean)
    .map(invocation => invocation.trim().split('\n'));
  const executedLanes = invocations.flatMap(arguments_ => {
    const laneIndex = arguments_.indexOf('--lane');
    const executedLane = laneIndex === -1 ? undefined : arguments_[laneIndex + 1];
    return executedLane ? [executedLane] : [];
  });
  return { status, executedLanes };
}

function invalidRevisionValue(description: string): string {
  if (description.startsWith('the branch name')) return 'main';
  if (description.startsWith('the tag name')) return 'v1.2.3';
  if (description.startsWith('the abbreviated SHA')) return '0123456';
  if (description.startsWith('exactly 39 lowercase')) return 'a'.repeat(39);
  if (description.startsWith('exactly 41 lowercase')) return 'a'.repeat(41);
  if (description.startsWith('exactly 40 uppercase')) return 'A'.repeat(40);
  if (description.startsWith('39 lowercase')) return `${'a'.repeat(39)}g`;
  if (description === 'no revision') return '';
  throw new Error(`Unknown invalid revision description: ${description}`);
}

function readResult(root: string): RemoteWorkflowResult {
  return JSON.parse(
    readFileSync(nodePath.join(root, 'safeword-remote-test-result.json'), 'utf8'),
  ) as RemoteWorkflowResult;
}

interface RejectionRun {
  checkoutCount: number;
  testCount: number;
  failed: boolean;
  validationOutcome: string;
  checkoutOutcome: string;
}

interface RejectionContext {
  root: string;
  targetSha: string;
  lane: string;
  checkoutAvailable: boolean;
  checkoutDiverged?: boolean;
}

function observeDivergentVerification(
  step: WorkflowStep,
  run: RejectionRun,
  context: RejectionContext,
): boolean {
  if (step.id !== 'verify' || !step.run || !context.checkoutDiverged) return false;
  const githubOutput = nodePath.join(context.root, 'github-output');
  writeFileSync(githubOutput, '');
  run.failed =
    runShell(step.run, context.root, {
      TARGET_SHA: context.targetSha,
      GITHUB_OUTPUT: githubOutput,
    }) !== 0;
  return true;
}

function observeStep(step: WorkflowStep, run: RejectionRun, context: RejectionContext): void {
  if (step.id === 'validate' && step.run) {
    run.failed =
      runShell(step.run, context.root, {
        TARGET_SHA: context.targetSha,
        LANE: context.lane,
      }) !== 0;
    run.validationOutcome = run.failed ? 'failure' : 'success';
  } else if (step.uses?.startsWith('actions/checkout@')) {
    run.checkoutCount += 1;
    run.failed = !context.checkoutAvailable;
    run.checkoutOutcome = run.failed ? 'failure' : 'success';
  } else if (observeDivergentVerification(step, run, context)) {
    return;
  } else if (step.id === 'tests') {
    run.testCount += 1;
  }
}

function observeUntilFailure(
  root: string,
  targetSha: string,
  lane: string,
  checkoutAvailable: boolean,
  checkoutDiverged = false,
): RejectionRun {
  const run: RejectionRun = {
    checkoutCount: 0,
    testCount: 0,
    failed: false,
    validationOutcome: 'skipped',
    checkoutOutcome: 'skipped',
  };
  const context = { root, targetSha, lane, checkoutAvailable, checkoutDiverged };
  for (const step of workflowSteps()) {
    if (step.id === 'report' || run.failed) continue;
    observeStep(step, run, context);
  }
  return run;
}

function evaluateRejectedInput(
  targetSha: string,
  lane: string,
  checkoutAvailable = true,
): RejectedRequestObservation {
  const root = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-rejected-input-'));
  try {
    const scripts = workflowScripts();
    const report = scripts.get('report');
    if (!report) throw new Error('Remote workflow scripts are incomplete.');
    const run = observeUntilFailure(root, targetSha, lane, checkoutAvailable);
    if (!run.failed) throw new Error('Rejected remote test request reached the test lane.');
    const reportStatus = runShell(report, root, {
      TARGET_SHA: targetSha,
      LANE: lane,
      VALIDATION_OUTCOME: run.validationOutcome,
      CHECKOUT_OUTCOME: run.checkoutOutcome,
      VERIFY_OUTCOME: 'skipped',
      OBSERVED_SHA: '',
      TEST_OUTCOME: 'skipped',
    });
    if (reportStatus !== 0) throw new Error('Result reporting failed.');
    return {
      checkoutCount: run.checkoutCount,
      testCount: run.testCount,
      result: readResult(root),
    };
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

export function evaluateInvalidRevision(description: string): RejectedRequestObservation {
  return evaluateRejectedInput(invalidRevisionValue(description), 'done');
}

export function evaluateUnsupportedLane(lane: string): RejectedRequestObservation {
  return evaluateRejectedInput('0123456789abcdef0123456789abcdef01234567', lane);
}

export function evaluateUnavailableRevision(targetSha: string): RejectedRequestObservation {
  return evaluateRejectedInput(targetSha, 'done', false);
}

export function evaluateCancelledRequest(
  phase: 'validation' | 'checkout' | 'revision verification',
): RemoteWorkflowResult {
  const root = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-cancelled-validation-'));
  try {
    const report = workflowScripts().get('report');
    if (!report) throw new Error('Remote workflow report script is missing.');
    const status = runShell(report, root, {
      TARGET_SHA: '0123456789abcdef0123456789abcdef01234567',
      LANE: 'done',
      VALIDATION_OUTCOME: phase === 'validation' ? 'cancelled' : 'success',
      CHECKOUT_OUTCOME: phase === 'checkout' ? 'cancelled' : 'success',
      VERIFY_OUTCOME: phase === 'revision verification' ? 'cancelled' : 'skipped',
      OBSERVED_SHA: '',
      TEST_OUTCOME: 'skipped',
    });
    if (status !== 0) throw new Error('Result reporting failed.');
    return readResult(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

export class RemoteWorkflowHarness {
  readonly #root = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-remote-workflow-'));
  readonly #workspace: string;
  readonly #divergentWorkspace: string;
  readonly requestedSha: string;

  constructor() {
    const checkout = createNonTipCheckout(this.#root);
    this.#workspace = checkout.workspace;
    this.#divergentWorkspace = checkout.divergentWorkspace;
    this.requestedSha = checkout.requestedSha;
  }

  runDivergentCheckout(): RejectedRequestObservation {
    const scripts = workflowScripts();
    const verify = scripts.get('verify');
    const report = scripts.get('report');
    if (!verify || !report) throw new Error('Remote workflow scripts are incomplete.');
    const run = observeUntilFailure(
      this.#divergentWorkspace,
      this.requestedSha,
      'done',
      true,
      true,
    );
    if (!run.failed) throw new Error('Divergent checkout passed revision verification.');
    const githubOutput = nodePath.join(this.#divergentWorkspace, 'github-output');
    const observedSha = readFileSync(githubOutput, 'utf8').trim().split('=', 2)[1] ?? '';
    const reportStatus = runShell(report, this.#divergentWorkspace, {
      TARGET_SHA: this.requestedSha,
      LANE: 'done',
      VALIDATION_OUTCOME: 'success',
      CHECKOUT_OUTCOME: 'success',
      VERIFY_OUTCOME: 'failure',
      OBSERVED_SHA: observedSha,
      TEST_OUTCOME: 'skipped',
    });
    if (reportStatus !== 0) throw new Error('Result reporting failed.');
    return {
      checkoutCount: run.checkoutCount,
      testCount: run.testCount,
      result: readResult(this.#divergentWorkspace),
    };
  }

  run(
    behavior: 'passes' | 'fails',
    lane: RemoteWorkflowResult['lane'] = 'done',
  ): RemoteWorkflowObservation {
    if (!lane) throw new Error('A supported lane is required.');
    const scripts = workflowScripts();
    const verify = scripts.get('verify');
    const tests = scripts.get('tests');
    const report = scripts.get('report');
    if (!verify || !tests || !report) throw new Error('Remote workflow scripts are incomplete.');

    const githubOutput = nodePath.join(this.#root, 'github-output');
    writeFileSync(githubOutput, '');
    const verifyStatus = runShell(verify, this.#workspace, {
      TARGET_SHA: this.requestedSha,
      GITHUB_OUTPUT: githubOutput,
    });
    if (verifyStatus !== 0) throw new Error('Revision verification failed.');
    const observedSha = readFileSync(githubOutput, 'utf8').trim().split('=', 2)[1];

    const testRun = runTestLane(this.#root, this.#workspace, tests, behavior, lane);
    const reportStatus = runShell(report, this.#workspace, {
      TARGET_SHA: this.requestedSha,
      LANE: lane,
      VALIDATION_OUTCOME: 'success',
      CHECKOUT_OUTCOME: 'success',
      VERIFY_OUTCOME: 'success',
      OBSERVED_SHA: observedSha,
      TEST_OUTCOME: testRun.status === 0 ? 'success' : 'failure',
    });
    if (reportStatus !== 0) throw new Error('Result reporting failed.');
    const result = JSON.parse(
      readFileSync(nodePath.join(this.#workspace, 'safeword-remote-test-result.json'), 'utf8'),
    ) as RemoteWorkflowResult;
    return {
      requestedSha: this.requestedSha,
      checkoutRef: git(this.#workspace, 'rev-parse', 'HEAD'),
      executedLanes: testRun.executedLanes,
      result,
    };
  }

  dispose(): void {
    rmSync(this.#root, { force: true, recursive: true });
  }
}
