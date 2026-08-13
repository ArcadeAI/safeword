import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import type { ProgressReporter } from '../cli-protocol/handler.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { retryCommand } from './command.js';
import { isReviewKind, type ReviewKind } from './contract.js';
import { prepareReviewPacket } from './packet.js';

type ReviewJobState = 'launching' | 'running' | 'completed' | 'failed' | 'canceled';

interface ReviewJobRecord {
  readonly schema_version: 1;
  readonly id: string;
  readonly state: ReviewJobState;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context?: readonly string[];
  readonly source_fingerprint: string;
  readonly started_at: string;
  readonly updated_at: string;
  readonly pid?: number;
  readonly result?: CliResult;
}

const COURTESY_WAIT_MS = 75_000;
const POLL_INTERVAL_MS = 100;
const JOB_LOCK_WAIT_MS = 2000;

function jobsDirectory(cwd: string): string {
  return nodePath.join(cwd, '.safeword', 'state', 'reviews');
}

function jobPath(cwd: string, id: string): string {
  if (!isJobId(id)) throw new Error('invalid review job id');
  return nodePath.join(jobsDirectory(cwd), `${id}.json`);
}

function fingerprint(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
): string {
  const prepared = prepareReviewPacket(cwd, kind, targets, context);
  try {
    const hash = createHash('sha256');
    hash.update(`kind\0${kind}\0`);
    for (const [section, files] of [
      ['targets', prepared.packet.logical_files],
      ['context', prepared.packet.context_files ?? []],
    ] as const) {
      hash.update(`${section}\0${files.length}\0`);
      for (const file of files) {
        hash.update(file.path);
        hash.update('\0');
        hash.update(file.content);
        hash.update('\0');
      }
    }
    return hash.digest('hex');
  } finally {
    prepared.cleanup();
  }
}

function writeJob(cwd: string, record: ReviewJobRecord): void {
  if (!isReviewJobRecord(record)) throw new Error('invalid review job record');
  const directory = jobsDirectory(cwd);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const destination = jobPath(cwd, record.id);
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  renameSync(temporary, destination);
}

function withJobLock<T>(cwd: string, id: string, operation: () => T): T {
  return withFileLock(`${jobPath(cwd, id)}.lock`, operation);
}

function withFileLock<T>(lock: string, operation: () => T): T {
  const deadline = Date.now() + JOB_LOCK_WAIT_MS;
  let descriptor: number | undefined;
  while (descriptor === undefined) {
    try {
      descriptor = openSync(lock, 'wx', 0o600);
      try {
        writeFileSync(descriptor, String(process.pid));
      } catch (error) {
        closeSync(descriptor);
        descriptor = undefined;
        try {
          unlinkSync(lock);
        } catch {
          // The failed lock may already have been removed.
        }
        throw error;
      }
    } catch (error) {
      if (!isFileExistsError(error) || Date.now() >= deadline) throw error;
      recoverStaleLock(lock);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    return operation();
  } finally {
    closeSync(descriptor);
    try {
      unlinkSync(lock);
    } catch {
      // A stale-lock recovery may already have removed this lock.
    }
  }
}

function recoverStaleLock(lock: string): void {
  try {
    const inspected = statSync(lock);
    const owner = Number(readFileSync(lock, 'utf8'));
    const invalidOwnerIsOld =
      !isProcessId(owner) && Date.now() - statSync(lock).mtimeMs >= JOB_LOCK_WAIT_MS;
    if ((isProcessId(owner) && !processExists(owner)) || invalidOwnerIsOld) {
      const current = statSync(lock);
      if (current.dev === inspected.dev && current.ino === inspected.ino) unlinkSync(lock);
    }
  } catch {
    // Another process may have released or replaced the lock while inspecting it.
  }
}

function isFileExistsError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function updateActiveJob(
  cwd: string,
  id: string,
  update: (record: ReviewJobRecord) => ReviewJobRecord,
): ReviewJobRecord {
  return withJobLock(cwd, id, () => {
    const latest = readJob(cwd, id);
    if (latest.state !== 'launching' && latest.state !== 'running') return latest;
    const next = update(latest);
    writeJob(cwd, next);
    return next;
  });
}

function isReviewJobRecord(value: unknown): value is ReviewJobRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return hasReviewJobIdentity(candidate) && hasReviewJobLifecycle(candidate);
}

