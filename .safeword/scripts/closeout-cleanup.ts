#!/usr/bin/env bun

import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import {
  type CloseoutBinding,
  readFreshCloseoutBinding,
  resolveExactCodexTranscript,
} from '../hooks/lib/closeout-binding.ts';
import { draftSpoolPath, readAcks, readSpooledDrafts } from '../hooks/lib/retro-draft-spool.ts';
import { resolveRunIdentity } from '../hooks/lib/run-identity.ts';

export const POST_MERGE_VERIFICATION_KINDS = ['verify', 'build', 'typecheck', 'bdd'] as const;
export const VERIFICATION_COMMAND_TIMEOUT_MS = 15 * 60 * 1000;

export interface PullRequestIdentity {
  url: string;
  state: string;
  headOwner: string;
  headRepository: string;
  headRefName: string;
  headRefOid: string;
  ciChecks: 'passed' | 'failed' | 'pending' | 'absent' | 'unknown';
}

export interface RemoteIdentity {
  name: string;
  url: string;
  pushUrl: string;
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
  realPath?: string;
  device?: number;
  inode?: number;
  gitDirectory?: string;
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
    evidenceHash: string;
    spoolPath?: string;
    failure?: 'extraction' | 'filing' | 'unknown';
  };
}

export type CleanupOperation =
  | {
      kind: 'remove-worktree';
      cwd: string;
      path: string;
      oid: string;
      branch: string;
      realPath?: string;
      device?: number;
      inode?: number;
      gitDirectory?: string;
    }
  | {
      kind: 'delete-remote-ref';
      cwd: string;
      remote: string;
      pushUrl: string;
      ref: string;
      oid: string;
    }
  | { kind: 'delete-local-ref'; cwd: string; ref: string; oid: string };

