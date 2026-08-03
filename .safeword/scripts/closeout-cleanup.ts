#!/usr/bin/env bun

import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { type CloseoutBinding, readFreshCloseoutBinding } from '../hooks/lib/closeout-binding.ts';
import { readSpooledDrafts } from '../hooks/lib/retro-draft-spool.ts';

export interface PullRequestIdentity {
  url: string;
  state: string;
  headOwner: string;
  headRepository: string;
  headRefName: string;
  headRefOid: string;
}

export interface RemoteIdentity {
  name: string;
  url: string;
  oid: string;
}

export interface WorktreeIdentity {
  path: string;
  branch: string;
  oid: string;
  main: boolean;
  dirty?: boolean;
  locked?: boolean;
  prunable?: boolean;
}

export interface CloseoutObservation {
  pullRequests: PullRequestIdentity[];
  remote?: RemoteIdentity;
  remoteResolution: 'matched' | 'absent' | 'ambiguous' | 'unknown';
  localRefOid?: string;
  defaultBranch: string;
  protection: 'protected' | 'unprotected' | 'unknown';
  deliveryWorktreePath: string;
  worktrees: WorktreeIdentity[];
  verification: { current: boolean; passed: boolean; headOid: string; stateHash: string };
  retro: {
    bound: boolean;
    complete: boolean;
    pendingDrafts: number;
    failure?: 'extraction' | 'filing' | 'unknown';
  };
}

export type CleanupOperation =
  | { kind: 'remove-worktree'; cwd: string; path: string; oid: string }
  | { kind: 'delete-remote-ref'; cwd: string; remote: string; ref: string; oid: string }
  | { kind: 'delete-local-ref'; cwd: string; ref: string; oid: string };

export interface CleanupPlan {
  version: 1;
  identity?: PullRequestIdentity;
  stateHash: string;
  blockers: string[];
  completed: string[];
  operations: CleanupOperation[];
}