function hasReviewJobIdentity(candidate: Record<string, unknown>): boolean {
  const hasStrings = ['id', 'source_fingerprint', 'started_at', 'updated_at'].every(
    key => typeof candidate[key] === 'string',
  );
  return (
    candidate.schema_version === 1 &&
    hasStrings &&
    isStringArray(candidate.targets) &&
    isOptional(candidate.context, isStringArray) &&
    isReviewKind(candidate.kind)
  );
}

function hasReviewJobLifecycle(candidate: Record<string, unknown>): boolean {
  const hasPid = isOptional(candidate.pid, isProcessId);
  const hasResult = isOptional(candidate.result, isCliResult);
  if (!hasPid || !hasResult || !isJobState(candidate.state)) return false;
  switch (candidate.state) {
    case 'launching':
    case 'running': {
      return isProcessId(candidate.pid) && candidate.result === undefined;
    }
    case 'completed':
    case 'failed': {
      return isCliResult(candidate.result);
    }
    case 'canceled': {
      return candidate.result === undefined;
    }
  }
}

function isOptional(value: unknown, predicate: (candidate: unknown) => boolean): boolean {
  return value === undefined || predicate(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isProcessId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 1;
}

function isJobState(value: unknown): value is ReviewJobState {
  return ['launching', 'running', 'completed', 'failed', 'canceled'].includes(String(value));
}

function isCliResult(value: unknown): value is CliResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const state = candidate.state;
  const effects = candidate.effects;
  const data = candidate.data;
  const expectedOk = state !== 'failed';
  const expectedChanged = state === 'changed';
  const hasHeader =
    candidate.schemaVersion === 1 &&
    candidate.ok === expectedOk &&
    candidate.changed === expectedChanged;
  const hasState = ['healthy', 'changed', 'action_required', 'failed'].includes(String(state));
  const hasArrays = ['findings', 'errors', 'recovery', 'nextActions'].every(key =>
    Array.isArray(candidate[key]),
  );
  return (
    hasHeader && hasState && hasArrays && isEffects(effects) && isReviewResultData(data, state)
  );
}

function isEffects(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return ['files', 'packages', 'configuration', 'network', 'destructive'].every(key =>
    Array.isArray((value as Record<string, unknown>)[key]),
  );
}

function isReviewResultData(value: unknown, state: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (!['review run', 'review status'].includes(String(data.command))) return false;
  if (typeof data.status !== 'string') return false;
  if (data.command === 'review status') return ['failed', 'stale'].includes(data.status);
  if (data.status !== 'approved' && data.status !== 'changes_requested')
    return ['blocked', 'existing_route', 'failed'].includes(data.status);
  return isCompletedReviewData(data, state);
}

function isCompletedReviewData(data: Record<string, unknown>, state: unknown): boolean {
  const output = data.reviewer_output;
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return false;
  const reviewer = output as Record<string, unknown>;
  const verdict = data.status === 'approved' ? 'approve' : 'request_changes';
  return (
    hasReviewerIdentity(reviewer) &&
    reviewer.verdict === verdict &&
    typeof reviewer.summary === 'string' &&
    Array.isArray(reviewer.findings) &&
    state === (data.status === 'approved' ? 'healthy' : 'action_required')
  );
}

function hasReviewerIdentity(reviewer: Record<string, unknown>): boolean {
  return (
    typeof reviewer.dispatch_id === 'string' &&
    reviewer.dispatch_id.length > 0 &&
    ['claude', 'codex'].includes(String(reviewer.reviewer_agent))
  );
}

function readJob(cwd: string, id: string): ReviewJobRecord {
  const parsed: unknown = JSON.parse(readFileSync(jobPath(cwd, id), 'utf8'));
  if (!isReviewJobRecord(parsed) || parsed.id !== id) throw new Error('invalid review job record');
  return parsed;
}

function pendingResult(record: ReviewJobRecord): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_PENDING',
        message:
          'The independent review is still working in the background. Collect its result when it finishes.',
        severity: 'info',
      },
    ],
    nextActions: [
      {
        command: `safeword review status ${record.id}`,
        mutates: false,
        requiresHuman: false,
      },
    ],
    data: {
      command: 'review run',
      status: 'pending',
      review_id: record.id,
      started_at: record.started_at,
    },
  });
}

