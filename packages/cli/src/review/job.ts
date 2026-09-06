import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import type { ProgressReporter } from '../cli-protocol/handler.js';
import { createBestEffortByteSink } from '../cli-protocol/policy.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { retryCommand } from './command.js';
import { isReviewKind, type ReviewKind } from './contract.js';
import { prepareReviewPacket } from './packet.js';
import { reviewWorkerRunBoundMs } from './runtime.js';

type ReviewJobState = 'launching' | 'running' | 'completed' | 'failed' | 'canceled';
type WorkerInspection = 'match' | 'mismatch' | 'unavailable';

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
  readonly deadline_at?: string;
  readonly pid?: number;
  readonly result?: CliResult;
  readonly integrity?: string;
}

const COURTESY_WAIT_MS = 75_000;
const POLL_INTERVAL_MS = 100;
const WORKER_INSPECTION_INTERVAL_MS = 1000;
const JOB_LOCK_WAIT_MS = 2000;

function jobsDirectory(cwd: string): string {
  return nodePath.join(cwd, '.safeword', 'state', 'reviews');
}

function jobPath(cwd: string, id: string): string {
  if (!isJobId(id)) throw new Error('invalid review job id');
  return nodePath.join(jobsDirectory(cwd), `${id}.json`);
}

function integrityKeyPath(): string {
  const testRoot = process.env.SAFEWORD_REVIEW_KEY_ROOT;
  const stateRoot =
    process.env.NODE_ENV === 'test' && testRoot !== undefined
      ? testRoot
      : (process.env.XDG_STATE_HOME ?? nodePath.join(homedir(), '.local', 'state'));
  return nodePath.join(stateRoot, 'safeword', 'review-integrity.key');
}

function readOrCreateIntegrityKey(): Buffer {
  const keyPath = integrityKeyPath();
  try {
    return decodeIntegrityKey(readFileSync(keyPath, 'utf8'));
  } catch {
    mkdirSync(nodePath.dirname(keyPath), { recursive: true, mode: 0o700 });
    const key = randomBytes(32);
    try {
      const descriptor = openSync(keyPath, 'wx', 0o600);
      try {
        writeFileSync(descriptor, `${key.toString('hex')}\n`);
      } finally {
        closeSync(descriptor);
      }
      return key;
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      return decodeIntegrityKey(readFileSync(keyPath, 'utf8'));
    }
  }
}

function decodeIntegrityKey(value: string): Buffer {
  const encoded = value.trim();
  if (!/^[a-f\d]{64}$/u.test(encoded)) throw new Error('invalid review integrity key');
  return Buffer.from(encoded, 'hex');
}

function unsignedRecord(record: ReviewJobRecord): Omit<ReviewJobRecord, 'integrity'> {
  // eslint-disable-next-line sonarjs/no-unused-vars -- destructuring is the typed omission seam
  const { integrity: _integrity, ...unsigned } = record;
  return unsigned;
}

function recordIntegrity(cwd: string, record: ReviewJobRecord): string {
  return createHmac('sha256', readOrCreateIntegrityKey())
    .update(realpathSync.native(cwd))
    .update('\0')
    .update(JSON.stringify(unsignedRecord(record)))
    .digest('hex');
}