function normalizedRepository(url: string): string | undefined {
  const normalized = url.trim().replace(/\.git$/u, '');
  const match = normalized.match(
    /^(?:https?:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([^/]+)\/([^/]+)$/iu,
  );
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : undefined;
}

function block(plan: CleanupPlan, message: string): void {
  if (!plan.blockers.includes(message)) plan.blockers.push(message);
}

function collectPrerequisiteBlockers(
  plan: CleanupPlan,
  observation: CloseoutObservation,
  pullRequest: PullRequestIdentity | undefined,
): void {
  if (pullRequest?.state !== 'MERGED')
    block(plan, 'the exact pull request is not confirmed merged');
  if (!observation.verification.current) block(plan, 'local verification is stale');
  if (!observation.verification.passed) block(plan, 'local verification failed');
  if (!observation.retro.bound)
    block(plan, 'the current host session binding is missing or expired');
  if (observation.retro.failure === 'extraction') {
    block(plan, 'retrospective extraction failed; resolve the extraction failure');
  } else if (observation.retro.failure === 'filing') {
    block(plan, 'retrospective filing failed; resolve the filing failure');
  } else if (!observation.retro.complete) {
    block(plan, 'the current session retrospective is incomplete');
  }
  if (observation.retro.pendingDrafts > 0)
    block(plan, 'the current session filing spool has pending drafts');
  if (observation.protection === 'unknown') block(plan, 'branch protection state is unknown');
  if (observation.protection === 'protected') block(plan, 'the topic branch is protected');
  if (observation.remoteResolution === 'ambiguous') {
    block(plan, 'the pull request head repository does not map to exactly one git remote');
  }
  if (observation.remoteResolution === 'unknown') {
    block(plan, 'the remote branch state could not be observed');
  }
}

function collectRefBlockers(
  plan: CleanupPlan,
  observation: CloseoutObservation,
  pullRequest: PullRequestIdentity,
): void {
  const expectedRepository = `${pullRequest.headOwner}/${pullRequest.headRepository}`.toLowerCase();
  if (observation.defaultBranch.trim() === '') block(plan, 'the default branch is unknown');
  if (pullRequest.headRefName === observation.defaultBranch) {
    block(plan, 'the default branch is never a closeout target');
  }
  if (observation.verification.headOid !== pullRequest.headRefOid) {
    block(plan, 'verification does not cover the pull request head');
  }
  if (observation.localRefOid && observation.localRefOid !== pullRequest.headRefOid) {
    block(plan, 'the local branch no longer matches the pull request head');
  }
  if (observation.remote) {
    if (normalizedRepository(observation.remote.url) !== expectedRepository) {
      block(plan, 'the pull request head repository does not match the selected git remote');
    }
    if (observation.remote.oid !== pullRequest.headRefOid) {
      block(plan, 'the remote branch no longer matches the pull request head');
    }
  }
}

function collectWorktreeBlockers(
  plan: CleanupPlan,
  pullRequest: PullRequestIdentity,
  topicWorktrees: WorktreeIdentity[],
  mainWorktrees: WorktreeIdentity[],
  deliveryWorktreePath: string,
): void {
  if (mainWorktrees.length !== 1) block(plan, 'exactly one surviving main worktree is required');
  if (topicWorktrees.length > 1) block(plan, 'the linked topic worktree is ambiguous');
  const worktree = topicWorktrees[0];
  if (worktree && nodePath.resolve(worktree.path) !== nodePath.resolve(deliveryWorktreePath)) {
    block(plan, `the topic branch is used by a different worktree: ${worktree.path}`);
  }
  if (worktree?.main) block(plan, 'the main worktree is never a closeout target');
  if (worktree?.dirty) block(plan, `the linked worktree is dirty: ${worktree.path}`);
  if (worktree?.locked) block(plan, `the linked worktree is locked: ${worktree.path}`);
  if (worktree?.prunable) block(plan, `the worktree registration is stale: ${worktree.path}`);
  if (worktree && worktree.oid !== pullRequest.headRefOid) {
    block(plan, `the linked worktree no longer matches the pull request head: ${worktree.path}`);
  }
}

function assembleOperations(
  plan: CleanupPlan,
  observation: CloseoutObservation,
  pullRequest: PullRequestIdentity,
  worktree: WorktreeIdentity | undefined,
  mainWorktree: WorktreeIdentity,
): void {
  if (worktree) {
    plan.operations.push({
      kind: 'remove-worktree',
      cwd: mainWorktree.path,
      path: worktree.path,
      oid: pullRequest.headRefOid,
    });
  } else {
    plan.completed.push('worktree');
  }
  if (observation.remote) {
    plan.operations.push({
      kind: 'delete-remote-ref',
      cwd: mainWorktree.path,
      remote: observation.remote.name,
      ref: `refs/heads/${pullRequest.headRefName}`,
      oid: pullRequest.headRefOid,
    });
  } else {
    plan.completed.push('remote branch');
  }
  if (observation.localRefOid) {
    plan.operations.push({
      kind: 'delete-local-ref',
      cwd: mainWorktree.path,
      ref: `refs/heads/${pullRequest.headRefName}`,
      oid: pullRequest.headRefOid,
    });
  } else {
    plan.completed.push('local branch');
  }
}

export function buildCleanupPlan(observation: CloseoutObservation): CleanupPlan {
  const plan: CleanupPlan = {
    version: 1,
    stateHash: observation.verification.stateHash,
    blockers: [],
    completed: [],
    operations: [],
  };

  if (observation.pullRequests.length !== 1) {
    block(plan, 'exactly one matching pull request is required');
  }
  const pullRequest =
    observation.pullRequests.length === 1 ? observation.pullRequests[0] : undefined;
  if (pullRequest) plan.identity = pullRequest;
  collectPrerequisiteBlockers(plan, observation, pullRequest);
  if (!pullRequest) return plan;

  collectRefBlockers(plan, observation, pullRequest);
  const topicWorktrees = observation.worktrees.filter(
    worktree => worktree.branch === pullRequest.headRefName,
  );
  const mainWorktrees = observation.worktrees.filter(worktree => worktree.main);
  collectWorktreeBlockers(
    plan,
    pullRequest,
    topicWorktrees,
    mainWorktrees,
    observation.deliveryWorktreePath,
  );
  const mainWorktree = mainWorktrees[0];
  if (plan.blockers.length === 0 && mainWorktree) {
    assembleOperations(plan, observation, pullRequest, topicWorktrees[0], mainWorktree);
  }

  return plan;
}

export function cleanupPlanDigest(plan: CleanupPlan): string {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

export function operationCommand(operation: CleanupOperation): string[] {
  switch (operation.kind) {
    case 'remove-worktree':
      return ['git', '-C', operation.cwd, 'worktree', 'remove', operation.path];
    case 'delete-remote-ref':
      return [
        'git',
        '-C',
        operation.cwd,
        'push',
        `--force-with-lease=${operation.ref}:${operation.oid}`,
        operation.remote,
        `:${operation.ref}`,
      ];
    case 'delete-local-ref':
      return ['git', '-C', operation.cwd, 'update-ref', '-d', operation.ref, operation.oid];
  }
}

interface ApplyCleanupPlanInput {
  plan: CleanupPlan;
  digest: string;
  observe: () => CloseoutObservation;
  execute: (operation: CleanupOperation) => void;
}

export interface ApplyCleanupPlanResult {
  applied: boolean;
  blockers: string[];
  completed: CleanupOperation['kind'][];
  remaining: CleanupOperation['kind'][];
}

function blockedApply(
  plan: CleanupPlan,
  blockers: string[],
  completed: CleanupOperation['kind'][] = [],
): ApplyCleanupPlanResult {
  return {
    applied: false,
    blockers,
    completed,
    remaining: plan.operations.slice(completed.length).map(operation => operation.kind),
  };
}

function operationTargetMatches(
  operation: CleanupOperation,
  observation: CloseoutObservation,
  identity: PullRequestIdentity,
): boolean {
  if (operation.kind === 'remove-worktree') {
    const matches = observation.worktrees.filter(worktree => worktree.path === operation.path);
    const worktree = matches[0];
    return (
      matches.length === 1 &&
      worktree?.branch === identity.headRefName &&
      worktree.oid === operation.oid &&
      !worktree.main &&
      !worktree.dirty &&
      !worktree.locked &&
      !worktree.prunable
    );
  }
  if (operation.kind === 'delete-remote-ref') {
    return (
      observation.remoteResolution === 'matched' &&
      observation.remote?.name === operation.remote &&
      observation.remote.oid === operation.oid &&
      operation.ref === `refs/heads/${identity.headRefName}`
    );
  }
  return (
    observation.localRefOid === operation.oid &&
    operation.ref === `refs/heads/${identity.headRefName}` &&
    !observation.worktrees.some(worktree => worktree.branch === identity.headRefName)
  );
}

export function applyCleanupPlan(input: ApplyCleanupPlanInput): ApplyCleanupPlanResult {
  if (cleanupPlanDigest(input.plan) !== input.digest) {
    return blockedApply(input.plan, ['cleanup plan digest does not match']);
  }
  if (input.plan.blockers.length > 0) {
    return blockedApply(input.plan, [...input.plan.blockers]);
  }

  const current = buildCleanupPlan(input.observe());
  if (current.stateHash !== input.plan.stateHash) {
    return blockedApply(input.plan, ['repository state changed after preview']);
  }
  if (cleanupPlanDigest(current) !== input.digest) {
    return blockedApply(input.plan, ['cleanup targets changed after preview']);
  }

  const completed: CleanupOperation['kind'][] = [];
  for (const operation of input.plan.operations) {
    const observed = input.observe();
    const expected = input.plan.identity;
    const actual = observed.pullRequests.length === 1 ? observed.pullRequests[0] : undefined;
    if (
      !expected ||
      actual?.state !== 'MERGED' ||
      actual.url !== expected.url ||
      actual.headRefName !== expected.headRefName ||
      actual.headRefOid !== expected.headRefOid
    ) {
      return blockedApply(input.plan, ['pull request identity changed during cleanup'], completed);
    }
    if (!operationTargetMatches(operation, observed, expected)) {
      return blockedApply(
        input.plan,
        [`${operation.kind} target changed during cleanup`],
        completed,
      );
    }
    try {
      input.execute(operation);
      completed.push(operation.kind);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return blockedApply(input.plan, [`${operation.kind} failed: ${message}`], completed);
    }
  }

  return { applied: true, blockers: [], completed, remaining: [] };
}

export interface ProcessResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(
  command: string,
  arguments_: string[],
  cwd: string,
  options: { shell?: boolean; env?: Record<string, string | undefined> } = {},
): ProcessResult {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: 'utf8',
    shell: options.shell ?? false,
    env: { ...process.env, ...options.env },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  };
}

type ProcessRunner = (command: string, arguments_: string[], cwd: string) => ProcessResult;

export function executeCleanupOperation(
  operation: CleanupOperation,
  runner: ProcessRunner = run,
): ProcessResult {
  const [command, ...arguments_] = operationCommand(operation);
  if (!command) return { status: 1, stdout: '', stderr: 'cleanup command is empty' };
  return runner(command, arguments_, operation.cwd);
}

function git(cwd: string, ...arguments_: string[]): ProcessResult {
  return run('git', arguments_, cwd);
}

function json<T>(result: ProcessResult): T | undefined {
  if (result.status !== 0) return undefined;
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    return undefined;
  }
}