function staleResult(record: ReviewJobRecord): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_STALE',
        message: 'The reviewed source changed after this review started; run a fresh review.',
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: retryCommand(record.kind, record.targets, record.context),
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: { command: 'review status', status: 'stale', review_id: record.id },
  });
}

function currentResult(cwd: string, record: ReviewJobRecord): CliResult {
  if (record.state === 'launching') {
    if (record.pid !== undefined && processExists(record.pid)) return pendingResult(record);
    return failExitedJob(cwd, record);
  }
  if (record.state === 'running') {
    if (record.pid !== undefined && !isReviewWorker(record.pid, record.id)) {
      return failExitedJob(cwd, record);
    }
    return pendingResult(record);
  }
  return terminalResult(cwd, record);
}

function failExitedJob(cwd: string, record: ReviewJobRecord): CliResult {
  const failed = createResult({
    state: 'failed',
    errors: [
      {
        code: 'REVIEW_WORKER_EXITED',
        message: 'The background review worker exited before recording a result.',
        retryable: true,
      },
    ],
    data: { command: 'review status', status: 'failed', review_id: record.id },
  });
  const latest = updateActiveJob(cwd, record.id, current => ({
    ...current,
    state: 'failed',
    result: failed,
    updated_at: new Date().toISOString(),
  }));
  return latest.state === 'failed' && latest.result === failed
    ? failed
    : terminalResult(cwd, latest);
}

function terminalResult(cwd: string, record: ReviewJobRecord): CliResult {
  if (record.state === 'canceled') {
    return createResult({
      state: 'action_required',
      findings: [
        { code: 'REVIEW_CANCELED', message: 'The review was canceled.', severity: 'warning' },
      ],
      data: { command: 'review status', status: 'canceled', review_id: record.id },
    });
  }
  try {
    if (fingerprint(cwd, record.kind, record.targets, record.context) !== record.source_fingerprint)
      return staleResult(record);
  } catch {
    return staleResult(record);
  }
  if (record.result !== undefined) return record.result;
  return createResult({
    state: 'failed',
    errors: [
      { code: 'REVIEW_JOB_INVALID', message: 'The review job has no result.', retryable: true },
    ],
    data: { command: 'review status', status: 'failed', review_id: record.id },
  });
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function configuredCourtesyWait(): number {
  const raw = process.env.SAFEWORD_REVIEW_FOREGROUND_MS;
  const value = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 540_000) : COURTESY_WAIT_MS;
}

function cliEntrypoint(): string {
  const configured = process.env.SAFEWORD_CLI_ENTRYPOINT;
  if (configured !== undefined && process.env.NODE_ENV === 'test') return configured;
  const invoked = process.argv[1];
  if (invoked !== undefined && /^cli\.(?:js|ts)$/u.test(nodePath.basename(invoked))) return invoked;
  const bundled = nodePath.join(import.meta.dirname, 'cli.js');
  if (existsSync(bundled)) return bundled;
  const developmentBuild = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
  if (existsSync(developmentBuild)) return developmentBuild;
  throw new Error('Safeword CLI entrypoint is unavailable');
}

function launchReviewWorker(input: {
  readonly context: readonly string[];
  readonly cwd: string;
  readonly entrypoint: string;
  readonly id: string;
  readonly kind: ReviewKind;
  readonly managedProgress: boolean;
  readonly targets: readonly string[];
}) {
  return spawn(
    process.execPath,
    [
      input.entrypoint,
      'review',
      'run',
      input.kind,
      '--worker-job-id',
      input.id,
      ...input.context.flatMap(target => ['--context', target]),
      '--',
      ...input.targets,
    ],
    {
      cwd: input.cwd,
      env: {
        ...process.env,
        SAFEWORD_REVIEW_JOB_ID: input.id,
        SAFEWORD_REVIEW_WORKER: '1',
        ...(input.managedProgress && { SAFEWORD_REVIEW_PROGRESS: '1' }),
      },
      detached: true,
      stdio: input.managedProgress ? ['ignore', 'ignore', 'inherit'] : 'ignore',
    },
  );
}

function announceBackgroundProgress(
  progress: Pick<ProgressReporter, 'heartbeat' | 'start'> | undefined,
  managedProgress: boolean,
): void {
  if (managedProgress) return;
  progress?.start('Running the independent review in the background…');
  progress?.heartbeat?.('Still waiting for the independent review…');
}

