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

type ReviewJobState = 'running' | 'completed' | 'failed' | 'canceled';

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
const HEARTBEAT_INTERVAL_MS = 5000;
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
    for (const file of [
      ...prepared.packet.logical_files,
      ...(prepared.packet.context_files ?? []),
    ]) {
      hash.update(file.path);
      hash.update('\0');
      hash.update(file.content);
      hash.update('\0');
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
  const lock = `${jobPath(cwd, id)}.lock`;
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
    const owner = Number(readFileSync(lock, 'utf8'));
    const invalidOwnerIsOld =
      !isProcessId(owner) && Date.now() - statSync(lock).mtimeMs >= JOB_LOCK_WAIT_MS;
    if ((isProcessId(owner) && !processExists(owner)) || invalidOwnerIsOld) unlinkSync(lock);
  } catch {
    // Another process may have released or replaced the lock while inspecting it.
  }
}

function isFileExistsError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function updateRunningJob(
  cwd: string,
  id: string,
  update: (record: ReviewJobRecord) => ReviewJobRecord,
): ReviewJobRecord {
  return withJobLock(cwd, id, () => {
    const latest = readJob(cwd, id);
    if (latest.state !== 'running') return latest;
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
  return hasPid && hasResult && isJobState(candidate.state);
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
  return ['running', 'completed', 'failed', 'canceled'].includes(String(value));
}

function isCliResult(value: unknown): value is CliResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const state = candidate.state;
  const effects = candidate.effects;
  const data = candidate.data;
  const hasHeader =
    candidate.schemaVersion === 1 &&
    typeof candidate.ok === 'boolean' &&
    typeof candidate.changed === 'boolean';
  const hasState = ['healthy', 'changed', 'action_required', 'failed'].includes(String(state));
  const hasArrays = ['findings', 'errors', 'recovery', 'nextActions'].every(key =>
    Array.isArray(candidate[key]),
  );
  return hasHeader && hasState && hasArrays && isEffects(effects) && isReviewResultData(data);
}

function isEffects(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return ['files', 'packages', 'configuration', 'network', 'destructive'].every(key =>
    Array.isArray((value as Record<string, unknown>)[key]),
  );
}

function isReviewResultData(value: unknown): boolean {
  return (
    value === undefined || (typeof value === 'object' && value !== null && !Array.isArray(value))
  );
}

function readJob(cwd: string, id: string): ReviewJobRecord {
  const parsed: unknown = JSON.parse(readFileSync(jobPath(cwd, id), 'utf8'));
  if (!isReviewJobRecord(parsed)) throw new Error('invalid review job record');
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
  if (record.state === 'running') {
    if (record.pid !== undefined && !isReviewWorker(record.pid)) {
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
      const latest = updateRunningJob(cwd, record.id, current => ({
        ...current,
        state: 'failed',
        result: failed,
        updated_at: new Date().toISOString(),
      }));
      return latest.state === 'failed' && latest.result === failed
        ? failed
        : terminalResult(cwd, latest);
    }
    return pendingResult(record);
  }
  return terminalResult(cwd, record);
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

export async function startReviewJob(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context?: readonly string[];
  readonly progress?: Pick<ProgressReporter, 'start' | 'heartbeat'>;
}): Promise<CliResult> {
  const context = input.context ?? [];
  const sourceFingerprint = fingerprint(input.cwd, input.kind, input.targets, context);
  const existing = runningJob(input.cwd, input.kind, sourceFingerprint);
  if (existing !== undefined) return pendingResult(existing);
  const id = randomUUID();
  const now = new Date().toISOString();
  const record: ReviewJobRecord = {
    schema_version: 1,
    id,
    state: 'running',
    kind: input.kind,
    targets: input.targets,
    context,
    source_fingerprint: sourceFingerprint,
    started_at: now,
    updated_at: now,
  };
  writeJob(input.cwd, record);
  const entrypoint = cliEntrypoint();
  const child = spawn(
    process.execPath,
    [
      entrypoint,
      'review',
      'run',
      input.kind,
      ...context.flatMap(target => ['--context', target]),
      '--',
      ...input.targets,
    ],
    {
      cwd: input.cwd,
      env: { ...process.env, SAFEWORD_REVIEW_JOB_ID: id, SAFEWORD_REVIEW_WORKER: '1' },
      detached: true,
      stdio: 'ignore',
    },
  );
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
      updateRunningJob(input.cwd, id, latest => ({
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
  updateRunningJob(input.cwd, id, spawned => ({
    ...spawned,
    pid: child.pid,
    updated_at: new Date().toISOString(),
  }));
  input.progress?.start('Running the independent review in the background…');
  const deadline = Date.now() + configuredCourtesyWait();
  let nextHeartbeat = Date.now() + HEARTBEAT_INTERVAL_MS;
  while (Date.now() < deadline) {
    const latest = readJob(input.cwd, id);
    if (latest.state !== 'running') return currentResult(input.cwd, latest);
    if (Date.now() >= nextHeartbeat) {
      input.progress?.heartbeat?.('Still waiting for the independent review…');
      nextHeartbeat = Date.now() + HEARTBEAT_INTERVAL_MS;
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return currentResult(input.cwd, readJob(input.cwd, id));
}

export function completeReviewJob(cwd: string, id: string, result: CliResult): void {
  updateRunningJob(cwd, id, record => ({
    ...record,
    state: result.state === 'failed' ? 'failed' : 'completed',
    result,
    updated_at: new Date().toISOString(),
  }));
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
        record.state === 'running' &&
        record.kind === kind &&
        record.source_fingerprint === sourceFingerprint &&
        record.pid !== undefined &&
        isReviewWorker(record.pid)
      ) {
        return record;
      }
    } catch {
      // Corrupt records cannot deduplicate a new review.
    }
  }
  return undefined;
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
    return currentResult(cwd, record);
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
      if (record.state !== 'running') return record;
      if (record.pid !== undefined && isReviewWorker(record.pid)) {
        try {
          process.kill(process.platform === 'win32' ? record.pid : -record.pid, 'SIGTERM');
        } catch {
          // The worker may have completed between reading and signaling.
        }
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

function isReviewWorker(pid: number): boolean {
  if (process.platform === 'win32') return processExists(pid);
  const inspected = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
    encoding: 'utf8',
    timeout: 1000,
  });
  return inspected.status === 0 && /\breview run\b/u.test(inspected.stdout);
}