function resolveRepositoryRoot(cwd: string): string | undefined {
  const result = git(cwd, 'rev-parse', '--show-toplevel');
  return result.status === 0 ? result.stdout.trim() || undefined : undefined;
}

export function safewordCliCommand(root: string): [string, ...string[]] {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT?.trim();
  const bundledPluginCli =
    process.env.SAFEWORD_PLUGIN_CLI?.trim() ||
    (pluginRoot ? nodePath.join(pluginRoot, 'runtime', 'cli.js') : undefined);
  const override = process.env.SAFEWORD_CLI?.trim() || bundledPluginCli;
  if (override) return ['bun', override];
  const installed = nodePath.join(root, 'node_modules', 'safeword', 'dist', 'cli.js');
  if (existsSync(installed)) return ['bun', installed];
  const dogfood = nodePath.join(root, 'packages', 'cli', 'src', 'cli.ts');
  if (existsSync(dogfood)) return ['bun', dogfood];
  return ['bunx', 'safeword'];
}

function runSafeword(
  root: string,
  arguments_: string[],
  env?: Record<string, string | undefined>,
): ProcessResult {
  const [command, ...prefix] = safewordCliCommand(root);
  return run(command, [...prefix, ...arguments_], root, { env });
}

type SafewordRunner = (
  root: string,
  arguments_: string[],
  env?: Record<string, string | undefined>,
) => ProcessResult;