export async function startReviewJob(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context?: readonly string[];
  readonly progress?: Pick<ProgressReporter, 'heartbeat' | 'managed' | 'start'>;
}): Promise<CliResult> {
  const context = input.context ?? [];
  const sourceFingerprint = fingerprint(input.cwd, input.kind, input.targets, context);
  mkdirSync(jobsDirectory(input.cwd), { recursive: true, mode: 0o700 });
  const reserved = withFileLock(nodePath.join(jobsDirectory(input.cwd), 'start.lock'), () => {
    const existing = runningJob(input.cwd, input.kind, sourceFingerprint);
    if (existing !== undefined) return { existing: true as const, record: existing };
    const now = new Date().toISOString();
    const record: ReviewJobRecord = {
      schema_version: 1,
      id: randomUUID(),
      state: 'launching',
      kind: input.kind,
      targets: input.targets,
      context,
      source_fingerprint: sourceFingerprint,
      started_at: now,
      updated_at: now,
      pid: process.pid,
    };
    writeJob(input.cwd, record);
    return { existing: false as const, record };
  });
  if (reserved.existing) return pendingResult(reserved.record);
  const record = reserved.record;
  const id = record.id;
  const entrypoint = cliEntrypoint();
  const managedProgress = input.progress?.managed === true;
  const child = launchReviewWorker({
    context,
    cwd: input.cwd,
    entrypoint,
    id,
    kind: input.kind,
    managedProgress,
    targets: input.targets,
  });
  child.once('error', error => {
    const failed = createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_WORKER_START_FAILED',
          message: `The background review worker could not start: ${error.message}`,
          retryable: true,
        },
      ],
      data: { command: 'review run', status: 'failed', review_id: id },
    });
    try {
      updateActiveJob(input.cwd, id, latest => ({
        ...latest,
        state: 'failed',
        result: failed,
        updated_at: new Date().toISOString(),
      }));
    } catch {
      // The initiating command cannot recover a record removed after spawning.
    }
  });
  child.unref();
  if (child.pid === undefined) {
    const failed = createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_WORKER_START_FAILED',
          message: 'The background review worker could not be started.',
          retryable: true,
        },
      ],
      data: { command: 'review run', status: 'failed', review_id: id },
    });
    writeJob(input.cwd, {
      ...record,
      state: 'failed',
      result: failed,
      updated_at: new Date().toISOString(),
    });
    return failed;
  }
  const activated = updateActiveJob(input.cwd, id, spawned => ({
    ...spawned,
    state: 'running',
    pid: child.pid,
    updated_at: new Date().toISOString(),
  }));
  if (!isActivatedChild(activated, child.pid)) {
    terminateReviewWorker(child.pid);
    return currentResult(input.cwd, activated);
  }
  // Managed workers forward their coordinator progress over inherited stderr.
  announceBackgroundProgress(input.progress, managedProgress);
  const deadline = Date.now() + configuredCourtesyWait();
  while (Date.now() < deadline) {
    const latest = readJob(input.cwd, id);
    if (latest.state !== 'running') return currentResult(input.cwd, latest);
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return currentResult(input.cwd, readJob(input.cwd, id));
}

function isActivatedChild(record: ReviewJobRecord, pid: number): boolean {
  return record.state === 'running' && record.pid === pid;
}

function terminateReviewWorker(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      timeout: 5000,
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // The child may have exited before the canceled launch was observed.
  }
}

export function completeReviewJob(cwd: string, id: string, result: CliResult): void {
  updateActiveJob(cwd, id, record => ({
    ...record,
    state: result.state === 'failed' ? 'failed' : 'completed',
    result,
    updated_at: new Date().toISOString(),
  }));
}

export function reviewJobWorkerInput(
  cwd: string,
  id: string,
): {
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context: readonly string[];
} {
  const record = withJobLock(cwd, id, () => {
    const current = readJob(cwd, id);
    if (current.state !== 'launching' && current.state !== 'running')
      throw new Error('review job is not active');
    const claimed: ReviewJobRecord = {
      ...current,
      state: 'running',
      pid: process.pid,
      updated_at: new Date().toISOString(),
    };
    writeJob(cwd, claimed);
    return claimed;
  });
  return { kind: record.kind, targets: record.targets, context: record.context ?? [] };
}