function hasValidIntegrity(cwd: string, record: ReviewJobRecord): boolean {
  if (record.integrity === undefined || !/^[a-f\d]{64}$/u.test(record.integrity)) return false;
  try {
    const actual = Buffer.from(record.integrity, 'hex');
    const expected = Buffer.from(recordIntegrity(cwd, record), 'hex');
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function withRecordIntegrity(cwd: string, record: ReviewJobRecord): ReviewJobRecord {
  const unsigned = { ...record, integrity: undefined };
  return { ...unsigned, integrity: recordIntegrity(cwd, unsigned) };
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

function writeJob(cwd: string, record: ReviewJobRecord): ReviewJobRecord {
  const secured = withRecordIntegrity(cwd, record);
  if (!isReviewJobRecord(secured)) throw new Error('invalid review job record');
  const directory = jobsDirectory(cwd);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const destination = jobPath(cwd, secured.id);
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(secured)}\n`, { mode: 0o600 });
  renameSync(temporary, destination);
  return secured;
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
    const ownedLock = fstatSync(descriptor);
    closeSync(descriptor);
    try {
      const currentLock = statSync(lock);
      if (currentLock.dev === ownedLock.dev && currentLock.ino === ownedLock.ino) unlinkSync(lock);
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
    return writeJob(cwd, next);
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
    isOptional(
      candidate.deadline_at,
      value => typeof value === 'string' && Number.isFinite(Date.parse(value)),
    ) &&
    isReviewKind(candidate.kind)
  );
}

function hasReviewJobLifecycle(candidate: Record<string, unknown>): boolean {
  if (!isJobState(candidate.state)) return false;
  switch (candidate.state) {
    case 'launching':
    case 'running': {
      return isProcessId(candidate.pid) && candidate.result === undefined;
    }
    case 'completed': {
      return isCoherentTerminalResult(candidate, false);
    }
    case 'failed': {
      return isCoherentTerminalResult(candidate, true);
    }
    case 'canceled': {
      return candidate.result === undefined;
    }
  }
}

function isCoherentTerminalResult(candidate: Record<string, unknown>, failed: boolean): boolean {
  return (
    isCliResult(candidate.result) &&
    (candidate.result.state === 'failed') === failed &&
    typeof candidate.integrity === 'string'
  );
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
    return ['blocked', 'existing_route', 'failed', 'stale'].includes(data.status);
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
    ['claude', 'codex', 'opencode'].includes(String(reviewer.reviewer_agent))
  );
}

function readJob(cwd: string, id: string): ReviewJobRecord {
  const parsed: unknown = JSON.parse(readFileSync(jobPath(cwd, id), 'utf8'));
  if (!isReviewJobRecord(parsed) || parsed.id !== id || !hasValidIntegrity(cwd, parsed))
    throw new Error('invalid review job record');
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
        command: reviewStatusCommand(record.id),
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

function shellQuote(value: string): string {
  if (/^[\w./-]+$/u.test(value)) return value;
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function reviewStatusCommand(id: string): string {
  return `${shellQuote(process.execPath)} ${shellQuote(cliEntrypoint())} review status ${id}`;
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
  if (isActiveJobPastDeadline(record)) return failTimedOutJob(cwd, record);
  if (record.state === 'launching') {
    if (record.pid !== undefined && processExists(record.pid)) return pendingResult(record);
    return failExitedJob(cwd, record);
  }
  if (record.state === 'running') {
    if (workerDefinitelyMismatches(record)) {
      return failExitedJob(cwd, record);
    }
    return pendingResult(record);
  }
  return terminalResult(cwd, record);
}

function isActiveJobPastDeadline(record: ReviewJobRecord): boolean {
  if (record.state !== 'launching' && record.state !== 'running') return false;
  const deadline = record.deadline_at === undefined ? NaN : Date.parse(record.deadline_at);
  return Number.isFinite(deadline) && Date.now() >= deadline;
}

function failTimedOutJob(cwd: string, record: ReviewJobRecord): CliResult {
  if (record.pid !== undefined && inspectReviewWorker(record.pid, record.id) === 'match') {
    terminateReviewWorker(record.pid);
  }
  const failed = createResult({
    state: 'failed',
    errors: [
      {
        code: 'REVIEW_WORKER_TIMED_OUT',
        message: 'The background review worker exceeded its deadline before recording a result.',
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
  if (!hasValidIntegrity(cwd, record)) return invalidJobResult(record.id);
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
  if (record.result !== undefined) return withReviewProvenance(record, record.result);
  return createResult({
    state: 'failed',
    errors: [
      { code: 'REVIEW_JOB_INVALID', message: 'The review job has no result.', retryable: true },
    ],
    data: { command: 'review status', status: 'failed', review_id: record.id },
  });
}

/**
 * Name the review behind a terminal verdict (ticket PB1GMZ). The agent that
 * stamps a phase or artifact has to cite the review that approved it, and until
 * this the happy path was the one result that never carried its own id — only
 * the pending and failed paths did. `kind` and `targets` come from the same
 * integrity-checked record, so a stamp can be bound to what was actually
 * reviewed rather than to the agent's account of it.
 */
function withReviewProvenance(record: ReviewJobRecord, result: CliResult): CliResult {
  const data =
    typeof result.data === 'object' && result.data !== null && !Array.isArray(result.data)
      ? (result.data as Record<string, unknown>)
      : {};
  return {
    ...result,
    data: {
      ...data,
      review_id: record.id,
      review_kind: record.kind,
      review_targets: record.targets,
    },
  };
}

function invalidJobResult(id: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [
      {
        code: 'REVIEW_JOB_INVALID',
        message: 'The review job could not be verified as Safeword-produced.',
        retryable: true,
      },
    ],
    data: { command: 'review status', status: 'failed', review_id: id },
  });
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM';
  }
}

function processTool(name: 'powershell.exe' | 'ps' | 'taskkill'): string {
  const [baseName] = name.split('.', 1);
  const testOverride = process.env[`SAFEWORD_REVIEW_${baseName?.toUpperCase()}_PATH`];
  if (process.env.NODE_ENV === 'test' && testOverride !== undefined) return testOverride;
  if (process.platform !== 'win32') return `/bin/${name}`;
  const systemRoot = process.env.SystemRoot ?? String.raw`C:\Windows`;
  return name === 'powershell.exe'
    ? nodePath.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', name)
    : nodePath.join(systemRoot, 'System32', name);
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
      ...(input.managedProgress ? ['--json'] : []),
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
      // Managed progress is relayed only while the foreground command owns it. Inheriting
      // stderr would keep a caller's capture pipe open for the detached worker's lifetime.
      stdio: input.managedProgress ? ['ignore', 'ignore', 'pipe'] : 'ignore',
    },
  );
}

function closeNoManagedProgress(): void {
  return;
}

function containManagedRelayError(): void {
  // Managed progress is advisory. A child-pipe read failure must not escape
  // this relay and bypass the CLI's typed result boundary.
}

export function relayManagedWorkerStderr(child: ChildProcess, enabled: boolean): () => void {
  const stderr = child.stderr;
  if (!enabled || stderr === null) return closeNoManagedProgress;
  const writeBytes = createBestEffortByteSink((buffer, offset, length) =>
    writeSync(2, buffer, offset, length),
  );
  const forward = (chunk: Buffer | string): void => {
    writeBytes(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  };
  stderr.on('data', forward);
  stderr.on('error', containManagedRelayError);
  return () => {
    stderr.off('data', forward);
    stderr.once('close', () => stderr.off('error', containManagedRelayError));
    stderr.destroy();
  };
}

function workerLaunchSettled(child: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    child.once('spawn', resolve);
    child.once('error', resolve);
  });
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
      deadline_at: new Date(Date.now() + reviewWorkerRunBoundMs()).toISOString(),
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
  const closeManagedProgress = relayManagedWorkerStderr(child, managedProgress);
  const launchSettled = workerLaunchSettled(child);
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
  try {
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
    updateActiveJob(input.cwd, id, current => ({
      ...current,
      state: 'running',
      pid: child.pid,
      updated_at: new Date().toISOString(),
    }));
    await launchSettled;
    const observed = readJob(input.cwd, id);
    if (!isActivatedChild(observed, child.pid)) {
      terminateUnactivatedWorker(observed, child.pid);
      return currentResult(input.cwd, observed);
    }
    announceBackgroundProgress(input.progress, managedProgress);
    const deadline = Date.now() + configuredCourtesyWait();
    let nextInspectionAt = 0;
    while (Date.now() < deadline) {
      const latest = readJob(input.cwd, id);
      if (latest.state !== 'running') return currentResult(input.cwd, latest);
      const now = Date.now();
      if (now >= nextInspectionAt) {
        if (workerDefinitelyMismatches(latest)) return failExitedJob(input.cwd, latest);
        nextInspectionAt = now + WORKER_INSPECTION_INTERVAL_MS;
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    return currentResult(input.cwd, readJob(input.cwd, id));
  } finally {
    closeManagedProgress();
  }
}

function isActivatedChild(record: ReviewJobRecord, pid: number): boolean {
  return record.state === 'running' && record.pid === pid;
}

function workerDefinitelyMismatches(record: ReviewJobRecord): boolean {
  return record.pid !== undefined && inspectReviewWorker(record.pid, record.id) === 'mismatch';
}

function terminateUnactivatedWorker(record: ReviewJobRecord, pid: number): void {
  // A cancellation can win after spawn but before the worker PID is published.
  // Completed/failed records won the race legitimately and must remain untouched.
  if (
    record.state !== 'completed' &&
    record.state !== 'failed' &&
    inspectReviewWorker(pid, record.id) === 'match'
  )
    terminateReviewWorker(pid);
}

function terminateReviewWorker(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync(processTool('taskkill'), ['/PID', String(pid), '/T', '/F'], {
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
  withJobLock(cwd, id, () => {
    const record = readJob(cwd, id);
    if (record.state !== 'launching' && record.state !== 'running') return;
    const completed: ReviewJobRecord = {
      ...record,
      state: result.state === 'failed' ? 'failed' : 'completed',
      result,
      updated_at: new Date().toISOString(),
    };
    writeJob(cwd, completed);
  });
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

export interface ReviewRouteProof {
  readonly reviewer: string;
  readonly model?: string;
  readonly runtime_default: boolean;
  readonly proof: 'proven' | 'known_failure';
  readonly failure?: string;
  readonly observed_at: string;
}

// eslint-disable-next-line complexity -- Integrity proof requires each route field to be validated independently.
function routeProofFromValue(
  value: unknown,
  actualReviewer: unknown,
  observedAt: string,
): ReviewRouteProof | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const route = value as Record<string, unknown>;
  if (
    typeof route.reviewer !== 'string' ||
    !['attempted', 'unavailable'].includes(String(route.status))
  )
    return undefined;
  const model = typeof route.model === 'string' ? route.model : undefined;
  const failure = typeof route.failure === 'string' ? route.failure : undefined;
  const proven = failure === undefined && actualReviewer === route.reviewer;
  if (!proven && failure === undefined) return undefined;
  return {
    reviewer: route.reviewer,
    ...(model !== undefined && { model }),
    runtime_default: model === undefined,
    proof: proven ? 'proven' : 'known_failure',
    ...(failure !== undefined && { failure }),
    observed_at: observedAt,
  };
}

function routeProofsFromRecord(record: ReviewJobRecord): readonly ReviewRouteProof[] {
  const data = record.result?.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
  const resultData = data as Record<string, unknown>;
  const routes = resultData.review_routes;
  return Array.isArray(routes)
    ? routes.flatMap(value => {
        const proof = routeProofFromValue(value, resultData.actual_reviewer, record.updated_at);
        return proof === undefined ? [] : [proof];
      })
    : [];
}

/** Most recent integrity-validated evidence for each exact reviewer/model route. */
export function readReviewRouteProofs(cwd: string): readonly ReviewRouteProof[] {
  const directory = jobsDirectory(cwd);
  // Status evidence is observational: without an existing integrity key it
  // cannot validate prior jobs and must not create state merely by reading.
  if (!existsSync(directory) || !existsSync(integrityKeyPath())) return [];
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  const records = entries
    .flatMap(name => {
      if (!/^[a-f\d-]{36}\.json$/u.test(name)) return [];
      try {
        return [readJob(cwd, name.slice(0, -5))];
      } catch {
        return [];
      }
    })
    .toSorted((left, right) => right.updated_at.localeCompare(left.updated_at));
  const proofs = new Map<string, ReviewRouteProof>();
  for (const record of records) {
    for (const proof of routeProofsFromRecord(record)) {
      const key = `${proof.reviewer}\0${proof.model ?? '<runtime-default>'}`;
      if (!proofs.has(key)) proofs.set(key, proof);
    }
  }
  return proofs.values().toArray();
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
  // Active records are integrity-protected before reaching this point. A
  // launching PID is the authenticated initiating process; once the worker is
  // published, command-line inspection binds it to this exact review id.
  if (record.state === 'launching') return processExists(record.pid);
  return record.state === 'running' && inspectReviewWorker(record.pid, record.id) !== 'mismatch';
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
    if (id === undefined) return asCancelResult(reviewJobStatus(cwd, id));
    const canceled = withJobLock(cwd, id, () => {
      const record = readJob(cwd, id);
      if (record.state !== 'launching' && record.state !== 'running') return record;
      if (
        record.state === 'running' &&
        record.pid !== undefined &&
        inspectReviewWorker(record.pid, record.id) === 'match'
      ) {
        terminateReviewWorker(record.pid);
      }
      const next: ReviewJobRecord = {
        ...record,
        state: 'canceled',
        updated_at: new Date().toISOString(),
      };
      return writeJob(cwd, next);
    });
    return asCancelResult(currentResult(cwd, canceled));
  } catch {
    return asCancelResult(reviewJobStatus(cwd, requestedId));
  }
}

function asCancelResult(result: CliResult): CliResult {
  return {
    ...result,
    effects: { ...result.effects, network: [] },
    data: { ...(result.data as Record<string, unknown>), command: 'review cancel' },
  };
}

function isJobId(value: string): boolean {
  return /^[a-f\d-]{36}$/u.test(value);
}

function inspectReviewWorker(pid: number, id: string): WorkerInspection {
  const inspected =
    process.platform === 'win32'
      ? spawnSync(
          processTool('powershell.exe'),
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
          ],
          { encoding: 'utf8', timeout: 1000, windowsHide: true },
        )
      : spawnSync(processTool('ps'), ['-ww', '-p', String(pid), '-o', 'command='], {
          encoding: 'utf8',
          timeout: 1000,
        });
  if (inspected.status !== 0) return processExists(pid) ? 'unavailable' : 'mismatch';
  return /\breview run\b/u.test(inspected.stdout) &&
    inspected.stdout.includes(`--worker-job-id ${id}`)
    ? 'match'
    : 'mismatch';
}