export function retroAgentForRuntime(runtime: CloseoutBinding['runtime']): string {
  return runtime;
}

function exactCodexTranscript(id: string): string | undefined {
  const root = nodePath.join(
    process.env.CODEX_HOME ?? nodePath.join(homedir(), '.codex'),
    'sessions',
  );
  if (!existsSync(root)) return undefined;
  const matches: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes(id)) {
        matches.push(path);
      }
    }
  };
  visit(root);
  return matches.length === 1 ? matches[0] : undefined;
}

interface TranscriptMetadata {
  sessionId?: unknown;
  session_id?: unknown;
  conversation_id?: unknown;
  cwd?: unknown;
  type?: unknown;
  payload?: { id?: unknown; cwd?: unknown };
}

function exactString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export function transcriptMatchesBinding(
  transcriptPath: string,
  binding: CloseoutBinding,
  repositoryRoot: string,
): boolean {
  if (
    !existsSync(transcriptPath) ||
    !existsSync(repositoryRoot) ||
    !existsSync(binding.projectRoot)
  )
    return false;
  const expectedRoot = realpathSync(repositoryRoot);
  if (realpathSync(binding.projectRoot) !== expectedRoot) return false;
  if (binding.runtime === 'cursor') {
    const resolvedTranscript = realpathSync(transcriptPath);
    return (
      nodePath.basename(resolvedTranscript) === `${binding.id}.jsonl` &&
      nodePath.basename(nodePath.dirname(resolvedTranscript)) === binding.id &&
      nodePath.basename(nodePath.dirname(nodePath.dirname(resolvedTranscript))) ===
        'agent-transcripts'
    );
  }
  try {
    return readFileSync(transcriptPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .some(line => {
        const record = JSON.parse(line) as TranscriptMetadata;
        const codexMetadata = record.type === 'session_meta' ? record.payload : undefined;
        const sessionId =
          exactString(record.sessionId) ??
          exactString(record.session_id) ??
          exactString(record.conversation_id) ??
          exactString(codexMetadata?.id);
        const cwd = exactString(record.cwd) ?? exactString(codexMetadata?.cwd);
        if (sessionId !== binding.id || cwd === undefined) return false;
        const resolvedCwd = realpathSync(cwd);
        if (resolvedCwd === expectedRoot) return true;
        const root = git(resolvedCwd, 'rev-parse', '--show-toplevel');
        return root.status === 0 && nodePath.resolve(root.stdout.trim()) === expectedRoot;
      });
  } catch {
    return false;
  }
}

function resolveTranscript(binding: CloseoutBinding, root: string): string | undefined {
  const candidate =
    binding.transcriptPath ??
    (binding.runtime === 'codex' ? exactCodexTranscript(binding.id) : undefined);
  return candidate && transcriptMatchesBinding(candidate, binding, root) ? candidate : undefined;
}

interface RetroFailureInput {
  complete: boolean;
  errorText: string;
  agentFilingNeeded: boolean | undefined;
  pendingDrafts: number;
}

export function classifyRetroFailure(
  input: RetroFailureInput,
): CloseoutObservation['retro']['failure'] {
  if (input.complete) return undefined;
  if (/extract/iu.test(input.errorText)) return 'extraction';
  if (input.agentFilingNeeded === true || input.pendingDrafts > 0) return 'filing';
  return 'unknown';
}

export function runBoundRetro(
  root: string,
  binding: CloseoutBinding,
  runner: SafewordRunner = runSafeword,
): CloseoutObservation['retro'] {
  const transcript = resolveTranscript(binding, root);
  if (!transcript) return { bound: false, complete: false, pendingDrafts: 0 };
  const retro = runner(
    root,
    [
      'retro',
      'run',
      '--json',
      '--auto-extract',
      '--transcript',
      transcript,
      '--session-id',
      binding.id,
    ],
    { SAFEWORD_RETRO_AGENT: retroAgentForRuntime(binding.runtime) },
  );
  const result = json<{
    state?: string;
    data?: { agent_filing_needed?: boolean };
    errors?: { message?: string }[];
  }>(retro);
  const pendingDrafts = readSpooledDrafts(root, binding.id).length;
  const complete =
    retro.status === 0 &&
    (result?.state === 'healthy' || result?.state === 'changed') &&
    result.data?.agent_filing_needed === false &&
    pendingDrafts === 0;
  const errorText = result?.errors?.map(error => error.message ?? '').join('\n') ?? '';
  const failure = classifyRetroFailure({
    complete,
    errorText,
    agentFilingNeeded: result?.data?.agent_filing_needed,
    pendingDrafts,
  });
  return {
    bound: true,
    complete,
    pendingDrafts,
    failure,
  };
}

interface TestPlanEntry {
  cwd: string;
  command: string;
  available: boolean;
}

interface VerificationReceipt {
  version: 1;
  headOid: string;
  stateHash: string;
  recordedAt: string;
}

const VERIFICATION_RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function cleanWorkingStateHash(headOid: string): string {
  return createHash('sha256').update(`${headOid}\0`).digest('hex');
}

function verificationReceiptPath(root: string): string | undefined {
  const commonDirectory = git(root, 'rev-parse', '--git-common-dir');
  const path = commonDirectory.stdout.trim();
  return commonDirectory.status === 0 && path !== ''
    ? nodePath.join(nodePath.resolve(root, path), 'safeword', 'closeout-verification.json')
    : undefined;
}

function readVerificationReceipt(
  root: string,
  expectedOid: string,
  now = new Date(),
): VerificationReceipt | undefined {
  const path = verificationReceiptPath(root);
  if (!path || !existsSync(path)) return undefined;
  try {
    const receipt = JSON.parse(readFileSync(path, 'utf8')) as Partial<VerificationReceipt>;
    const recordedAt =
      typeof receipt.recordedAt === 'string' ? Date.parse(receipt.recordedAt) : NaN;
    return receipt.version === 1 &&
      receipt.headOid === expectedOid &&
      receipt.stateHash === cleanWorkingStateHash(expectedOid) &&
      Number.isFinite(recordedAt) &&
      recordedAt <= now.getTime() &&
      now.getTime() - recordedAt <= VERIFICATION_RECEIPT_MAX_AGE_MS
      ? (receipt as VerificationReceipt)
      : undefined;
  } catch {
    return undefined;
  }
}

function invalidateVerificationReceipt(root: string): boolean {
  const path = verificationReceiptPath(root);
  if (!path || !existsSync(path)) return true;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

function writeVerificationReceipt(
  root: string,
  receipt: Omit<VerificationReceipt, 'version'>,
): boolean {
  const path = verificationReceiptPath(root);
  if (!path) return false;
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, ...receipt })}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    renameSync(temporaryPath, path);
    return true;
  } catch {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    return false;
  }
}