function latestJobId(cwd: string): string | undefined {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory)) return undefined;
  return readdirSync(directory)
    .flatMap(name => {
      if (!/^[a-f\d-]{36}\.json$/u.test(name)) return [];
      try {
        return [{ record: readJob(cwd, name.slice(0, -5)) }];
      } catch {
        return [];
      }
    })
    .toSorted((left, right) =>
      right.record.started_at < left.record.started_at
        ? -1
        : Number(right.record.started_at > left.record.started_at),
    )[0]?.record.id;
}

function runningJob(
  cwd: string,
  kind: ReviewKind,
  sourceFingerprint: string,
): ReviewJobRecord | undefined {
  const directory = jobsDirectory(cwd);
  if (!existsSync(directory)) return undefined;
  for (const name of readdirSync(directory)) {
    if (!/^[a-f\d-]{36}\.json$/u.test(name)) continue;
    try {
      const record = readJob(cwd, name.slice(0, -5));
      if (
        isActiveReviewJob(record) &&
        record.kind === kind &&
        record.source_fingerprint === sourceFingerprint
      ) {
        return record;
      }
    } catch {
      // Corrupt records cannot deduplicate a new review.
    }
  }
  return undefined;
}

function isActiveReviewJob(record: ReviewJobRecord): boolean {
  if (record.pid === undefined) return false;
  if (record.state === 'launching') return processExists(record.pid);
  return record.state === 'running' && isReviewWorker(record.pid, record.id);
}

export function reviewJobStatus(cwd: string, requestedId?: string): CliResult {
  let id: string | undefined;
  try {
    id = requestedId ?? latestJobId(cwd);
  } catch {
    id = requestedId;
  }
  if (id === undefined) {
    return createResult({
      state: 'failed',
      errors: [
        { code: 'REVIEW_JOB_NOT_FOUND', message: 'No review job was found.', retryable: false },
      ],
      data: { command: 'review status' },
    });
  }
  let record: ReviewJobRecord;
  try {
    record = readJob(cwd, id);
  } catch {
    const exists = isJobId(id) && existsSync(jobPath(cwd, id));
    return createResult({
      state: 'failed',
      errors: [
        {
          code: exists ? 'REVIEW_JOB_INVALID' : 'REVIEW_JOB_NOT_FOUND',
          message: exists ? `Review job ${id} is invalid.` : `Review job ${id} was not found.`,
          retryable: false,
        },
      ],
      data: { command: 'review status', review_id: id },
    });
  }
  try {
    const result = currentResult(cwd, record);
    return { ...result, effects: { ...result.effects, network: [] } };
  } catch {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_STATUS_FAILED',
          message: 'The review exists, but its current status could not be validated or saved.',
          severity: 'warning',
        },
      ],
      data: { command: 'review status', status: 'blocked', review_id: id },
    });
  }
}

export function cancelReviewJob(cwd: string, requestedId?: string): CliResult {
  try {
    const id = requestedId ?? latestJobId(cwd);
    if (id === undefined) return reviewJobStatus(cwd, id);
    const canceled = withJobLock(cwd, id, () => {
      const record = readJob(cwd, id);
      if (record.state !== 'launching' && record.state !== 'running') return record;
      if (
        record.state === 'running' &&
        record.pid !== undefined &&
        isReviewWorker(record.pid, record.id)
      ) {
        terminateReviewWorker(record.pid);
      }
      const next: ReviewJobRecord = {
        ...record,
        state: 'canceled',
        updated_at: new Date().toISOString(),
      };
      writeJob(cwd, next);
      return next;
    });
    return currentResult(cwd, canceled);
  } catch {
    return reviewJobStatus(cwd, requestedId);
  }
}

function isJobId(value: string): boolean {
  return /^[a-f\d-]{36}$/u.test(value);
}

function isReviewWorker(pid: number, id: string): boolean {
  const inspected =
    process.platform === 'win32'
      ? spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
          ],
          { encoding: 'utf8', timeout: 1000, windowsHide: true },
        )
      : spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
          encoding: 'utf8',
          timeout: 1000,
        });
  return (
    inspected.status === 0 &&
    /\breview run\b/u.test(inspected.stdout) &&
    inspected.stdout.includes(`--worker-job-id ${id}`)
  );
}