export interface CleanupPlan {
  version: 2;
  identity?: PullRequestIdentity;
  stateHash: string;
  retroStateHash: string;
  retro?: { spoolPath: string; durableSpoolPath?: string };
  blockers: string[];
  advisories: string[];
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

function advise(plan: CleanupPlan, message: string): void {
  if (!plan.advisories.includes(message)) plan.advisories.push(message);
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
    advise(plan, 'the current host session binding is missing or expired');
  if (observation.retro.failure === 'extraction') {
    advise(plan, 'retrospective extraction failed; resolve the extraction failure');
  } else if (observation.retro.failure === 'filing') {
    advise(plan, 'retrospective filing failed; resolve the filing failure');
  } else if (!observation.retro.complete) {
    advise(plan, 'the current session retrospective is incomplete');
  }
  if (observation.retro.pendingDrafts > 0)
    advise(plan, 'the current session filing spool has pending drafts');
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
    if (
      normalizedRepository(observation.remote.url) !== expectedRepository ||
      normalizedRepository(observation.remote.pushUrl) !== expectedRepository
    ) {
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
  deliveryWorktree: WorktreeIdentity | undefined,
  topicWorktrees: WorktreeIdentity[],
  defaultBranchWorktrees: WorktreeIdentity[],
  deliveryWorktreePath: string,
): void {
  if (deliveryWorktree?.branch === '') {
    block(plan, `the delivery worktree is detached: ${deliveryWorktree.path}`);
  }
  if (defaultBranchWorktrees.length !== 1) {
    block(plan, 'exactly one surviving default-branch worktree is required');
  }
  const survivor = defaultBranchWorktrees[0];
  if (survivor?.dirty) block(plan, `the surviving worktree is dirty: ${survivor.path}`);
  if (survivor?.locked) block(plan, `the surviving worktree is locked: ${survivor.path}`);
  if (survivor?.prunable)
    block(plan, `the surviving worktree registration is stale: ${survivor.path}`);
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
  survivingWorktree: WorktreeIdentity,
): void {
  if (worktree) {
    plan.operations.push({
      kind: 'remove-worktree',
      cwd: survivingWorktree.path,
      path: worktree.path,
      oid: pullRequest.headRefOid,
      branch: pullRequest.headRefName,
      realPath: worktree.realPath,
      device: worktree.device,
      inode: worktree.inode,
      gitDirectory: worktree.gitDirectory,
    });
  } else {
    plan.completed.push('worktree');
  }
  if (observation.remote) {
    plan.operations.push({
      kind: 'delete-remote-ref',
      cwd: survivingWorktree.path,
      remote: observation.remote.name,
      pushUrl: observation.remote.pushUrl,
      ref: `refs/heads/${pullRequest.headRefName}`,
      oid: pullRequest.headRefOid,
    });
  } else {
    plan.completed.push('remote branch');
  }
  if (observation.localRefOid) {
    plan.operations.push({
      kind: 'delete-local-ref',
      cwd: survivingWorktree.path,
      ref: `refs/heads/${pullRequest.headRefName}`,
      oid: pullRequest.headRefOid,
    });
  } else {
    plan.completed.push('local branch');
  }
}

export function buildCleanupPlan(observation: CloseoutObservation): CleanupPlan {
  const plan: CleanupPlan = {
    version: 2,
    stateHash: observation.verification.stateHash,
    retroStateHash: observation.retro.evidenceHash,
    blockers: [],
    advisories: [],
    completed: [],
    operations: [],
    ...(observation.retro.spoolPath ? { retro: { spoolPath: observation.retro.spoolPath } } : {}),
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
  const defaultBranchWorktrees = observation.worktrees.filter(
    worktree => worktree.branch === observation.defaultBranch,
  );
  collectWorktreeBlockers(
    plan,
    pullRequest,
    observation.worktrees.find(
      worktree =>
        nodePath.resolve(worktree.path) === nodePath.resolve(observation.deliveryWorktreePath),
    ),
    topicWorktrees,
    defaultBranchWorktrees,
    observation.deliveryWorktreePath,
  );
  const survivingWorktree = defaultBranchWorktrees[0];
  if (plan.blockers.length === 0 && survivingWorktree) {
    assembleOperations(plan, observation, pullRequest, topicWorktrees[0], survivingWorktree);
    if (plan.retro) {
      plan.retro.durableSpoolPath = nodePath.join(
        survivingWorktree.path,
        '.safeword/retro-drafts',
        nodePath.basename(plan.retro.spoolPath),
      );
    }
  }

  return plan;
}

export function cleanupPlanDigest(plan: CleanupPlan): string {
  const {
    retroStateHash: _retroStateHash,
    retro: _retro,
    advisories: _advisories,
    ...stableAuthorization
  } = plan;
  return createHash('sha256').update(JSON.stringify(stableAuthorization)).digest('hex');
}

export function operationCommand(operation: CleanupOperation): string[] {
  switch (operation.kind) {
    case 'remove-worktree':
      // This describes the final Git action for previews/tests. Execution first
      // quarantines and revalidates the worktree in removeWorktreeSafely().
      return ['git', '-C', operation.cwd, 'worktree', 'remove', operation.path];
    case 'delete-remote-ref':
      return [
        'git',
        '-C',
        operation.cwd,
        'push',
        `--force-with-lease=${operation.ref}:${operation.oid}`,
        operation.pushUrl,
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
    const expectedRepository = `${identity.headOwner}/${identity.headRepository}`.toLowerCase();
    return (
      observation.protection === 'unprotected' &&
      observation.remoteResolution === 'matched' &&
      observation.remote?.name === operation.remote &&
      normalizedRepository(observation.remote.url) === expectedRepository &&
      normalizedRepository(observation.remote.pushUrl) === expectedRepository &&
      observation.remote.pushUrl === operation.pushUrl &&
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

function operationTargetAbsent(
  operation: CleanupOperation,
  observation: CloseoutObservation,
): boolean {
  if (operation.kind === 'remove-worktree') {
    return !observation.worktrees.some(worktree => worktree.path === operation.path);
  }
  if (operation.kind === 'delete-remote-ref') {
    return observation.remoteResolution === 'absent' && observation.remote === undefined;
  }
  return observation.localRefOid === undefined;
}

export function applyCleanupPlan(input: ApplyCleanupPlanInput): ApplyCleanupPlanResult {
  if (cleanupPlanDigest(input.plan) !== input.digest) {
    return blockedApply(input.plan, ['cleanup plan digest does not match']);
  }
  if (input.plan.blockers.length > 0) {
    return blockedApply(input.plan, [...input.plan.blockers]);
  }

  const current = buildCleanupPlan(input.observe());
  if (current.blockers.length > 0) {
    return blockedApply(input.plan, [...current.blockers]);
  }
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
      actual.headOwner !== expected.headOwner ||
      actual.headRepository !== expected.headRepository ||
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return blockedApply(input.plan, [`${operation.kind} failed: ${message}`], completed);
    }
    if (!operationTargetAbsent(operation, input.observe())) {
      return blockedApply(
        input.plan,
        [`${operation.kind} did not remove the exact target`],
        completed,
      );
    }
    completed.push(operation.kind);
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
  options: {
    shell?: boolean;
    env?: Record<string, string | undefined>;
    timeout?: number;
  } = {},
): ProcessResult {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: 'utf8',
    shell: options.shell ?? false,
    env: { ...process.env, ...options.env },
    timeout: options.timeout,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  };
}

type ProcessRunner = (command: string, arguments_: string[], cwd: string) => ProcessResult;

type PathIdentity = Pick<WorktreeIdentity, 'realPath' | 'device' | 'inode'>;

function inspectPathIdentity(path: string): PathIdentity | undefined {
  try {
    const stat = statSync(path);
    return { realPath: realpathSync(path), device: stat.dev, inode: stat.ino };
  } catch {
    return undefined;
  }
}

function registryEntryMatches(
  operation: Extract<CleanupOperation, { kind: 'remove-worktree' }>,
  output: string,
  expectedPath = operation.path,
): boolean {
  const matches = parseWorktreePorcelain(output).filter(
    candidate => candidate.path === expectedPath,
  );
  const candidate = matches[0];
  return (
    matches.length === 1 &&
    candidate?.branch === operation.branch &&
    candidate.oid === operation.oid &&
    !candidate.main &&
    !candidate.locked &&
    !candidate.prunable
  );
}

function removeWorktreeSafely(
  operation: Extract<CleanupOperation, { kind: 'remove-worktree' }>,
  runner: ProcessRunner,
  inspectIdentity: (path: string) => PathIdentity | undefined,
): ProcessResult {
  const registry = runner(
    'git',
    ['-C', operation.cwd, 'worktree', 'list', '--porcelain', '-z'],
    operation.cwd,
  );
  if (registry.status !== 0 || !registryEntryMatches(operation, registry.stdout)) {
    return { status: 1, stdout: '', stderr: 'worktree registration changed before removal' };
  }
  const quarantinePath = nodePath.join(
    nodePath.dirname(operation.path),
    `.${nodePath.basename(operation.path)}.safeword-closeout-${randomUUID()}`,
  );
  const moved = runner(
    'git',
    ['-C', operation.cwd, 'worktree', 'move', operation.path, quarantinePath],
    operation.cwd,
  );
  if (moved.status !== 0) {
    return { status: 1, stdout: '', stderr: 'worktree could not be quarantined before removal' };
  }
  const blockedAfterQuarantine = (message: string): ProcessResult => {
    const restored = runner(
      'git',
      ['-C', operation.cwd, 'worktree', 'move', quarantinePath, operation.path],
      operation.cwd,
    );
    return {
      status: 1,
      stdout: '',
      stderr:
        restored.status === 0
          ? message
          : `${message}; worktree restoration failed: ${restored.stderr.trim() || 'unknown error'}`,
    };
  };
  const identity = inspectIdentity(quarantinePath);
  if (!identity || identity.device !== operation.device || identity.inode !== operation.inode) {
    return blockedAfterQuarantine('worktree filesystem identity changed before removal');
  }
  const quarantinedRegistry = runner(
    'git',
    ['-C', operation.cwd, 'worktree', 'list', '--porcelain', '-z'],
    operation.cwd,
  );
  if (
    quarantinedRegistry.status !== 0 ||
    !registryEntryMatches(operation, quarantinedRegistry.stdout, quarantinePath)
  ) {
    return blockedAfterQuarantine('quarantined worktree registration changed');
  }
  const gitDirectory = runner(
    'git',
    ['-C', quarantinePath, 'rev-parse', '--absolute-git-dir'],
    operation.cwd,
  );
  if (gitDirectory.status !== 0 || gitDirectory.stdout.trim() !== operation.gitDirectory) {
    return blockedAfterQuarantine('worktree git identity changed before removal');
  }
  const head = runner('git', ['-C', quarantinePath, 'rev-parse', 'HEAD'], operation.cwd);
  if (head.status !== 0 || head.stdout.trim() !== operation.oid) {
    return blockedAfterQuarantine('worktree HEAD changed before removal');
  }
  const status = runner(
    'git',
    ['-C', quarantinePath, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
    operation.cwd,
  );
  if (status.status !== 0 || status.stdout !== '') {
    return blockedAfterQuarantine('worktree became dirty before removal');
  }
  const removed = runner(
    'git',
    ['-C', operation.cwd, 'worktree', 'remove', quarantinePath],
    operation.cwd,
  );
  return removed.status === 0
    ? removed
    : blockedAfterQuarantine(
        `quarantined worktree removal failed: ${removed.stderr.trim() || 'unknown error'}`,
      );
}

export function executeCleanupOperation(
  operation: CleanupOperation,
  runner: ProcessRunner = run,
  inspectIdentity: (path: string) => PathIdentity | undefined = inspectPathIdentity,
): ProcessResult {
  if (operation.kind === 'remove-worktree') {
    return removeWorktreeSafely(operation, runner, inspectIdentity);
  }
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

function repositoryOwnership(root: string): string | undefined {
  const commonDirectory = git(root, 'rev-parse', '--git-common-dir');
  if (commonDirectory.status !== 0) return undefined;
  const path = commonDirectory.stdout.trim();
  if (!path) return undefined;
  try {
    return realpathSync(nodePath.resolve(root, path));
  } catch {
    return undefined;
  }
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
    const transcript = readFileSync(transcriptPath, 'utf8');
    const lastNewline = transcript.lastIndexOf('\n');
    return transcript
      .slice(0, lastNewline + 1)
      .split('\n')
      .filter(Boolean)
      .some(line => {
        let record: TranscriptMetadata;
        try {
          record = JSON.parse(line) as TranscriptMetadata;
        } catch {
          return false;
        }
        const codexMetadata = record.type === 'session_meta' ? record.payload : undefined;
        const sessionId =
          exactString(record.sessionId) ??
          exactString(record.session_id) ??
          exactString(record.conversation_id) ??
          exactString(codexMetadata?.id);
        if (sessionId !== binding.id) return false;
        const recordedRoot = exactString(record.cwd) ?? exactString(codexMetadata?.cwd);
        if (binding.runtime !== 'codex' || !recordedRoot) return true;
        const recordedOwnership = repositoryOwnership(recordedRoot);
        const currentOwnership = repositoryOwnership(repositoryRoot);
        return Boolean(
          recordedOwnership && currentOwnership && recordedOwnership === currentOwnership,
        );
      });
  } catch {
    return false;
  }
}

function resolveTranscript(binding: CloseoutBinding, root: string): string | undefined {
  const candidate =
    binding.transcriptPath ??
    (binding.runtime === 'codex' ? resolveExactCodexTranscript(binding.id) : undefined);
  return candidate && transcriptMatchesBinding(candidate, binding, root) ? candidate : undefined;
}

interface RetroFailureInput {
  complete: boolean;
  errorText: string;
  processStatus: number;
  agentFilingNeeded: boolean | undefined;
  pendingDrafts: number;
}

export function classifyRetroFailure(
  input: RetroFailureInput,
): CloseoutObservation['retro']['failure'] {
  if (input.complete) return undefined;
  if (/extract/iu.test(input.errorText)) return 'extraction';
  if (input.agentFilingNeeded === true || input.pendingDrafts > 0) return 'filing';
  if (input.processStatus !== 0) return 'extraction';
  return 'unknown';
}

const MAX_RETRO_EXTRACTION_WINDOWS = 3;

export function runBoundRetro(
  root: string,
  binding: CloseoutBinding,
  runner: SafewordRunner = runSafeword,
): CloseoutObservation['retro'] {
  return runBoundRetroWindows(root, binding, runner, MAX_RETRO_EXTRACTION_WINDOWS);
}

function runBoundRetroWindows(
  root: string,
  binding: CloseoutBinding,
  runner: SafewordRunner,
  windowsRemaining: number,
): CloseoutObservation['retro'] {
  const transcript = resolveTranscript(binding, root);
  if (!transcript) return { bound: false, complete: false, pendingDrafts: 0, evidenceHash: '' };
  const cached = readRetroReceipt(root, binding, transcript);
  if (cached) {
    const cachedObservation = retroObservationFromReceipt(root, binding, cached);
    if (
      !cachedObservation.complete ||
      !hasMeaningfulTranscriptGrowth(transcript, cached.snapshot, binding.runtime)
    ) {
      return cachedObservation;
    }
  }
  const snapshot = transcriptSnapshot(transcript);
  const sealedPath = sealedTranscriptPath(root);
  if (!sealedPath || !writePrivateTranscript(sealedPath, snapshot.content)) {
    return {
      bound: true,
      complete: false,
      pendingDrafts: 0,
      evidenceHash: snapshot.digest,
      failure: 'extraction',
    };
  }
  let retro: ProcessResult;
  try {
    retro = runner(
      root,
      [
        'retro',
        'run',
        '--json',
        '--auto-extract',
        '--transcript',
        sealedPath,
        '--session-id',
        binding.id,
        ...(cached ? ['--window-start', String(cached.snapshot.utf16Length)] : []),
      ],
      { SAFEWORD_RETRO_AGENT: retroAgentForRuntime(binding.runtime) },
    );
  } finally {
    if (existsSync(sealedPath)) unlinkSync(sealedPath);
  }
  const result = json<{
    state?: string;
    data?: { agent_filing_needed?: boolean };
    errors?: { message?: string }[];
  }>(retro);
  const pendingDraftRecords = readSpooledDrafts(root, binding.id);
  const pendingDrafts = pendingDraftRecords.length;
  const agentFilingNeeded = result?.data?.agent_filing_needed;
  const successful =
    retro.status === 0 &&
    (result?.state === 'healthy' || result?.state === 'changed') &&
    typeof agentFilingNeeded === 'boolean';
  const transcriptAdvanced = hasMeaningfulTranscriptGrowth(
    transcript,
    snapshot.receipt,
    binding.runtime,
  );
  const complete =
    successful && agentFilingNeeded === false && pendingDrafts === 0 && !transcriptAdvanced;
  const errorText = [result?.errors?.map(error => error.message ?? '').join('\n'), retro.stderr]
    .filter(Boolean)
    .join('\n');
  const failure = classifyRetroFailure({
    complete,
    errorText,
    processStatus: retro.status,
    agentFilingNeeded: result?.data?.agent_filing_needed,
    pendingDrafts,
  });
  if (successful && (!agentFilingNeeded || pendingDrafts > 0)) {
    writeRetroReceipt(root, {
      runtime: binding.runtime,
      id: binding.id,
      projectRoot: realpathSync(binding.projectRoot),
      snapshot: snapshot.receipt,
      agentFilingNeeded,
      pendingDrafts,
      pendingDraftSignatures: pendingDraftRecords.map(draft => draft.signature),
      recordedAt: new Date().toISOString(),
    });
  }
  if (successful && agentFilingNeeded === false && pendingDrafts === 0 && transcriptAdvanced) {
    if (windowsRemaining > 1) {
      return runBoundRetroWindows(root, binding, runner, windowsRemaining - 1);
    }
  }
  return {
    bound: true,
    complete,
    pendingDrafts,
    evidenceHash: snapshot.digest,
    ...(pendingDrafts > 0 ? { spoolPath: realpathSync(draftSpoolPath(root, binding.id)) } : {}),
    ...(failure === undefined ? {} : { failure }),
  };
}

interface TestPlanEntry {
  cwd: string;
  command: string;
  available: boolean;
}

interface VerificationReceipt {
  // This is a performance cache for an already-observed clean HEAD, not an integrity boundary.
  // Cleanup safety still comes from the plan digest and fresh target re-observation before mutation.
  version: 1;
  headOid: string;
  stateHash: string;
  recordedAt: string;
}

interface TranscriptSnapshot {
  path: string;
  byteLength: number;
  utf16Length: number;
  digest: string;
}

interface SealedTranscriptSnapshot extends TranscriptSnapshot {
  content: Buffer;
  receipt: TranscriptSnapshot;
}

interface RetroReceipt {
  version: 2;
  runtime: CloseoutBinding['runtime'];
  id: string;
  projectRoot: string;
  snapshot: TranscriptSnapshot;
  agentFilingNeeded: boolean;
  pendingDrafts: number;
  pendingDraftSignatures: string[];
  recordedAt: string;
}

const VERIFICATION_RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function cleanWorkingStateHash(headOid: string): string {
  return createHash('sha256').update(`${headOid}\0`).digest('hex');
}

function closeoutReceiptPath(root: string, filename: string): string | undefined {
  const commonDirectory = git(root, 'rev-parse', '--git-common-dir');
  const path = commonDirectory.stdout.trim();
  return commonDirectory.status === 0 && path !== ''
    ? nodePath.join(nodePath.resolve(root, path), 'safeword', filename)
    : undefined;
}

function verificationReceiptPath(root: string): string | undefined {
  return closeoutReceiptPath(root, 'closeout-verification.json');
}

function retroReceiptPath(root: string): string | undefined {
  return closeoutReceiptPath(root, 'closeout-retro.json');
}

function transcriptSnapshot(path: string): SealedTranscriptSnapshot {
  const content = readFileSync(path);
  const lastNewline = content.lastIndexOf(0x0a);
  const sealed = content.subarray(0, lastNewline + 1);
  const receipt = {
    path: realpathSync(path),
    byteLength: sealed.byteLength,
    utf16Length: sealed.toString('utf8').length,
    digest: createHash('sha256').update(sealed).digest('hex'),
  };
  return {
    ...receipt,
    content: Buffer.from(sealed),
    receipt,
  };
}

function hasMeaningfulTranscriptGrowth(
  path: string,
  snapshot: TranscriptSnapshot,
  runtime: CloseoutBinding['runtime'],
): boolean {
  const current = transcriptSnapshot(path);
  if (current.byteLength <= snapshot.byteLength) return false;
  // Claude and Cursor transcript records are not Codex lifecycle envelopes;
  // conservatively re-extract any growth on those host-native formats.
  if (runtime !== 'codex') return true;
  const appended = current.content.subarray(snapshot.byteLength).toString('utf8');
  return appended
    .split('\n')
    .filter(Boolean)
    .some(line => {
      try {
        const record = JSON.parse(line) as { type?: unknown; payload?: { type?: unknown } };
        return !(
          record.type === 'response_item' &&
          [
            'custom_tool_call',
            'custom_tool_call_output',
            'function_call',
            'function_call_output',
          ].includes(typeof record.payload?.type === 'string' ? record.payload.type : '')
        );
      } catch {
        return true;
      }
    });
}

function snapshotStillMatches(snapshot: TranscriptSnapshot): boolean {
  try {
    const content = readFileSync(snapshot.path);
    const prefix = content.subarray(0, snapshot.byteLength);
    return (
      content.byteLength >= snapshot.byteLength &&
      prefix.toString('utf8').length === snapshot.utf16Length &&
      createHash('sha256').update(prefix).digest('hex') === snapshot.digest
    );
  } catch {
    return false;
  }
}

function readRetroReceipt(
  root: string,
  binding: CloseoutBinding,
  transcript: string,
  now = new Date(),
): RetroReceipt | undefined {
  const path = retroReceiptPath(root);
  if (!path || !existsSync(path)) return undefined;
  try {
    const receipt = JSON.parse(readFileSync(path, 'utf8')) as Partial<RetroReceipt>;
    const recordedAt =
      typeof receipt.recordedAt === 'string' ? Date.parse(receipt.recordedAt) : Number.NaN;
    return receipt.version === 2 &&
      receipt.runtime === binding.runtime &&
      receipt.id === binding.id &&
      typeof receipt.projectRoot === 'string' &&
      receipt.projectRoot === realpathSync(binding.projectRoot) &&
      typeof receipt.snapshot?.path === 'string' &&
      receipt.snapshot?.path === realpathSync(transcript) &&
      typeof receipt.snapshot.byteLength === 'number' &&
      Number.isInteger(receipt.snapshot.byteLength) &&
      receipt.snapshot.byteLength >= 0 &&
      typeof receipt.snapshot.utf16Length === 'number' &&
      Number.isInteger(receipt.snapshot.utf16Length) &&
      receipt.snapshot.utf16Length >= 0 &&
      typeof receipt.snapshot.digest === 'string' &&
      typeof receipt.agentFilingNeeded === 'boolean' &&
      Number.isInteger(receipt.pendingDrafts) &&
      (receipt.pendingDrafts ?? -1) >= 0 &&
      Array.isArray(receipt.pendingDraftSignatures) &&
      receipt.pendingDraftSignatures.length === receipt.pendingDrafts &&
      receipt.pendingDraftSignatures.every(
        signature => typeof signature === 'string' && signature.length > 0,
      ) &&
      Number.isFinite(recordedAt) &&
      recordedAt <= now.getTime() &&
      now.getTime() - recordedAt <= VERIFICATION_RECEIPT_MAX_AGE_MS &&
      snapshotStillMatches(receipt.snapshot)
      ? (receipt as RetroReceipt)
      : undefined;
  } catch {
    return undefined;
  }
}

function writePrivateReceipt(path: string | undefined, receipt: object): boolean {
  if (!path) return false;
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(receipt)}\n`, {
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

function sealedTranscriptPath(root: string): string | undefined {
  const receipt = retroReceiptPath(root);
  const directory = receipt
    ? nodePath.dirname(receipt)
    : nodePath.join(root, '.safeword', '.closeout');
  return nodePath.join(directory, `closeout-transcript.${process.pid}.${randomUUID()}.jsonl`);
}

function writePrivateTranscript(path: string, content: Buffer): boolean {
  try {
    mkdirSync(nodePath.dirname(path), { recursive: true });
    writeFileSync(path, content, { flag: 'wx', mode: 0o600 });
    return true;
  } catch {
    if (existsSync(path)) unlinkSync(path);
    return false;
  }
}

function writeRetroReceipt(root: string, receipt: Omit<RetroReceipt, 'version'>): boolean {
  return writePrivateReceipt(retroReceiptPath(root), { version: 2, ...receipt });
}

function retroObservationFromReceipt(
  root: string,
  binding: CloseoutBinding,
  receipt: RetroReceipt,
): CloseoutObservation['retro'] {
  const sessionId = binding.id;
  const pendingDrafts = readSpooledDrafts(root, sessionId).length;
  const acknowledgedSignatures = new Set(readAcks(root, sessionId).map(ack => ack.signature));
  const capturedDraftsAcknowledged =
    receipt.pendingDraftSignatures.length > 0 &&
    receipt.pendingDraftSignatures.every(signature => acknowledgedSignatures.has(signature)) &&
    pendingDrafts === 0;
  const complete =
    pendingDrafts === 0 &&
    (receipt.pendingDraftSignatures.length > 0
      ? capturedDraftsAcknowledged
      : !receipt.agentFilingNeeded);
  return {
    bound: true,
    complete,
    pendingDrafts,
    evidenceHash: receipt.snapshot.digest,
    ...(pendingDrafts > 0 ? { spoolPath: realpathSync(draftSpoolPath(root, sessionId)) } : {}),
    failure: complete ? undefined : 'filing',
  };
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
  return writePrivateReceipt(verificationReceiptPath(root), { version: 1, ...receipt });
}

export function workingStateHash(root: string, headOid: string): string | undefined {
  const status = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all');
  return status.status === 0
    ? createHash('sha256').update(`${headOid}\0${status.stdout}`).digest('hex')
    : undefined;
}

function unobservableWorkingStateHash(headOid: string): string {
  return createHash('sha256').update(`${headOid}\0unobservable`).digest('hex');
}

function passedVerification(
  root: string,
  headOid: string,
  stateHash: string,
): CloseoutObservation['verification'] {
  const passed = writeVerificationReceipt(root, {
    headOid,
    stateHash,
    recordedAt: new Date().toISOString(),
  });
  return { current: true, passed, headOid, stateHash };
}

function runVerification(
  root: string,
  expectedOid: string,
  ciChecks: PullRequestIdentity['ciChecks'],
): CloseoutObservation['verification'] {
  const observedHead = git(root, 'rev-parse', 'HEAD').stdout.trim();
  const observedStateHash = workingStateHash(root, observedHead);
  if (!observedStateHash) {
    invalidateVerificationReceipt(root);
    return {
      current: observedHead === expectedOid,
      passed: false,
      headOid: observedHead,
      stateHash: unobservableWorkingStateHash(observedHead),
    };
  }
  const receipt = readVerificationReceipt(root, expectedOid);
  if (receipt && observedHead === expectedOid && observedStateHash === receipt.stateHash) {
    return {
      current: true,
      passed: true,
      headOid: receipt.headOid,
      stateHash: receipt.stateHash,
    };
  }
  if (observedHead === expectedOid && observedStateHash === cleanWorkingStateHash(expectedOid)) {
    if (ciChecks === 'passed') return passedVerification(root, observedHead, observedStateHash);
  }
  if (observedHead !== expectedOid) {
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
          stateHash: observedStateHash,
        };
  }
  // A fresh verdict is trustworthy only if the stale receipt was invalidated.
  let passed = invalidateVerificationReceipt(root);
  for (const kind of POST_MERGE_VERIFICATION_KINDS) {
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
    if (!plan || plan.length === 0 || plan.some(entry => !entry.available)) {
      passed = false;
      continue;
    }
    for (const entry of plan) {
      if (
        run(entry.command, [], entry.cwd, {
          shell: true,
          timeout: VERIFICATION_COMMAND_TIMEOUT_MS,
        }).status !== 0
      )
        passed = false;
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
  if (verification.current && verification.passed)
    verification.passed = passedVerification(root, headOid, verification.stateHash).passed;
  return verification;
}

function authenticatedCodexId(env: Record<string, string | undefined>): string | undefined {
  const identity = resolveRunIdentity({}, { env });
  return identity.runtime === 'codex' &&
    identity.source === 'CODEX_THREAD_ID' &&
    identity.sessionKey !== null
    ? identity.sessionKey
    : undefined;
}

function bridgeAgreesWithCodexTask(bridged: CloseoutBinding, id: string, root: string): boolean {
  try {
    return (
      bridged.runtime === 'codex' &&
      bridged.id === id &&
      realpathSync(bridged.projectRoot) === realpathSync(root) &&
      (bridged.transcriptPath === undefined ||
        transcriptMatchesBinding(bridged.transcriptPath, bridged, root))
    );
  } catch {
    return false;
  }
}

export function resolveCloseoutBinding(
  root: string,
  env: Record<string, string | undefined> = process.env,
): CloseoutBinding | undefined {
  const bridged = readFreshCloseoutBinding({ projectDirectory: root });
  const codexId = authenticatedCodexId(env);

  if (bridged !== undefined)
    return bridged.runtime !== 'codex' ||
      codexId === undefined ||
      bridgeAgreesWithCodexTask(bridged, codexId, root)
      ? bridged
      : undefined;

  if (codexId === undefined) return undefined;
  return {
    runtime: 'codex',
    id: codexId,
    projectRoot: realpathSync(root),
  };
}

interface GhPullRequest {
  url: string;
  state: string;
  headRefName: string;
  headRefOid: string;
  headRepositoryOwner?: { login?: string };
  headRepository?: { name?: string; nameWithOwner?: string };
  statusCheckRollup?: GhStatusCheck[];
}

interface GhStatusCheck {
  __typename?: string;
  status?: string;
  conclusion?: string;
  state?: string;
}

interface GhRequiredCheck {
  bucket?: string;
  state?: string;
}

export function resolveRequiredChecks(
  checks: GhRequiredCheck[] | undefined,
): PullRequestIdentity['ciChecks'] {
  if (!checks) return 'unknown';
  if (checks.length === 0) return 'absent';
  if (checks.some(check => ['fail', 'cancel'].includes(check.bucket ?? ''))) return 'failed';
  if (checks.some(check => check.bucket === 'pending')) return 'pending';
  return checks.every(check => ['pass', 'skipping'].includes(check.bucket ?? ''))
    ? 'passed'
    : 'unknown';
}

export function resolveHostedCheckRollup(
  checks: GhStatusCheck[] | undefined,
): PullRequestIdentity['ciChecks'] {
  if (!checks) return 'unknown';
  if (checks.length === 0) return 'absent';
  let pending = false;
  for (const check of checks) {
    if (check.__typename === 'CheckRun') {
      if (check.status !== 'COMPLETED') pending = true;
      else if (!['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(check.conclusion ?? '')) return 'failed';
    } else if (check.__typename === 'StatusContext') {
      if (check.state === 'PENDING' || check.state === 'EXPECTED') pending = true;
      else if (check.state !== 'SUCCESS') return 'failed';
    } else return 'unknown';
  }
  return pending ? 'pending' : 'passed';
}

export function resolveHostedVerification(
  required: PullRequestIdentity['ciChecks'],
  rollup: PullRequestIdentity['ciChecks'],
): PullRequestIdentity['ciChecks'] {
  if (required === 'failed' || rollup === 'failed') return 'failed';
  if (required === 'pending' || rollup === 'pending') return 'pending';
  return required === 'passed' && rollup === 'passed' ? 'passed' : 'unknown';
}

export function pullRequestIdentity(
  value: GhPullRequest,
  ciChecks: PullRequestIdentity['ciChecks'] = 'unknown',
): PullRequestIdentity | undefined {
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
        ciChecks,
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
      'url,state,headRefName,headRefOid,headRepositoryOwner,headRepository,statusCheckRollup',
    ],
    root,
  );
  const parsed = json<GhPullRequest>(result);
  const requiredResult = run(
    'gh',
    ['pr', 'checks', pr, '--required', '--json', 'bucket,state'],
    root,
  );
  const requiredChecks =
    requiredResult.status === 0 ? json<GhRequiredCheck[]>(requiredResult) : undefined;
  const ciChecks = resolveHostedVerification(
    resolveRequiredChecks(requiredChecks),
    resolveHostedCheckRollup(parsed?.statusCheckRollup),
  );
  const identity = parsed && pullRequestIdentity(parsed, ciChecks);
  return identity ? [identity] : [];
}

function observeRemote(
  root: string,
  identity: PullRequestIdentity,
): Pick<CloseoutObservation, 'remote' | 'remoteResolution'> {
  const names = git(root, 'remote').stdout.trim().split('\n').filter(Boolean);
  const matching = names.flatMap(name => {
    const url = git(root, 'remote', 'get-url', name).stdout.trim();
    const pushUrls = git(root, 'remote', 'get-url', '--push', '--all', name)
      .stdout.trim()
      .split('\n')
      .filter(Boolean);
    const pushUrl = pushUrls[0] ?? '';
    const expectedRepository = `${identity.headOwner}/${identity.headRepository}`.toLowerCase();
    return normalizedRepository(url) === expectedRepository &&
      pushUrls.length === 1 &&
      normalizedRepository(pushUrl) === expectedRepository
      ? [{ name, url, pushUrl }]
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
  const resolved = resolveRemoteRef(remoteRef, `refs/heads/${identity.headRefName}`);
  return resolved.resolution === 'matched'
    ? { remote: { ...match, oid: resolved.oid }, remoteResolution: 'matched' }
    : { remoteResolution: resolved.resolution };
}

export function resolveRemoteRef(
  result: ProcessResult,
  expectedRef?: string,
): { resolution: 'matched'; oid: string } | { resolution: 'absent' | 'unknown' } {
  if (result.status !== 0) return { resolution: 'unknown' };
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return { resolution: 'absent' };
  const fields = lines[0]?.trim().split(/\s+/u) ?? [];
  if (lines.length !== 1 || fields.length !== 2) return { resolution: 'unknown' };
  const [oid, ref] = fields;
  if (!oid || !ref || (expectedRef !== undefined && ref !== expectedRef)) {
    return { resolution: 'unknown' };
  }
  return { resolution: 'matched', oid };
}

function parseWorktreePorcelain(output: string): WorktreeIdentity[] {
  const records = output.split('\0\0').filter(record => record !== '');
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
    if (!path || !oid) return [];
    return [
      {
        path,
        oid,
        branch: branchRef?.startsWith('refs/heads/') ? branchRef.slice('refs/heads/'.length) : '',
        main: index === 0,
        locked: fields.has('locked'),
        prunable: fields.has('prunable'),
      },
    ];
  });
}

export function parseWorktrees(root: string): WorktreeIdentity[] {
  return parseWorktreePorcelain(git(root, 'worktree', 'list', '--porcelain', '-z').stdout).map(
    worktree => {
      const status = git(worktree.path, 'status', '--porcelain=v1');
      const pathIdentity = inspectPathIdentity(worktree.path);
      const gitDirectory = git(worktree.path, 'rev-parse', '--absolute-git-dir');
      return {
        ...worktree,
        ...pathIdentity,
        gitDirectory: gitDirectory.status === 0 ? gitDirectory.stdout.trim() : undefined,
        dirty: status.status !== 0 || status.stdout.trim() !== '',
      };
    },
  );
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
  return resolveProtection('matched', parsed?.protected);
}

function observeCurrentProtection(
  root: string,
  identity: PullRequestIdentity | undefined,
  remoteResolution: CloseoutObservation['remoteResolution'],
): CloseoutObservation['protection'] {
  if (!identity) return 'unknown';
  return remoteResolution === 'absent'
    ? resolveProtection(remoteResolution)
    : observeProtection(root, identity);
}

export function resolveProtection(
  remoteResolution: CloseoutObservation['remoteResolution'],
  observed?: boolean,
): CloseoutObservation['protection'] {
  if (remoteResolution === 'absent') return 'unprotected';
  return observed === true ? 'protected' : observed === false ? 'unprotected' : 'unknown';
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
    remote: remoteObservation.remote,
    localRefOid: localReference?.status === 0 ? localReference.stdout.trim() : undefined,
    worktrees: parseWorktrees(root),
  };
}

export function retroForMergedPullRequest(
  root: string,
  binding: CloseoutBinding,
  pullRequests: PullRequestIdentity[],
  runRetro: typeof runBoundRetro = runBoundRetro,
): CloseoutObservation['retro'] {
  if (pullRequests.length !== 1 || pullRequests[0]?.state !== 'MERGED') {
    return {
      bound: true,
      complete: false,
      pendingDrafts: 0,
      evidenceHash: 'pull-request-not-confirmed-merged',
    };
  }
  return runRetro(root, binding);
}

function observeCloseout(
  root: string,
  pr: string,
  binding: CloseoutBinding | undefined,
): CloseoutObservation {
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
    protection: observeCurrentProtection(root, identity, mutableTargets.remoteResolution),
    deliveryWorktreePath: nodePath.resolve(root),
    verification:
      identity?.state === 'MERGED'
        ? runVerification(root, expectedOid, identity.ciChecks)
        : {
            current: true,
            passed: true,
            headOid: expectedOid,
            stateHash: unobservableWorkingStateHash(expectedOid),
          },
    retro: binding
      ? retroForMergedPullRequest(root, binding, mutableTargets.pullRequests)
      : { bound: false, complete: false, pendingDrafts: 0, evidenceHash: '' },
  };
}

function reobserveCleanupTargets(
  root: string,
  pr: string,
  baseline: CloseoutObservation,
  observeWorkingState = false,
): CloseoutObservation {
  const mutableTargets = observeMutableCleanupTargets(root, pr);
  const identity = mutableTargets.pullRequests[0];
  const observedHead = observeWorkingState ? git(root, 'rev-parse', 'HEAD').stdout.trim() : '';
  const stateHash = observeWorkingState ? workingStateHash(root, observedHead) : '';
  return {
    ...baseline,
    ...mutableTargets,
    protection: observeCurrentProtection(root, identity, mutableTargets.remoteResolution),
    verification:
      observeWorkingState && observedHead === baseline.verification.headOid
        ? {
            ...baseline.verification,
            stateHash: stateHash || unobservableWorkingStateHash(observedHead),
          }
        : baseline.verification,
  };
}

function preserveRetroSpool(plan: CleanupPlan): string | undefined {
  const removal = plan.operations.find(operation => operation.kind === 'remove-worktree');
  if (!removal) return undefined;
  const sourceDirectory = nodePath.join(removal.path, '.safeword/retro-drafts');
  const targetDirectory = nodePath.join(removal.cwd, '.safeword/retro-drafts');
  if (sourceDirectory === targetDirectory || !existsSync(sourceDirectory)) return undefined;
  try {
    const commonDirectory = git(removal.cwd, 'rev-parse', '--git-common-dir');
    if (commonDirectory.status !== 0) return 'retrospective spool exclusion could not be resolved';
    const excludePath = nodePath.join(
      nodePath.resolve(removal.cwd, commonDirectory.stdout.trim()),
      'info/exclude',
    );
    mkdirSync(nodePath.dirname(excludePath), { recursive: true });
    const exclusion = '/.safeword/retro-drafts/';
    const exclusions = existsSync(excludePath) ? readFileSync(excludePath, 'utf8') : '';
    if (!exclusions.split('\n').includes(exclusion)) {
      const separator = exclusions.length > 0 && !exclusions.endsWith('\n') ? '\n' : '';
      appendFileSync(excludePath, `${separator}${exclusion}\n`);
    }
    mkdirSync(targetDirectory, { recursive: true });
    for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const source = nodePath.join(sourceDirectory, entry.name);
      const target = nodePath.join(targetDirectory, entry.name);
      const bytes = readFileSync(source);
      if (!existsSync(target) || !readFileSync(target).equals(bytes)) {
        const temporary = `${target}.${randomUUID()}.tmp`;
        writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 });
        renameSync(temporary, target);
      }
    }
    return undefined;
  } catch (error) {
    return `retrospective spool preservation failed: ${String(error)}`;
  }
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (import.meta.main) {
  const root = resolveRepositoryRoot(process.cwd());
  const requestedPr = argumentValue('--pr');
  const pr = requestedPr && /^[1-9]\d*$/u.test(requestedPr) ? requestedPr : undefined;
  if (!root || !pr) {
    console.error('closeout blocked: repository and a positive numeric --pr are required.');
    process.exit(2);
  }
  const binding = resolveCloseoutBinding(root);
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
  const spoolFailure = preserveRetroSpool(plan);
  if (spoolFailure) {
    console.error(`closeout blocked: ${spoolFailure}`);
    process.exit(2);
  }
  process.chdir(survivingRoot);
  let firstObservation = true;
  const result = applyCleanupPlan({
    plan,
    digest,
    observe: () => {
      const current = reobserveCleanupTargets(
        firstObservation ? root : survivingRoot,
        pr,
        observation,
        firstObservation,
      );
      firstObservation = false;
      return current;
    },
    execute: operation => {
      const execution = executeCleanupOperation(operation);
      if (execution.status !== 0) throw new Error(execution.stderr || 'cleanup command failed');
    },
  });
  process.stdout.write(`${JSON.stringify({ digest, plan, result }, undefined, 2)}\n`);
  process.exit(result.applied ? 0 : 2);
}