function workingStateHash(root: string, headOid: string): string {
  const status = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all');
  return createHash('sha256').update(`${headOid}\0${status.stdout}`).digest('hex');
}

function runVerification(root: string, expectedOid: string): CloseoutObservation['verification'] {
  const observedHead = git(root, 'rev-parse', 'HEAD').stdout.trim();
  if (observedHead !== expectedOid) {
    const receipt = readVerificationReceipt(root, expectedOid);
    return receipt
      ? {
          current: true,
          passed: true,
          headOid: receipt.headOid,
          stateHash: receipt.stateHash,
        }
      : {
          current: false,
          passed: false,
          headOid: observedHead,
          stateHash: workingStateHash(root, observedHead),
        };
  }
  let passed = invalidateVerificationReceipt(root);
  for (const kind of ['verify', 'build', 'typecheck', 'bdd', 'deps']) {
    const planResult = runSafeword(root, [
      'project',
      'test-plan',
      root,
      '--kind',
      kind,
      '--format',
      'json',
    ]);
    const plan = json<TestPlanEntry[]>(planResult);
    if (!plan || plan.some(entry => !entry.available)) {
      passed = false;
      continue;
    }
    for (const entry of plan) {
      if (run(entry.command, [], entry.cwd, { shell: true }).status !== 0) passed = false;
      if (git(root, 'rev-parse', 'HEAD').stdout.trim() !== expectedOid) passed = false;
    }
  }
  const headOid = git(root, 'rev-parse', 'HEAD').stdout.trim();
  const status = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all');
  const clean = status.status === 0 && status.stdout === '';
  const verification = {
    current: headOid === expectedOid,
    passed: passed && clean,
    headOid,
    stateHash: createHash('sha256').update(`${headOid}\0${status.stdout}`).digest('hex'),
  };
  if (verification.current && verification.passed) {
    verification.passed = writeVerificationReceipt(root, {
      headOid,
      stateHash: verification.stateHash,
      recordedAt: new Date().toISOString(),
    });
  }
  return verification;
}

interface GhPullRequest {
  url: string;
  state: string;
  headRefName: string;
  headRefOid: string;
  headRepositoryOwner?: { login?: string };
  headRepository?: { name?: string; nameWithOwner?: string };
}

function pullRequestIdentity(value: GhPullRequest): PullRequestIdentity | undefined {
  const owner =
    value.headRepositoryOwner?.login ?? value.headRepository?.nameWithOwner?.split('/')[0];
  const repository =
    value.headRepository?.name ?? value.headRepository?.nameWithOwner?.split('/')[1];
  return owner && repository
    ? {
        url: value.url,
        state: value.state,
        headOwner: owner,
        headRepository: repository,
        headRefName: value.headRefName,
        headRefOid: value.headRefOid,
      }
    : undefined;
}

function observePullRequest(root: string, pr: string): PullRequestIdentity[] {
  const result = run(
    'gh',
    [
      'pr',
      'view',
      pr,
      '--json',
      'url,state,headRefName,headRefOid,headRepositoryOwner,headRepository',
    ],
    root,
  );
  const parsed = json<GhPullRequest>(result);
  const identity = parsed && pullRequestIdentity(parsed);
  return identity ? [identity] : [];
}

function observeRemote(
  root: string,
  identity: PullRequestIdentity,
): Pick<CloseoutObservation, 'remote' | 'remoteResolution'> {
  const names = git(root, 'remote').stdout.trim().split('\n').filter(Boolean);
  const matching = names.flatMap(name => {
    const url = git(root, 'remote', 'get-url', name).stdout.trim();
    return normalizedRepository(url) ===
      `${identity.headOwner}/${identity.headRepository}`.toLowerCase()
      ? [{ name, url }]
      : [];
  });
  if (matching.length !== 1) return { remoteResolution: 'ambiguous' };
  const match = matching[0]!;
  const remoteRef = git(
    root,
    'ls-remote',
    '--refs',
    match.name,
    `refs/heads/${identity.headRefName}`,
  );
  const resolved = resolveRemoteRef(remoteRef);
  return resolved.resolution === 'matched'
    ? { remote: { ...match, oid: resolved.oid }, remoteResolution: 'matched' }
    : { remoteResolution: resolved.resolution };
}

export function resolveRemoteRef(
  result: ProcessResult,
): { resolution: 'matched'; oid: string } | { resolution: 'absent' | 'unknown' } {
  if (result.status !== 0) return { resolution: 'unknown' };
  const oid = result.stdout.trim().split(/\s+/u)[0];
  return oid ? { resolution: 'matched', oid } : { resolution: 'absent' };
}

export function parseWorktrees(root: string): WorktreeIdentity[] {
  const records = git(root, 'worktree', 'list', '--porcelain', '-z')
    .stdout.split('\0\0')
    .filter(record => record !== '');
  return records.flatMap((record, index) => {
    const fields = new Map(
      record.split('\0').map(field => {
        const split = field.indexOf(' ');
        return split < 0 ? [field, ''] : [field.slice(0, split), field.slice(split + 1)];
      }),
    );
    const path = fields.get('worktree');
    const oid = fields.get('HEAD');
    const branchRef = fields.get('branch');
    if (!path || !oid || !branchRef?.startsWith('refs/heads/')) return [];
    const status = git(path, 'status', '--porcelain=v1');
    return [
      {
        path,
        oid,
        branch: branchRef.slice('refs/heads/'.length),
        main: index === 0,
        dirty: status.status !== 0 || status.stdout.trim() !== '',
        locked: fields.has('locked'),
        prunable: fields.has('prunable'),
      },
    ];
  });
}

function observeProtection(
  root: string,
  identity: PullRequestIdentity,
): CloseoutObservation['protection'] {
  const result = run(
    'gh',
    [
      'api',
      `repos/${identity.headOwner}/${identity.headRepository}/branches/${encodeURIComponent(identity.headRefName)}`,
    ],
    root,
  );
  const parsed = json<{ protected?: boolean }>(result);
  return parsed?.protected === true
    ? 'protected'
    : parsed?.protected === false
      ? 'unprotected'
      : 'unknown';
}

export function defaultBranchArguments(identity: PullRequestIdentity): string[] {
  return [
    'repo',
    'view',
    `${identity.headOwner}/${identity.headRepository}`,
    '--json',
    'defaultBranchRef',
  ];
}

type MutableCleanupTargets = Pick<
  CloseoutObservation,
  'pullRequests' | 'remote' | 'remoteResolution' | 'localRefOid' | 'worktrees'
>;

function observeMutableCleanupTargets(root: string, pr: string): MutableCleanupTargets {
  const pullRequests = observePullRequest(root, pr);
  const identity = pullRequests[0];
  const localReference = identity
    ? git(root, 'show-ref', '--verify', '--hash', `refs/heads/${identity.headRefName}`)
    : undefined;
  const remoteObservation = identity
    ? observeRemote(root, identity)
    : { remoteResolution: 'ambiguous' as const };
  return {
    pullRequests,
    ...remoteObservation,
    localRefOid: localReference?.status === 0 ? localReference.stdout.trim() : undefined,
    worktrees: parseWorktrees(root),
  };
}

function observeCloseout(root: string, pr: string, binding: CloseoutBinding): CloseoutObservation {
  const mutableTargets = observeMutableCleanupTargets(root, pr);
  const identity = mutableTargets.pullRequests[0];
  const expectedOid = identity?.headRefOid ?? '';
  const defaultBranchResult = identity
    ? run('gh', defaultBranchArguments(identity), root)
    : { status: 1, stdout: '', stderr: 'pull request identity is unavailable' };
  const defaultBranch =
    json<{ defaultBranchRef?: { name?: string } }>(defaultBranchResult)?.defaultBranchRef?.name ??
    '';
  return {
    ...mutableTargets,
    defaultBranch,
    protection:
      identity && mutableTargets.remoteResolution === 'absent'
        ? 'unprotected'
        : identity
          ? observeProtection(root, identity)
          : 'unknown',
    deliveryWorktreePath: nodePath.resolve(root),
    verification: runVerification(root, expectedOid),
    retro: runBoundRetro(root, binding),
  };
}

function reobserveCleanupTargets(
  root: string,
  pr: string,
  baseline: CloseoutObservation,
): CloseoutObservation {
  return {
    ...baseline,
    ...observeMutableCleanupTargets(root, pr),
  };
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (import.meta.main) {
  const root = resolveRepositoryRoot(process.cwd());
  const pr = argumentValue('--pr');
  const binding = root ? readFreshCloseoutBinding({ projectDirectory: root }) : undefined;
  if (!root || !pr || !binding) {
    console.error(
      'closeout blocked: repository, --pr, and a fresh host session binding are required',
    );
    process.exit(2);
  }
  const observation = observeCloseout(root, pr, binding);
  const plan = buildCleanupPlan(observation);
  const digest = cleanupPlanDigest(plan);
  if (!process.argv.includes('--yes')) {
    process.stdout.write(`${JSON.stringify({ digest, plan }, undefined, 2)}\n`);
    process.exit(plan.blockers.length === 0 ? 0 : 2);
  }
  if (argumentValue('--plan') !== digest) {
    console.error('closeout blocked: --plan must equal the fresh preview digest');
    process.exit(2);
  }
  const survivingRoot = plan.operations[0]?.cwd ?? root;
  process.chdir(survivingRoot);
  const result = applyCleanupPlan({
    plan,
    digest,
    observe: () => reobserveCleanupTargets(survivingRoot, pr, observation),
    execute: operation => {
      const execution = executeCleanupOperation(operation);
      if (execution.status !== 0) throw new Error(execution.stderr || 'cleanup command failed');
    },
  });
  process.stdout.write(`${JSON.stringify({ digest, plan, result }, undefined, 2)}\n`);
  process.exit(result.applied ? 0 : 2);
}
