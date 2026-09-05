import { createHash, randomUUID } from 'node:crypto';
import { access, readdir, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import {
  type DurableMutationFaults,
  linkDurable,
  mkdirDurable,
  renameDurable,
  unlinkDurable,
  writeNewDurable,
} from './durable-fs.js';

export interface RelayDraftRequest {
  body: string;
  canonicalKey: string;
  createdAt: string;
  installationId: number;
  labels: string[];
  legacySignature: string;
  repository: string;
  requestId: string;
  retryDeadlineAt: string;
  sourceKey: string;
  title: string;
}

export const DEFAULT_RELAY_REQUEST_DEADLINE_MS = 500;
export const RELAY_OVERALL_HEADROOM_MS = 250;
const RELAY_CLEANUP_RESERVE_MS = 100;
const RELAY_RETRY_BACKOFF_MS = 60_000;
const MAX_RELAY_RETRY_BACKOFF_MS = 60 * 60 * 1000;
const RELAY_API_VERSION = '1';
const RELAY_API_VERSION_HEADER = 'x-safeword-relay-api-version';

type RelayDraftInput = Omit<RelayDraftRequest, 'createdAt' | 'requestId' | 'retryDeadlineAt'>;
type RelaySourcePayload = Omit<RelayDraftInput, 'sourceKey'>;
type DurableRelayFile = { bytes: Buffer; requestId: string };

interface RecoveredRelayQueueSnapshot {
  active: DurableRelayFile[];
  deadLetters: DurableRelayFile[];
  directory: string;
}

interface RelayDraftPersistenceSnapshot {
  directory: string;
  durableRequestsBySource: Map<string, RelayDraftRequest>;
}

interface RelayFaultHooks {
  afterAck?: () => Promise<void>;
  afterClaims?: () => Promise<void>;
  afterConflictCheck?: () => Promise<void>;
  afterDiscardCheck?: () => Promise<void>;
  afterOwnershipCheck?: () => Promise<void>;
  afterSourceDiscardWrite?: () => Promise<void>;
  afterSourceAcknowledgementQuarantine?: () => Promise<void>;
  afterStateSnapshot?: () => Promise<void>;
  afterTombstone?: () => Promise<void>;
  beforeDirectorySync?: () => Promise<void>;
  beforeDuplicateRead?: (claimPath: string, siblingPath: string) => Promise<void>;
  beforeFileSync?: () => Promise<void>;
  beforeTemporaryUnlink?: () => Promise<void>;
}

interface RelayFaultOptions {
  /** @internal Crash-consistency injection used only by the source test suite. */
  faults?: RelayFaultHooks;
}

type RelayDraftPersistenceOptions = RelayFaultOptions & {
  /** @internal Deterministic identity injection used only by the source test suite. */
  requestDependencies?: NonNullable<Parameters<typeof createRelayRequest>[1]>;
};

interface RelayStateSnapshot {
  directory: string;
  discardIntentFilesByRequestId: Map<string, string[]>;
  statesByRequestId: Map<string, ReservedRequestState>;
}

const UUID_V4_SOURCE = String.raw`[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}`;
/* eslint-disable security/detect-non-literal-regexp -- Every composed fragment above is a static source literal. */
const UUID_V4_PATTERN = new RegExp(`^${UUID_V4_SOURCE}$`, 'u');
const PRIMARY_FILENAME_PATTERN = new RegExp(String.raw`^(${UUID_V4_SOURCE})\.json$`, 'u');
const DEAD_LETTER_FILENAME_PATTERN = new RegExp(
  String.raw`^(${UUID_V4_SOURCE})\.dead-letter\.json$`,
  'u',
);
const MATERIALIZING_FILENAME_PATTERN = new RegExp(
  String.raw`^(${UUID_V4_SOURCE})\.materializing\.json$`,
  'u',
);
const DISCARDED_FILENAME_PATTERN = new RegExp(
  String.raw`^(${UUID_V4_SOURCE})\.discarded\.json$`,
  'u',
);
const CLAIM_FILENAME_PATTERN = new RegExp(
  String.raw`^(${UUID_V4_SOURCE})\.claim\.([\w-]+)\.(\d+)\.json$`,
  'u',
);
const RECOVERY_CLAIM_FILENAME_PATTERN = new RegExp(
  String.raw`^(${UUID_V4_SOURCE})\.recovery-claim\.([\w-]+)\.(\d+)\.json$`,
  'u',
);
const DISCARD_INTENT_FILENAME_PATTERN = new RegExp(
  String.raw`^(${UUID_V4_SOURCE})\.discarding\.([\da-f-]+)\.json$`,
  'u',
);
const CLAIM_ID_PATTERN = /^[\w-]{1,64}$/u;
const SOURCE_RESERVATION_FILENAME_PATTERN = /^source-[\da-f]{64}\.json$/u;
const ATOMIC_TEMPORARY_FILENAME_PATTERN = new RegExp(
  String.raw`\.json\.tmp\.${UUID_V4_SOURCE}$`,
  'u',
);
const SOURCE_ACKNOWLEDGEMENT_CONFLICT_FILENAME_PATTERN =
  /^source-[\da-f]{64}\.acknowledged\.conflict\.[\da-f-]+\.json$/u;
const CLAIM_CONFLICT_FILENAME_PATTERN = new RegExp(
  String.raw`^${UUID_V4_SOURCE}\.claim-conflict\.${UUID_V4_SOURCE}\.json$`,
  'u',
);
/* eslint-enable security/detect-non-literal-regexp */
const ATOMIC_TEMPORARY_STALE_MS = 60_000;
const SOURCE_ACKNOWLEDGEMENT_CONFLICT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DISCARD_CLAIM_LEASE_MS = 60_000;
const DISCARD_INTENT_LEASE_MS = 60_000;
const RECOVERY_CLAIM_LEASE_MS = 60_000;
const RELAY_FILE_CONCURRENCY = 64;
const RELAY_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeRelayOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

export interface RelayClaim {
  bytes: Buffer;
  path: string;
  requestId: string;
}

export interface RelayReceipt {
  issueNumber?: number;
  receiptId: string;
  requestId: string;
  state: string;
}

export type RelayReportedTerminalReceipt = RelayReceipt & {
  state: 'dead-letter' | 'rejected' | 'tombstone';
};

export class RelaySpoolCorruptionError extends Error {
  readonly requestIds: string[];

  constructor(requestIds: string[]) {
    super(`corrupt durable identity: ${requestIds.join(', ')}`);
    this.name = 'RelaySpoolCorruptionError';
    this.requestIds = requestIds;
  }
}

const ACKNOWLEDGEABLE_RELAY_RECEIPT_STATES = new Set([
  'accepted',
  'claimed',
  'dispatching',
  'filed',
  'retryable',
  'dead-letter',
  'rejected',
  'tombstone',
]);
const REPORTED_TERMINAL_RELAY_RECEIPT_STATES = new Set<RelayReportedTerminalReceipt['state']>([
  'dead-letter',
  'rejected',
  'tombstone',
]);

type RelaySourceReservation =
  | {
      request: RelayDraftRequest;
      requestHash: string;
      sourceKey: string;
      sourcePayloadHash: string;
      state: 'active';
      version: 1;
    }
  | {
      requestId: string;
      sourceKey: string;
      sourcePayloadHash: string;
      state: 'acknowledged' | 'discarded';
      version: 1;
    };

function relayRequestBytes(request: RelayDraftRequest): Buffer {
  return Buffer.from(
    JSON.stringify({
      body: request.body,
      canonicalKey: request.canonicalKey,
      installationId: request.installationId,
      labels: request.labels,
      legacySignature: request.legacySignature,
      repository: request.repository,
      requestId: request.requestId,
      retryDeadlineAt: request.retryDeadlineAt,
      title: request.title,
    }),
    'utf8',
  );
}

function relaySourcePayloadDigest(request: RelaySourcePayload): string {
  const payload: RelaySourcePayload = {
    body: request.body,
    canonicalKey: request.canonicalKey,
    installationId: request.installationId,
    labels: request.labels,
    legacySignature: request.legacySignature,
    repository: request.repository,
    title: request.title,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function relayRequestDigest(request: RelayDraftRequest): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex');
}

export function createRelayRequest(
  input: RelayDraftInput,
  dependencies?: {
    now?: () => number;
    randomUUID: () => string;
    retryDeadlineAt?: (createdAt: number) => string;
  },
): RelayDraftRequest {
  const createdAt = (dependencies?.now ?? Date.now)();
  return {
    ...input,
    requestId: (dependencies?.randomUUID ?? randomUUID)(),
    createdAt: new Date(createdAt).toISOString(),
    retryDeadlineAt:
      dependencies?.retryDeadlineAt?.(createdAt) ??
      new Date(createdAt + RELAY_RETRY_WINDOW_MS).toISOString(),
  };
}

export function relaySourceKey(
  sessionIdentity: string,
  windowStart: number,
  payload: RelaySourcePayload,
): string {
  return createHash('sha256')
    .update(
      `relay-source-v3\0${sessionIdentity}\0${windowStart}\0${relaySourcePayloadDigest(payload)}`,
    )
    .digest('hex');
}

function relayDirectory(projectDirectory: string): string {
  return path.join(projectDirectory, '.safeword', 'retro-drafts', 'relay');
}

async function ensureRelayDirectory(
  projectDirectory: string,
  faults: DurableMutationFaults = {},
): Promise<string> {
  const directory = relayDirectory(projectDirectory);
  await mkdirDurable(projectDirectory, directory, faults);
  return directory;
}

function requestPath(projectDirectory: string, requestId: string, suffix: string): string {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  return path.join(relayDirectory(projectDirectory), `${requestId}${suffix}.json`);
}

function primaryPath(projectDirectory: string, requestId: string): string {
  return requestPath(projectDirectory, requestId, '');
}

function ackPath(projectDirectory: string, requestId: string): string {
  return requestPath(projectDirectory, requestId, '.ack');
}

function deadLetterPath(projectDirectory: string, requestId: string): string {
  return requestPath(projectDirectory, requestId, '.dead-letter');
}

function materializingPath(projectDirectory: string, requestId: string): string {
  return requestPath(projectDirectory, requestId, '.materializing');
}

function discardedPath(projectDirectory: string, requestId: string): string {
  return requestPath(projectDirectory, requestId, '.discarded');
}

function retrySchedulePath(projectDirectory: string, requestId: string): string {
  return requestPath(projectDirectory, requestId, '.retry-schedule');
}

function discardIntentTokenPath(
  projectDirectory: string,
  requestId: string,
  token: string,
): string {
  if (!UUID_V4_PATTERN.test(requestId) || !UUID_V4_PATTERN.test(token)) {
    throw new Error('invalid relay request identity');
  }
  return path.join(relayDirectory(projectDirectory), `${requestId}.discarding.${token}.json`);
}

function sourcePath(projectDirectory: string, sourceKey: string, suffix: string): string {
  const key = createHash('sha256').update(sourceKey).digest('hex');
  return path.join(relayDirectory(projectDirectory), `source-${key}${suffix}.json`);
}

function sourceReservationPath(projectDirectory: string, sourceKey: string): string {
  return sourcePath(projectDirectory, sourceKey, '');
}

function sourceAcknowledgementPath(projectDirectory: string, sourceKey: string): string {
  return sourcePath(projectDirectory, sourceKey, '.acknowledged');
}

function sourceAcknowledgementConflictPath(projectDirectory: string, sourceKey: string): string {
  return sourcePath(projectDirectory, sourceKey, `.acknowledged.conflict.${randomUUID()}`);
}

function sourceDiscardedPath(projectDirectory: string, sourceKey: string): string {
  return sourcePath(projectDirectory, sourceKey, '.discarded');
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function removeIfPresent(file: string): Promise<void> {
  await unlinkDurable(file);
}

async function readPairIfPresent(
  left: string,
  right: string,
): Promise<[Buffer, Buffer] | undefined> {
  try {
    return await Promise.all([readFile(left), readFile(right)]);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
}

async function sortedFilenames(directory: string): Promise<string[]> {
  const filenames = await readdir(directory);
  return filenames.toSorted((left, right) => left.localeCompare(right));
}

async function writeAtomic(
  file: string,
  bytes: Buffer,
  faults: DurableMutationFaults = {},
): Promise<boolean> {
  const temporary = `${file}.tmp.${randomUUID()}`;
  try {
    await writeNewDurable(temporary, bytes, faults);
    try {
      await linkDurable(temporary, file, faults);
      return true;
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') throw error;
      return false;
    }
  } finally {
    await removeAtomicTemporary(temporary, faults);
  }
}

async function removeAtomicTemporary(
  temporary: string,
  faults: DurableMutationFaults,
): Promise<void> {
  try {
    await faults.beforeTemporaryUnlink?.();
    await unlink(temporary);
  } catch {
    // The linked target is already durable. Recovery owns any leftover
    // relay-named temporary, so cleanup cannot overturn accepted state.
  }
}

async function replaceAtomic(
  file: string,
  bytes: Buffer,
  faults: DurableMutationFaults = {},
): Promise<void> {
  const temporary = `${file}.tmp.${randomUUID()}`;
  try {
    await writeNewDurable(temporary, bytes, faults);
    await renameDurable(temporary, file, faults);
  } finally {
    await removeIfPresent(temporary);
  }
}

function parseClaim(
  filename: string,
): { claimId: string; expiresAt: number; requestId: string } | undefined {
  const match = CLAIM_FILENAME_PATTERN.exec(filename);
  if (match === null) return undefined;
  const [, requestId, claimId, expiresAt] = match;
  if (requestId === undefined || claimId === undefined || expiresAt === undefined) {
    return undefined;
  }
  return { claimId, expiresAt: Number(expiresAt), requestId };
}

function relayClaimExpiry(now: number, leaseMs: number): number {
  const expiresAt = now + leaseMs;
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !Number.isSafeInteger(leaseMs) ||
    leaseMs <= 0 ||
    !Number.isSafeInteger(expiresAt)
  ) {
    throw new Error('invalid relay claim timing');
  }
  return expiresAt;
}

function parsePrimary(filename: string): string | undefined {
  return PRIMARY_FILENAME_PATTERN.exec(filename)?.[1];
}

function parseDeadLetter(filename: string): string | undefined {
  return DEAD_LETTER_FILENAME_PATTERN.exec(filename)?.[1];
}

function parseMaterializing(filename: string): string | undefined {
  return MATERIALIZING_FILENAME_PATTERN.exec(filename)?.[1];
}

function parseDiscarded(filename: string): string | undefined {
  return DISCARDED_FILENAME_PATTERN.exec(filename)?.[1];
}

function parseDiscardIntent(filename: string): { requestId: string; token: string } | undefined {
  const match = DISCARD_INTENT_FILENAME_PATTERN.exec(filename);
  const requestId = match?.[1];
  const token = match?.[2];
  if (requestId === undefined || token === undefined || !UUID_V4_PATTERN.test(token)) {
    return undefined;
  }
  return { requestId, token };
}

function durableRequestId(filename: string): string | undefined {
  return (
    parsePrimary(filename) ??
    parseMaterializing(filename) ??
    parseDeadLetter(filename) ??
    parseClaim(filename)?.requestId ??
    parseRecoveryClaim(filename)?.requestId
  );
}

async function hasDiscardIntent(projectDirectory: string, requestId: string): Promise<boolean> {
  const filenames = await sortedFilenames(relayDirectory(projectDirectory));
  return filenames.some(filename => parseDiscardIntent(filename)?.requestId === requestId);
}

/**
 * Is this request discarded? Reads discard intent live, or from `snapshot`
 * when the caller already captured one.
 */
async function discardBlocks(
  projectDirectory: string,
  requestId: string,
  snapshot?: RelayStateSnapshot,
): Promise<boolean> {
  if (await exists(discardedPath(projectDirectory, requestId))) return true;
  return snapshot === undefined
    ? hasDiscardIntent(projectDirectory, requestId)
    : discardIntentInSnapshot(snapshot, requestId);
}

function parseRecoveryClaim(
  filename: string,
): { claimId: string; expiresAt: number; requestId: string } | undefined {
  const match = RECOVERY_CLAIM_FILENAME_PATTERN.exec(filename);
  if (match === null) return undefined;
  const [, requestId, claimId, expiresAt] = match;
  if (requestId === undefined || claimId === undefined || expiresAt === undefined) {
    return undefined;
  }
  return { claimId, expiresAt: Number(expiresAt), requestId };
}

// eslint-disable-next-line complexity -- Durable identity reconciliation keeps each filesystem transition explicit.
export async function persistRelayRequest(
  projectDirectory: string,
  request: RelayDraftRequest,
  options: RelayFaultOptions = {},
): Promise<{ bytes: Buffer; path: string }> {
  const faults = options.faults ?? {};
  await ensureRelayDirectory(projectDirectory, {
    beforeDirectorySync: faults.beforeDirectorySync,
  });
  if (await discardBlocks(projectDirectory, request.requestId)) {
    throw new Error('relay request identity was discarded');
  }
  await faults.afterDiscardCheck?.();
  const bytes = Buffer.from(JSON.stringify(request), 'utf8');
  const deadLetter = deadLetterPath(projectDirectory, request.requestId);
  if (await exists(deadLetter)) {
    const existing = await readFile(deadLetter);
    if (!existing.equals(bytes)) {
      throw new Error('relay request identity was reused with a different payload');
    }
    if (await exists(discardedPath(projectDirectory, request.requestId))) {
      await removeIfPresent(deadLetter);
      throw new Error('relay request identity was discarded');
    }
    return { bytes, path: deadLetter };
  }
  const file = primaryPath(projectDirectory, request.requestId);
  if (
    !(await writeAtomic(file, bytes, {
      beforeDirectorySync: faults.beforeDirectorySync,
      beforeFileSync: faults.beforeFileSync,
      beforeTemporaryUnlink: faults.beforeTemporaryUnlink,
    }))
  ) {
    const existing = await readFile(file);
    if (!existing.equals(bytes)) {
      throw new Error('relay request identity was reused with a different payload');
    }
  }
  if (await exists(discardedPath(projectDirectory, request.requestId))) {
    await removeIfPresent(file);
    throw new Error('relay request identity was discarded');
  }
  return { bytes, path: file };
}

function sameRelayDraft(request: RelayDraftRequest, draft: RelayDraftInput): boolean {
  return (
    request.body === draft.body &&
    request.canonicalKey === draft.canonicalKey &&
    request.installationId === draft.installationId &&
    request.labels.length === draft.labels.length &&
    request.labels.every((label, index) => label === draft.labels[index]) &&
    request.legacySignature === draft.legacySignature &&
    request.repository === draft.repository &&
    request.sourceKey === draft.sourceKey &&
    request.title === draft.title
  );
}

function parseDurableRequest(candidate: { bytes: Buffer }): RelayDraftRequest | undefined {
  try {
    const request = JSON.parse(candidate.bytes.toString('utf8')) as unknown;
    if (!activeSourceRequestShape(request)) return undefined;
    if (
      !Number.isFinite(Date.parse(request.createdAt)) ||
      !Number.isFinite(Date.parse(request.retryDeadlineAt))
    ) {
      return undefined;
    }
    return request;
  } catch {
    // Corrupt immutable records remain visible and cannot authorize replacement.
    return undefined;
  }
}

function validateSourceReservation(
  reservation: RelaySourceReservation,
  draft: RelayDraftInput,
): void {
  if (
    reservation.version !== 1 ||
    reservation.sourceKey !== draft.sourceKey ||
    reservation.sourcePayloadHash !== relaySourcePayloadDigest(draft) ||
    (reservation.state === 'active' &&
      reservation.requestHash !== relayRequestDigest(reservation.request)) ||
    (reservation.state === 'active' && !sameRelayDraft(reservation.request, draft))
  ) {
    throw new Error('relay source identity was reused with a different payload');
  }
}

function activeSourceRequestShape(value: unknown): value is RelayDraftRequest {
  if (typeof value !== 'object' || value === null) return false;
  const request = value as Record<string, unknown>;
  const stringFields = [
    'body',
    'canonicalKey',
    'createdAt',
    'legacySignature',
    'repository',
    'requestId',
    'retryDeadlineAt',
    'sourceKey',
    'title',
  ];
  return (
    stringFields.every(field => typeof request[field] === 'string') &&
    Number.isSafeInteger(request.installationId) &&
    Array.isArray(request.labels) &&
    request.labels.every(label => typeof label === 'string') &&
    UUID_V4_PATTERN.test(request.requestId as string)
  );
}

function isCompatibleRenewal(renewed: RelayDraftRequest, original: RelayDraftRequest): boolean {
  const renewedDeadline = Date.parse(renewed.retryDeadlineAt);
  const originalDeadline = Date.parse(original.retryDeadlineAt);
  return (
    renewed.requestId === original.requestId &&
    renewed.sourceKey === original.sourceKey &&
    renewed.createdAt === original.createdAt &&
    relaySourcePayloadDigest(renewed) === relaySourcePayloadDigest(original) &&
    Number.isFinite(renewedDeadline) &&
    Number.isFinite(originalDeadline) &&
    renewedDeadline > originalDeadline
  );
}

function activeSourceReservationShape(candidate: Record<string, unknown>): boolean {
  return (
    candidate.state === 'active' &&
    typeof candidate.requestHash === 'string' &&
    /^[\da-f]{64}$/u.test(candidate.requestHash) &&
    activeSourceRequestShape(candidate.request)
  );
}

function sourceReservationShape(value: unknown): value is RelaySourceReservation {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const commonShape =
    candidate.version === 1 &&
    typeof candidate.sourceKey === 'string' &&
    typeof candidate.sourcePayloadHash === 'string';
  if (!commonShape) return false;
  if (candidate.state === 'acknowledged' || candidate.state === 'discarded') {
    return typeof candidate.requestId === 'string' && UUID_V4_PATTERN.test(candidate.requestId);
  }
  return activeSourceReservationShape(candidate);
}

async function loadSourceReservation(
  projectDirectory: string,
  draft: RelayDraftInput,
): Promise<RelaySourceReservation | undefined> {
  let bytes: Buffer;
  try {
    try {
      bytes = await readFile(sourceAcknowledgementPath(projectDirectory, draft.sourceKey));
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
      try {
        bytes = await readFile(sourceDiscardedPath(projectDirectory, draft.sourceKey));
      } catch (discardError) {
        if (errorCode(discardError) !== 'ENOENT') throw discardError;
        bytes = await readFile(sourceReservationPath(projectDirectory, draft.sourceKey));
      }
    }
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
  let reservation: unknown;
  try {
    reservation = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    throw new Error('relay source reservation is corrupt');
  }
  if (!sourceReservationShape(reservation)) throw new Error('relay source reservation is corrupt');
  validateSourceReservation(reservation, draft);
  return reservation;
}

async function reconcileRenewedDurableRequest(
  projectDirectory: string,
  reservation: Extract<RelaySourceReservation, { state: 'active' }>,
  durablePath = deadLetterPath(projectDirectory, reservation.request.requestId),
  updateReservation = true,
): Promise<RelayDraftRequest | undefined> {
  let bytes: Buffer;
  try {
    bytes = await readFile(durablePath);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
  let renewed: unknown;
  try {
    renewed = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    throw new RelaySpoolCorruptionError([reservation.request.requestId]);
  }
  if (!activeSourceRequestShape(renewed)) {
    throw new RelaySpoolCorruptionError([reservation.request.requestId]);
  }
  const original = reservation.request;
  if (!isCompatibleRenewal(renewed, original)) {
    if (bytes.equals(Buffer.from(JSON.stringify(original), 'utf8'))) return original;
    throw new Error('relay request identity was reused with a different payload');
  }
  if (!updateReservation) return renewed;
  const renewedReservation: RelaySourceReservation = {
    request: renewed,
    requestHash: relayRequestDigest(renewed),
    sourceKey: renewed.sourceKey,
    sourcePayloadHash: relaySourcePayloadDigest(renewed),
    state: 'active',
    version: 1,
  };
  await replaceAtomic(
    sourceReservationPath(projectDirectory, original.sourceKey),
    Buffer.from(JSON.stringify(renewedReservation), 'utf8'),
  );
  return renewed;
}

type ReservedRequestState =
  | { kind: 'dead-letter' | 'materializing' | 'missing' | 'primary' }
  | { kind: 'delivery' | 'recovery'; path: string };

function reservedRequestStateForFilename(
  directory: string,
  filename: string,
): { requestId: string; state: ReservedRequestState } | undefined {
  const recovery = parseRecoveryClaim(filename);
  if (recovery !== undefined) {
    return {
      requestId: recovery.requestId,
      state: { kind: 'recovery', path: path.join(directory, filename) },
    };
  }
  const delivery = parseClaim(filename);
  if (delivery !== undefined) {
    return {
      requestId: delivery.requestId,
      state: { kind: 'delivery', path: path.join(directory, filename) },
    };
  }
  const materializing = parseMaterializing(filename);
  if (materializing !== undefined) {
    return { requestId: materializing, state: { kind: 'materializing' } };
  }
  const deadLetter = parseDeadLetter(filename);
  if (deadLetter !== undefined) {
    return { requestId: deadLetter, state: { kind: 'dead-letter' } };
  }
  const primary = parsePrimary(filename);
  return primary === undefined ? undefined : { requestId: primary, state: { kind: 'primary' } };
}

function reservedRequestStates(
  directory: string,
  filenames: string[],
): Map<string, ReservedRequestState> {
  const states = new Map<string, ReservedRequestState>();
  const precedence: Record<ReservedRequestState['kind'], number> = {
    'dead-letter': 2,
    delivery: 4,
    materializing: 3,
    missing: 0,
    primary: 1,
    recovery: 5,
  };
  for (const filename of filenames) {
    const candidate = reservedRequestStateForFilename(directory, filename);
    if (candidate === undefined) continue;
    const current = states.get(candidate.requestId);
    if (current === undefined || precedence[candidate.state.kind] > precedence[current.kind]) {
      states.set(candidate.requestId, candidate.state);
    }
  }
  return states;
}

async function validateReservedPrimary(
  projectDirectory: string,
  request: RelayDraftRequest,
  file = primaryPath(projectDirectory, request.requestId),
): Promise<void> {
  try {
    const bytes = await readFile(file);
    if (!bytes.equals(Buffer.from(JSON.stringify(request), 'utf8'))) {
      throw new Error('relay request identity was reused with a different payload');
    }
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
}

async function compactIfAcknowledged(
  projectDirectory: string,
  request: RelayDraftRequest,
): Promise<boolean> {
  if (!(await exists(ackPath(projectDirectory, request.requestId)))) return false;
  await compactSourceReservation(projectDirectory, request);
  return true;
}

function reservedRequestPath(
  projectDirectory: string,
  requestId: string,
  state: ReservedRequestState,
): string {
  switch (state.kind) {
    case 'delivery': {
      return state.path;
    }
    case 'dead-letter': {
      return deadLetterPath(projectDirectory, requestId);
    }
    case 'primary': {
      return primaryPath(projectDirectory, requestId);
    }
    case 'materializing': {
      return materializingPath(projectDirectory, requestId);
    }
    case 'missing':
    case 'recovery': {
      throw new Error('relay request has no directly reserved durable path');
    }
  }
}

async function resolveExistingReservedState(
  projectDirectory: string,
  reservation: Extract<RelaySourceReservation, { state: 'active' }>,
  state: Exclude<ReservedRequestState, { kind: 'missing' }>,
): Promise<RelayDraftRequest> {
  if (state.kind === 'recovery') {
    return (
      (await reconcileRenewedDurableRequest(projectDirectory, reservation, state.path, false)) ??
      reservation.request
    );
  }
  return (
    (await reconcileRenewedDurableRequest(
      projectDirectory,
      reservation,
      reservedRequestPath(projectDirectory, reservation.request.requestId, state),
    )) ?? reservation.request
  );
}

async function materializeReservedRequest(
  projectDirectory: string,
  draft: RelayDraftInput,
  reservation: Extract<RelaySourceReservation, { state: 'active' }>,
  snapshot: RelayStateSnapshot,
): Promise<RelayDraftRequest | undefined> {
  const requestId = reservation.request.requestId;
  if (await discardBlocks(projectDirectory, requestId, snapshot)) {
    return undefined;
  }
  const currentReservation = await loadSourceReservation(projectDirectory, draft);
  if (currentReservation?.state !== 'active') return undefined;
  const currentState = snapshot.statesByRequestId.get(requestId) ?? {
    kind: 'missing',
  };
  if (currentState.kind !== 'missing') {
    return resolveExistingReservedState(projectDirectory, currentReservation, currentState);
  }
  const materializing = materializingPath(projectDirectory, requestId);
  const bytes = Buffer.from(JSON.stringify(currentReservation.request), 'utf8');
  if (!(await writeAtomic(materializing, bytes))) {
    await validateReservedPrimary(projectDirectory, currentReservation.request, materializing);
  }
  if (!(await discardBlocks(projectDirectory, requestId))) {
    return currentReservation.request;
  }
  await removeIfPresent(materializing);
  return undefined;
}

async function captureRelayStateSnapshot(
  projectDirectory: string,
  existing?: RelayStateSnapshot,
): Promise<RelayStateSnapshot> {
  if (existing !== undefined) return existing;
  const directory = relayDirectory(projectDirectory);
  const filenames = await sortedFilenames(directory);
  return {
    directory,
    discardIntentFilesByRequestId: discardIntentFilesByRequestId(filenames),
    statesByRequestId: reservedRequestStates(directory, filenames),
  };
}

async function resolveSourceReservation(
  projectDirectory: string,
  draft: RelayDraftInput,
  reservation: RelaySourceReservation,
  options: RelayFaultOptions & {
    stateSnapshot?: RelayStateSnapshot;
  } = {},
): Promise<RelayDraftRequest | undefined> {
  validateSourceReservation(reservation, draft);
  if (reservation.state !== 'active') return undefined;
  if (await discardBlocks(projectDirectory, reservation.request.requestId, options.stateSnapshot)) {
    return undefined;
  }
  if (await compactIfAcknowledged(projectDirectory, reservation.request)) return undefined;
  const snapshot = await captureRelayStateSnapshot(projectDirectory, options.stateSnapshot);
  await options.faults?.afterStateSnapshot?.();
  const requestId = reservation.request.requestId;
  const state = snapshot.statesByRequestId.get(requestId) ?? { kind: 'missing' };
  if (state.kind !== 'missing') {
    return resolveExistingReservedState(projectDirectory, reservation, state);
  }
  if (await compactIfAcknowledged(projectDirectory, reservation.request)) return undefined;
  return materializeReservedRequest(projectDirectory, draft, reservation, snapshot);
}

function discardIntentFilesByRequestId(filenames: string[]): Map<string, string[]> {
  const filesByRequestId = new Map<string, string[]>();
  for (const filename of filenames) {
    const intent = parseDiscardIntent(filename);
    if (intent === undefined) continue;
    const current = filesByRequestId.get(intent.requestId) ?? [];
    current.push(filename);
    filesByRequestId.set(intent.requestId, current);
  }
  return filesByRequestId;
}

async function discardIntentInSnapshot(
  snapshot: RelayStateSnapshot,
  requestId: string,
): Promise<boolean> {
  const matchingIntents = snapshot.discardIntentFilesByRequestId.get(requestId) ?? [];
  const live = await Promise.all(
    matchingIntents.map(filename => exists(path.join(snapshot.directory, filename))),
  );
  return live.includes(true);
}

async function acquireSourceReservation(
  projectDirectory: string,
  draft: RelayDraftInput,
  reservation: RelaySourceReservation,
): Promise<RelaySourceReservation> {
  const file = sourceReservationPath(projectDirectory, draft.sourceKey);
  const written = await writeAtomic(file, Buffer.from(JSON.stringify(reservation), 'utf8'));
  if (written) return reservation;
  const winner = await loadSourceReservation(projectDirectory, draft);
  if (winner === undefined) throw new Error('relay source reservation disappeared');
  return winner;
}

async function compactSourceReservation(
  projectDirectory: string,
  request: RelayDraftRequest,
  options: RelayFaultOptions = {},
): Promise<void> {
  const reservation: RelaySourceReservation = {
    requestId: request.requestId,
    sourceKey: request.sourceKey,
    sourcePayloadHash: relaySourcePayloadDigest(request),
    state: 'acknowledged',
    version: 1,
  };
  const bytes = Buffer.from(JSON.stringify(reservation), 'utf8');
  const acknowledged = sourceAcknowledgementPath(projectDirectory, request.sourceKey);
  if (!(await writeAtomic(acknowledged, bytes))) {
    const existing = await readFile(acknowledged);
    if (!existing.equals(bytes)) {
      await writeAtomic(
        sourceAcknowledgementConflictPath(projectDirectory, request.sourceKey),
        existing,
      );
      await options.faults?.afterSourceAcknowledgementQuarantine?.();
      await replaceAtomic(acknowledged, bytes);
    }
  }
  await removeIfPresent(sourceDiscardedPath(projectDirectory, request.sourceKey));
  await removeIfPresent(sourceReservationPath(projectDirectory, request.sourceKey));
}

async function compactDiscardedSourceReservation(
  projectDirectory: string,
  reservation: Extract<RelaySourceReservation, { state: 'active' }>,
  options: RelayFaultOptions = {},
): Promise<void> {
  if (await exists(sourceAcknowledgementPath(projectDirectory, reservation.sourceKey))) {
    await removeIfPresent(sourceReservationPath(projectDirectory, reservation.sourceKey));
    return;
  }
  const discardedReservation: RelaySourceReservation = {
    requestId: reservation.request.requestId,
    sourceKey: reservation.sourceKey,
    sourcePayloadHash: reservation.sourcePayloadHash,
    state: 'discarded',
    version: 1,
  };
  const bytes = Buffer.from(JSON.stringify(discardedReservation), 'utf8');
  const discarded = sourceDiscardedPath(projectDirectory, reservation.sourceKey);
  if (!(await writeAtomic(discarded, bytes))) {
    const existing = await readFile(discarded);
    if (!existing.equals(bytes)) {
      throw new Error('relay discard conflicts with the durable source tombstone');
    }
  }
  await options.faults?.afterSourceDiscardWrite?.();
  if (await exists(sourceAcknowledgementPath(projectDirectory, reservation.sourceKey))) {
    await removeIfPresent(discarded);
  }
  await removeIfPresent(sourceReservationPath(projectDirectory, reservation.sourceKey));
}

export async function persistRelayDraft(
  projectDirectory: string,
  draft: RelayDraftInput,
  options: RelayDraftPersistenceOptions = {},
): Promise<RelayDraftRequest | undefined> {
  const [outcome] = await persistRelayDraftBatch(projectDirectory, [draft], options);
  if (outcome === undefined) throw new Error('relay persistence batch returned no outcome');
  if (outcome.status === 'rejected') throw outcome.reason;
  return outcome.value;
}

async function prepareRelayDraftPersistence(
  projectDirectory: string,
): Promise<RelayDraftPersistenceSnapshot> {
  const initial = await recoveredRelayQueueSnapshot(projectDirectory, Date.now());
  const malformed = initial.active.filter(
    candidate => parseDurableRequest(candidate) === undefined,
  );
  if (malformed.length === 0)
    return persistenceSnapshot(initial.active, initial.deadLetters, initial.directory);
  const reservedIds = await reservedRequestIds(initial.directory);
  const unreserved = malformed
    .map(candidate => candidate.requestId)
    .filter(requestId => !reservedIds.has(requestId));
  if (unreserved.length > 0) throw new RelaySpoolCorruptionError(unreserved);
  await quarantineMalformedActiveRequests(projectDirectory, malformed);
  const { active, deadLetters, directory } = await recoveredRelayQueueSnapshot(
    projectDirectory,
    Date.now(),
  );
  return persistenceSnapshot(active, deadLetters, directory);
}

function persistenceSnapshot(
  active: DurableRelayFile[],
  deadLetters: DurableRelayFile[],
  directory: string,
): RelayDraftPersistenceSnapshot {
  const activeRequests = active.flatMap(candidate => {
    const request = parseDurableRequest(candidate);
    return request === undefined ? [] : [{ request }];
  });
  // A malformed dead letter is visible evidence, but it has no trustworthy
  // source identity and must not block unrelated durable drafts.
  const deadLetterRequests = deadLetters.flatMap(candidate => {
    const request = parseDurableRequest(candidate);
    return request === undefined ? [] : [{ request }];
  });
  const durableRequests = [...activeRequests, ...deadLetterRequests];
  const durableRequestsBySource = new Map<string, RelayDraftRequest>();
  for (const { request } of durableRequests) {
    if (request !== undefined && !durableRequestsBySource.has(request.sourceKey)) {
      durableRequestsBySource.set(request.sourceKey, request);
    }
  }
  return { directory, durableRequestsBySource };
}

async function reservedRequestIds(directory: string): Promise<Set<string>> {
  const filenames = await sortedFilenames(directory);
  const reservations = await activeSourceReservations(directory, filenames);
  return new Set(reservations.map(({ reservation }) => reservation.request.requestId));
}

async function quarantineMalformedActiveRequests(
  projectDirectory: string,
  active: DurableRelayFile[],
): Promise<void> {
  for (const candidate of active) {
    if (parseDurableRequest(candidate) !== undefined) continue;
    const claim = await claimSpecificRelayRequest(projectDirectory, candidate.requestId, {
      claimId: randomUUID(),
      leaseMs: 1000,
      now: Date.now(),
    });
    if (claim === undefined) continue;
    if (parseDurableRequest(claim) === undefined) await deadLetterClaim(projectDirectory, claim);
    else await rearmClaim(projectDirectory, claim);
  }
}

async function recoveredRelayQueueSnapshot(
  projectDirectory: string,
  now: number,
): Promise<RecoveredRelayQueueSnapshot> {
  await recoverRelaySpool(projectDirectory, now);
  const directory = relayDirectory(projectDirectory);
  const filenames = await sortedFilenames(directory);
  const active = await relayRequestsFromFilenames(directory, filenames);
  const deadLetters = await relayDeadLettersFromFilenames(directory, filenames);
  return { active, deadLetters, directory };
}

async function acquireRelayDraftReservation(
  projectDirectory: string,
  draft: RelayDraftInput,
  snapshot: RelayDraftPersistenceSnapshot,
  dependencies?: Parameters<typeof createRelayRequest>[1],
): Promise<RelaySourceReservation> {
  const reserved = await loadSourceReservation(projectDirectory, draft);
  if (reserved !== undefined) return reserved;
  const request = snapshot.durableRequestsBySource.get(draft.sourceKey);
  if (request !== undefined) {
    if (!sameRelayDraft(request, draft)) {
      throw new Error('relay source identity was reused with a different payload');
    }
    return acquireSourceReservation(projectDirectory, draft, {
      request,
      requestHash: relayRequestDigest(request),
      sourceKey: draft.sourceKey,
      sourcePayloadHash: relaySourcePayloadDigest(draft),
      state: 'active',
      version: 1,
    });
  }
  const created = createRelayRequest(draft, dependencies);
  return acquireSourceReservation(projectDirectory, draft, {
    request: created,
    requestHash: relayRequestDigest(created),
    sourceKey: draft.sourceKey,
    sourcePayloadHash: relaySourcePayloadDigest(draft),
    state: 'active',
    version: 1,
  });
}

export async function persistRelayDraftBatch(
  projectDirectory: string,
  drafts: RelayDraftInput[],
  options: RelayDraftPersistenceOptions = {},
): Promise<PromiseSettledResult<RelayDraftRequest | undefined>[]> {
  let snapshot: RelayDraftPersistenceSnapshot;
  try {
    snapshot = await prepareRelayDraftPersistence(projectDirectory);
  } catch (error) {
    return drafts.map(() => ({ reason: error, status: 'rejected' }));
  }
  const reservations = await Promise.allSettled(
    drafts.map(async draft => ({
      draft,
      reservation: await acquireRelayDraftReservation(
        projectDirectory,
        draft,
        snapshot,
        options.requestDependencies,
      ),
    })),
  );
  let filenames: string[];
  try {
    filenames = await sortedFilenames(snapshot.directory);
    await options.faults?.afterStateSnapshot?.();
  } catch (error) {
    return drafts.map(() => ({ reason: error, status: 'rejected' }));
  }
  const stateSnapshot: RelayStateSnapshot = {
    directory: snapshot.directory,
    discardIntentFilesByRequestId: discardIntentFilesByRequestId(filenames),
    statesByRequestId: reservedRequestStates(snapshot.directory, filenames),
  };
  return Promise.all(
    reservations.map(async outcome => {
      if (outcome.status !== 'fulfilled') return outcome;
      const { draft, reservation } = outcome.value;
      try {
        return {
          status: 'fulfilled',
          value: await resolveSourceReservation(projectDirectory, draft, reservation, {
            stateSnapshot,
          }),
        };
      } catch (error) {
        return { reason: error, status: 'rejected' };
      }
    }),
  );
}

export async function claimRelayRequest(
  projectDirectory: string,
  options: { claimId: string; excludeRequestIds?: Set<string>; leaseMs: number; now: number },
): Promise<RelayClaim | undefined> {
  if (!CLAIM_ID_PATTERN.test(options.claimId)) throw new Error('invalid relay claim identity');
  relayClaimExpiry(options.now, options.leaseMs);
  const directory = await ensureRelayDirectory(projectDirectory);
  let filenames = await sortedFilenames(directory);

  await recoverExpiredClaims(projectDirectory, filenames, options.now, options.excludeRequestIds);
  filenames = await sortedFilenames(directory);
  const stateSnapshot: RelayStateSnapshot = {
    directory,
    discardIntentFilesByRequestId: discardIntentFilesByRequestId(filenames),
    statesByRequestId: reservedRequestStates(directory, filenames),
  };
  for (const filename of filenames) {
    const requestId = parsePrimary(filename) ?? parseMaterializing(filename);
    if (
      requestId === undefined ||
      options.excludeRequestIds?.has(requestId) === true ||
      (await exists(ackPath(projectDirectory, requestId))) ||
      (await discardBlocks(projectDirectory, requestId, stateSnapshot))
    ) {
      continue;
    }
    const claim = await claimSpecificRelayRequest(projectDirectory, requestId, {
      claimId: options.claimId,
      leaseMs: options.leaseMs,
      now: options.now,
      stateSnapshot,
    });
    if (claim !== undefined) return claim;
  }
  return undefined;
}

// eslint-disable-next-line max-params -- Recovery inputs keep the immutable directory snapshot and its derived indexes together.
async function recoverExpiredClaims(
  projectDirectory: string,
  filenames: string[],
  now: number,
  excludeRequestIds?: Set<string>,
  recoveryOptions: RelaySpoolRecoveryOptions = {},
  discardIntentRequestIds = new Set<string>(),
): Promise<void> {
  const directory = relayDirectory(projectDirectory);
  for (const filename of filenames) {
    const parsed = parseClaim(filename);
    if (
      parsed === undefined ||
      parsed.expiresAt > now ||
      excludeRequestIds?.has(parsed.requestId) === true
    ) {
      continue;
    }
    await recoverExpiredClaim(
      projectDirectory,
      path.join(directory, filename),
      parsed.requestId,
      recoveryOptions,
      discardIntentRequestIds.has(parsed.requestId),
    );
  }
}

async function recoverExpiredClaim(
  projectDirectory: string,
  claimPath: string,
  requestId: string,
  recoveryOptions: RelaySpoolRecoveryOptions = {},
  hasDiscardIntentAtSnapshot = false,
): Promise<void> {
  if (await exists(discardedPath(projectDirectory, requestId))) {
    await removeIfPresent(claimPath);
    return;
  }
  if (hasDiscardIntentAtSnapshot) return;
  const siblingCandidates = await Promise.all(
    [
      primaryPath(projectDirectory, requestId),
      materializingPath(projectDirectory, requestId),
      deadLetterPath(projectDirectory, requestId),
    ].map(async candidate => ((await exists(candidate)) ? candidate : undefined)),
  );
  const sibling = siblingCandidates.find(
    (candidate): candidate is string => candidate !== undefined,
  );
  if (sibling !== undefined) {
    await removeDuplicateClaimIfMatching(claimPath, sibling, recoveryOptions);
    return;
  }
  try {
    await linkDurable(claimPath, primaryPath(projectDirectory, requestId));
    await unlinkDurable(claimPath);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

async function removeDuplicateClaimIfMatching(
  claimPath: string,
  siblingPath: string,
  recoveryOptions: RelaySpoolRecoveryOptions,
): Promise<void> {
  await recoveryOptions.faults?.beforeDuplicateRead?.(claimPath, siblingPath);
  const pair = await readPairIfPresent(claimPath, siblingPath);
  if (pair === undefined) return;
  const [claimBytes, siblingBytes] = pair;
  if (!claimBytes.equals(siblingBytes)) {
    const requestId = durableRequestId(path.basename(claimPath));
    if (requestId === undefined) throw new Error('invalid duplicate relay claim path');
    const conflictPath = path.join(
      path.dirname(claimPath),
      `${requestId}.claim-conflict.${randomUUID()}.json`,
    );
    await writeAtomic(conflictPath, claimBytes);
  }
  await removeIfPresent(claimPath);
}

async function claimSpecificRelayRequest(
  projectDirectory: string,
  requestId: string,
  options: { claimId: string; leaseMs: number; now: number; stateSnapshot?: RelayStateSnapshot },
): Promise<RelayClaim | undefined> {
  if (!CLAIM_ID_PATTERN.test(options.claimId)) throw new Error('invalid relay claim identity');
  const expiresAt = relayClaimExpiry(options.now, options.leaseMs);
  if (
    (await exists(ackPath(projectDirectory, requestId))) ||
    (await discardBlocks(projectDirectory, requestId, options.stateSnapshot))
  ) {
    return undefined;
  }
  const directory = relayDirectory(projectDirectory);
  const claimed = path.join(directory, `${requestId}.claim.${options.claimId}.${expiresAt}.json`);
  for (const candidate of [
    primaryPath(projectDirectory, requestId),
    materializingPath(projectDirectory, requestId),
  ]) {
    try {
      await renameDurable(candidate, claimed);
      if (await exists(discardedPath(projectDirectory, requestId))) {
        await removeIfPresent(claimed);
        return undefined;
      }
      return { bytes: await readFile(claimed), path: claimed, requestId };
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
  }
  return undefined;
}

function acknowledgementSourceMetadata(bytes: Buffer): {
  request: RelayDraftRequest;
  sourceKey: string;
  sourcePayloadHash: string;
} {
  const request = parseDurableRequest({ bytes });
  if (request === undefined) throw new Error('cannot acknowledge malformed relay request bytes');
  return {
    request,
    sourceKey: request.sourceKey,
    sourcePayloadHash: relaySourcePayloadDigest(request),
  };
}

function projectDirectoryForClaim(claim: RelayClaim): string {
  const directory = path.dirname(claim.path);
  const filename = path.basename(claim.path);
  const requestId = parseClaim(filename)?.requestId ?? parseRecoveryClaim(filename)?.requestId;
  const projectDirectory = path.resolve(directory, '..', '..', '..');
  if (requestId !== claim.requestId || relayDirectory(projectDirectory) !== directory) {
    throw new Error('invalid relay claim path');
  }
  return projectDirectory;
}

async function assertCompatibleAcknowledgement(
  durableAck: string,
  receipt: RelayReceipt,
): Promise<void> {
  const current = JSON.parse(await readFile(durableAck, 'utf8')) as RelayReceipt;
  if (current.requestId !== receipt.requestId || current.receiptId !== receipt.receiptId) {
    throw new Error('relay acknowledgement conflicts with the durable receipt');
  }
}

async function readDurableClaimBytes(claimPath: string): Promise<Buffer | undefined> {
  try {
    return await readFile(claimPath);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
}

export async function acknowledgeRelayClaim(
  claim: RelayClaim,
  receipt: RelayReceipt,
  options: RelayFaultOptions = {},
): Promise<boolean> {
  const projectDirectory = projectDirectoryForClaim(claim);
  if (receipt.requestId !== claim.requestId) return false;
  const durableClaimBytes = await readDurableClaimBytes(claim.path);
  if (durableClaimBytes === undefined) return false;
  if (!durableClaimBytes.equals(claim.bytes)) {
    throw new Error('relay claim bytes do not match the durable claim');
  }
  const faults = options.faults ?? {};
  await faults.afterOwnershipCheck?.();
  const durableAck = ackPath(projectDirectory, claim.requestId);
  const { request, sourceKey, sourcePayloadHash } =
    acknowledgementSourceMetadata(durableClaimBytes);
  if (request.requestId !== claim.requestId) {
    throw new Error('relay claim bytes do not match the claimed request identity');
  }
  const written = await writeAtomic(
    durableAck,
    Buffer.from(
      JSON.stringify({
        ...receipt,
        sourceKey,
        sourcePayloadHash,
      }),
      'utf8',
    ),
  );
  if (!written) await assertCompatibleAcknowledgement(durableAck, receipt);
  await compactSourceReservation(projectDirectory, request, options);
  await faults.afterAck?.();
  await removeIfPresent(discardedPath(projectDirectory, claim.requestId));
  await cancelDiscardIntents(projectDirectory, claim.requestId);
  await removeIfPresent(claim.path);
  await removeIfPresent(durableAck);
  return true;
}

type RelaySpoolRecoveryOptions = RelayFaultOptions;

export async function recoverRelaySpool(
  projectDirectory: string,
  now: number,
  recoveryOptions: RelaySpoolRecoveryOptions = {},
): Promise<void> {
  const directory = await ensureRelayDirectory(projectDirectory);
  let filenames = await readdir(directory);
  await cleanupStaleAtomicTemporaries(directory, filenames, now);
  filenames = await readdir(directory);
  await recoverDiscardIntents(projectDirectory, filenames, now);
  filenames = await readdir(directory);
  const discardIntentRequestIds = new Set(
    filenames
      .map(filename => parseDiscardIntent(filename)?.requestId)
      .filter((requestId): requestId is string => requestId !== undefined),
  );
  await recoverExpiredClaims(
    projectDirectory,
    filenames,
    now,
    undefined,
    recoveryOptions,
    discardIntentRequestIds,
  );
  filenames = await readdir(directory);
  await recoverExpiredRecoveryClaims(
    projectDirectory,
    filenames,
    now,
    recoveryOptions,
    discardIntentRequestIds,
  );
  filenames = await readdir(directory);
  await recoverDiscardedRequests(projectDirectory, filenames);
  filenames = await readdir(directory);
  const acknowledged = new Set(
    filenames
      .map(filename => /^([0-9a-f-]+)\.ack\.json$/u.exec(filename)?.[1])
      .filter((requestId): requestId is string => requestId !== undefined),
  );
  await forEachRelayChunk(filenames, filename =>
    cleanupAcknowledgedFile(projectDirectory, directory, filename, acknowledged, recoveryOptions),
  );
  await cleanupOrphanAcknowledgements(directory);
}

async function forEachRelayChunk<T>(
  items: T[],
  operation: (item: T) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < items.length; index += RELAY_FILE_CONCURRENCY) {
    const outcomes = await Promise.allSettled(
      items.slice(index, index + RELAY_FILE_CONCURRENCY).map(item => operation(item)),
    );
    const failure = outcomes.find(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    if (failure !== undefined) throw failure.reason;
  }
}

async function cleanupStaleAtomicTemporaries(
  directory: string,
  filenames: string[],
  now: number,
): Promise<void> {
  await forEachRelayChunk(filenames, async filename => {
    let retentionMs: number | undefined;
    if (ATOMIC_TEMPORARY_FILENAME_PATTERN.test(filename)) {
      retentionMs = ATOMIC_TEMPORARY_STALE_MS;
    } else if (
      SOURCE_ACKNOWLEDGEMENT_CONFLICT_FILENAME_PATTERN.test(filename) ||
      CLAIM_CONFLICT_FILENAME_PATTERN.test(filename)
    ) {
      retentionMs = SOURCE_ACKNOWLEDGEMENT_CONFLICT_RETENTION_MS;
    }
    if (retentionMs === undefined) return;
    const file = path.join(directory, filename);
    try {
      const metadata = await stat(file);
      if (metadata.mtimeMs + retentionMs > now) return;
      await removeIfPresent(file);
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
  });
}

async function cleanupAcknowledgedFile(
  projectDirectory: string,
  directory: string,
  filename: string,
  acknowledged: Set<string>,
  recoveryOptions: RelaySpoolRecoveryOptions,
): Promise<void> {
  const requestId = durableRequestId(filename);
  if (requestId === undefined || !acknowledged.has(requestId)) return;
  const file = path.join(directory, filename);
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return;
    throw error;
  }
  const request = parseDurableRequest({ bytes });
  if (request?.requestId === requestId) {
    await compactSourceReservation(projectDirectory, request, recoveryOptions);
  } else {
    await compactAcknowledgedReservationByRequestId(
      projectDirectory,
      directory,
      requestId,
      recoveryOptions,
    );
  }
  await removeIfPresent(file);
  await removeIfPresent(ackPath(projectDirectory, requestId));
}

async function compactAcknowledgedReservationByRequestId(
  projectDirectory: string,
  directory: string,
  requestId: string,
  recoveryOptions: RelaySpoolRecoveryOptions,
): Promise<void> {
  const filenames = await readdir(directory);
  const reservations = await activeSourceReservations(directory, filenames);
  for (const { reservation } of reservations) {
    if (reservation.request.requestId === requestId) {
      await compactSourceReservation(projectDirectory, reservation.request, recoveryOptions);
      return;
    }
  }
}

async function cleanupOrphanAcknowledgements(directory: string): Promise<void> {
  const filenames = await readdir(directory);
  const durableRequestIds = new Set(
    filenames
      .map(filename => durableRequestId(filename))
      .filter((requestId): requestId is string => requestId !== undefined),
  );
  await forEachRelayChunk(filenames, async filename => {
    const requestId = /^([0-9a-f-]+)\.ack\.json$/u.exec(filename)?.[1];
    if (requestId === undefined || durableRequestIds.has(requestId)) return;
    await removeIfPresent(path.join(directory, filename));
  });
}

async function recoverDiscardIntents(
  projectDirectory: string,
  filenames: string[],
  now: number,
): Promise<void> {
  for (const filename of filenames) {
    const parsed = parseDiscardIntent(filename);
    if (parsed === undefined) continue;
    const intent = await loadDiscardIntent(projectDirectory, filename);
    if (intent === undefined) continue;
    if (await exists(ackPath(projectDirectory, parsed.requestId))) {
      await cancelDiscardIntent(intent);
      continue;
    }
    const foreignClaim = filenames.some(candidate => {
      const claim = parseClaim(candidate) ?? parseRecoveryClaim(candidate);
      return claim?.requestId === parsed.requestId && claim.claimId !== intent.claimId;
    });
    if (foreignClaim) {
      await cancelDiscardIntent(intent);
      continue;
    }
    if (intent.expiresAt > now) continue;
    await commitDiscardIntent(projectDirectory, intent);
  }
}

async function recoverDiscardedRequests(
  projectDirectory: string,
  filenames: string[],
): Promise<void> {
  const directory = relayDirectory(projectDirectory);
  const reservationFilesByRequestId = await reservationFileMap(directory, filenames);
  for (const filename of filenames) {
    const requestId = parseDiscarded(filename);
    if (requestId === undefined) continue;
    if (await exists(ackPath(projectDirectory, requestId))) {
      await removeIfPresent(path.join(directory, filename));
      continue;
    }
    const reservationFiles = reservationFilesByRequestId.get(requestId) ?? [];
    const durableFiles = filenames.filter(candidate => {
      const claim = parseClaim(candidate) ?? parseRecoveryClaim(candidate);
      return (
        parsePrimary(candidate) === requestId ||
        parseMaterializing(candidate) === requestId ||
        parseDeadLetter(candidate) === requestId ||
        claim?.requestId === requestId
      );
    });
    await compactDiscardedReservationFiles(
      projectDirectory,
      directory,
      reservationFiles,
      requestId,
    );
    await Promise.all(
      durableFiles.map(candidate => removeIfPresent(path.join(directory, candidate))),
    );
  }
}

async function compactDiscardedReservationFiles(
  projectDirectory: string,
  directory: string,
  filenames: string[],
  requestId: string,
  options: RelayFaultOptions = {},
): Promise<void> {
  const reservations = await activeSourceReservations(directory, filenames);
  for (const { reservation } of reservations) {
    if (reservation.request.requestId === requestId) {
      await compactDiscardedSourceReservation(projectDirectory, reservation, options);
    }
  }
}

type ActiveSourceReservation = Extract<RelaySourceReservation, { state: 'active' }>;

async function activeSourceReservations(
  directory: string,
  filenames: string[],
): Promise<{ filename: string; reservation: ActiveSourceReservation }[]> {
  const reservations: { filename: string; reservation: ActiveSourceReservation }[] = [];
  for (const filename of filenames) {
    if (!SOURCE_RESERVATION_FILENAME_PATTERN.test(filename)) continue;
    let serialized: string;
    try {
      serialized = await readFile(path.join(directory, filename), 'utf8');
    } catch (error) {
      if (errorCode(error) === 'ENOENT') continue;
      throw error;
    }
    try {
      const reservation = JSON.parse(serialized) as unknown;
      if (sourceReservationShape(reservation) && reservation.state === 'active') {
        reservations.push({ filename, reservation });
      }
    } catch {
      // Malformed reservation bytes cannot prove an identity; filesystem errors above remain fatal.
    }
  }
  return reservations;
}

async function reservationFilesForRequest(
  directory: string,
  filenames: string[],
  requestId: string,
): Promise<string[]> {
  const reservations = await activeSourceReservations(directory, filenames);
  return reservations
    .filter(({ reservation }) => reservation.request.requestId === requestId)
    .map(({ filename }) => filename);
}

async function reservationFileMap(
  directory: string,
  filenames: string[],
): Promise<Map<string, string[]>> {
  const byRequestId = new Map<string, string[]>();
  const reservations = await activeSourceReservations(directory, filenames);
  for (const { filename, reservation } of reservations) {
    const requestId = reservation.request.requestId;
    byRequestId.set(requestId, [...(byRequestId.get(requestId) ?? []), filename]);
  }
  return byRequestId;
}

function discardHasConflict(
  filenames: string[],
  requestId: string,
  discardClaimId: string,
): boolean {
  return filenames.some(filename => {
    const claim = parseClaim(filename) ?? parseRecoveryClaim(filename);
    return (
      (claim?.requestId === requestId && claim.claimId !== discardClaimId) ||
      parsePrimary(filename) === requestId ||
      parseMaterializing(filename) === requestId ||
      parseDeadLetter(filename) === requestId
    );
  });
}

async function releaseDiscardOwnership(
  projectDirectory: string,
  ownership: { delivery?: RelayClaim; recovery?: RelayClaim },
  rearm: boolean,
): Promise<void> {
  if (ownership.delivery !== undefined) {
    if (rearm) await rearmClaim(projectDirectory, ownership.delivery);
    else await removeIfPresent(ownership.delivery.path);
  }
  if (ownership.recovery !== undefined) {
    if (rearm) await releaseRecoveryClaim(projectDirectory, ownership.recovery);
    else await removeIfPresent(ownership.recovery.path);
  }
}

type DiscardIntent = {
  claimId: string;
  expiresAt: number;
  requestId: string;
  tokenPath: string;
};

async function createDiscardIntent(
  projectDirectory: string,
  requestId: string,
  claimId: string,
): Promise<DiscardIntent> {
  const token = randomUUID();
  const tokenPath = discardIntentTokenPath(projectDirectory, requestId, token);
  const startedAt = Date.now();
  const expiresAt = startedAt + DISCARD_INTENT_LEASE_MS;
  const record = JSON.stringify({
    claimId,
    expiresAt,
    requestId,
    startedAt: new Date(startedAt).toISOString(),
    token,
    version: 1,
  });
  if (!(await writeAtomic(tokenPath, Buffer.from(record, 'utf8')))) {
    throw new Error('relay discard intent token collided');
  }
  return { claimId, expiresAt, requestId, tokenPath };
}

async function loadDiscardIntent(
  projectDirectory: string,
  filename: string,
): Promise<DiscardIntent | undefined> {
  const parsed = parseDiscardIntent(filename);
  if (parsed === undefined) return undefined;
  const tokenPath = discardIntentTokenPath(projectDirectory, parsed.requestId, parsed.token);
  try {
    const record = JSON.parse(await readFile(tokenPath, 'utf8')) as {
      claimId?: unknown;
      expiresAt?: unknown;
      requestId?: unknown;
      startedAt?: unknown;
      token?: unknown;
    };
    const legacyExpiry =
      typeof record.startedAt === 'string'
        ? Date.parse(record.startedAt) + DISCARD_INTENT_LEASE_MS
        : NaN;
    const expiresAt = typeof record.expiresAt === 'number' ? record.expiresAt : legacyExpiry;
    if (
      record.requestId !== parsed.requestId ||
      typeof record.claimId !== 'string' ||
      !Number.isSafeInteger(expiresAt) ||
      record.token !== parsed.token
    ) {
      return undefined;
    }
    return {
      claimId: record.claimId,
      expiresAt,
      requestId: parsed.requestId,
      tokenPath,
    };
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
}

async function cancelDiscardIntent(intent: DiscardIntent): Promise<void> {
  await removeIfPresent(intent.tokenPath);
}

async function cancelDiscardIntents(projectDirectory: string, requestId: string): Promise<void> {
  const directory = relayDirectory(projectDirectory);
  const filenames = await sortedFilenames(directory);
  await forEachRelayChunk(filenames, async filename => {
    if (parseDiscardIntent(filename)?.requestId !== requestId) return;
    await removeIfPresent(path.join(directory, filename));
  });
}

async function commitDiscardIntent(
  projectDirectory: string,
  intent: DiscardIntent,
): Promise<boolean> {
  try {
    await linkDurable(intent.tokenPath, discardedPath(projectDirectory, intent.requestId));
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return discardTombstoneMatches(projectDirectory, intent.requestId);
    }
    if (errorCode(error) !== 'EEXIST') throw error;
    if (!(await discardTombstoneMatches(projectDirectory, intent.requestId))) {
      throw new Error('relay discard tombstone conflicts with the request identity', {
        cause: error,
      });
    }
  }
  await cancelDiscardIntent(intent);
  return true;
}

async function discardTombstoneMatches(
  projectDirectory: string,
  requestId: string,
): Promise<boolean> {
  try {
    const existing = JSON.parse(
      await readFile(discardedPath(projectDirectory, requestId), 'utf8'),
    ) as { requestId?: unknown };
    return existing.requestId === requestId;
  } catch {
    return false;
  }
}

async function removeRelayFiles(directory: string, filenames: string[]): Promise<void> {
  for (const filename of filenames) await removeIfPresent(path.join(directory, filename));
}

type RelayDiscardFaults = RelayFaultOptions;

async function discardOwnedRelayRequest(
  projectDirectory: string,
  requestId: string,
  options: RelayDiscardFaults = {},
): Promise<boolean> {
  const faults = options.faults ?? {};
  const directory = relayDirectory(projectDirectory);
  const discardClaimId = `discard-${randomUUID()}`;
  const discardClaim = await claimSpecificRelayRequest(projectDirectory, requestId, {
    claimId: discardClaimId,
    leaseMs: DISCARD_CLAIM_LEASE_MS,
    now: Date.now(),
  });
  const discardRecoveryClaim = await claimRelayDeadLetter(
    projectDirectory,
    requestId,
    discardClaimId,
  );
  const ownership = { delivery: discardClaim, recovery: discardRecoveryClaim };
  const intent = await createDiscardIntent(projectDirectory, requestId, discardClaimId);
  await faults.afterClaims?.();
  const filenames = await sortedFilenames(directory);
  if (discardHasConflict(filenames, requestId, discardClaimId)) {
    await cancelDiscardIntent(intent);
    await releaseDiscardOwnership(projectDirectory, ownership, true);
    throw new Error('relay request is actively claimed; retry discard after delivery completes');
  }
  await faults.afterConflictCheck?.();
  if (await exists(ackPath(projectDirectory, requestId))) {
    await cancelDiscardIntent(intent);
    await releaseDiscardOwnership(projectDirectory, ownership, false);
    return false;
  }
  const durableFiles = filenames.filter(
    filename =>
      parseClaim(filename)?.claimId === discardClaimId ||
      parseRecoveryClaim(filename)?.claimId === discardClaimId ||
      filename === `${requestId}.ack.json`,
  );
  const reservationFiles = await reservationFilesForRequest(directory, filenames, requestId);
  if (durableFiles.length + reservationFiles.length === 0) {
    await cancelDiscardIntent(intent);
    return exists(discardedPath(projectDirectory, requestId));
  }
  if (!(await commitDiscardIntent(projectDirectory, intent))) {
    await releaseDiscardOwnership(projectDirectory, ownership, true);
    throw new Error('relay request discard lost its transition ownership');
  }
  await faults.afterTombstone?.();
  await compactDiscardedReservationFiles(projectDirectory, directory, reservationFiles, requestId, {
    faults: options.faults,
  });
  await removeRelayFiles(directory, durableFiles);
  await removeRetrySchedule(projectDirectory, requestId);
  return true;
}

export async function discardRelayRequest(
  projectDirectory: string,
  requestId: string,
  options: RelayDiscardFaults = {},
): Promise<boolean> {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  await ensureRelayDirectory(projectDirectory);
  await recoverRelaySpool(projectDirectory, Date.now());
  if (await exists(discardedPath(projectDirectory, requestId))) return false;
  return discardOwnedRelayRequest(projectDirectory, requestId, options);
}

export async function listRelayRequests(
  projectDirectory: string,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  await recoverRelaySpool(projectDirectory, Date.now());
  const directory = relayDirectory(projectDirectory);
  const filenames = await sortedFilenames(directory);
  return relayRequestsFromFilenames(directory, filenames);
}

async function relayRequestsFromFilenames(
  directory: string,
  filenames: string[],
): Promise<{ bytes: Buffer; requestId: string }[]> {
  return readRelayFiles(
    directory,
    filenames,
    filename =>
      parsePrimary(filename) ?? parseMaterializing(filename) ?? parseClaim(filename)?.requestId,
  );
}

export async function listRelayDeadLetters(
  projectDirectory: string,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  await recoverRelaySpool(projectDirectory, Date.now());
  const directory = await ensureRelayDirectory(projectDirectory);
  const filenames = await sortedFilenames(directory);
  return relayDeadLettersFromFilenames(directory, filenames);
}

export async function listRelaySpoolEntries(projectDirectory: string): Promise<
  {
    requestId: string;
    state: 'active' | 'dead-letter' | 'delivery-claim' | 'materializing' | 'recovery-claim';
  }[]
> {
  await recoverRelaySpool(projectDirectory, Date.now());
  const filenames = await sortedFilenames(relayDirectory(projectDirectory));
  const entries = new Map<
    string,
    'active' | 'dead-letter' | 'delivery-claim' | 'materializing' | 'recovery-claim'
  >();
  for (const filename of filenames) {
    const entry = relaySpoolEntry(filename);
    if (entry === undefined) continue;
    const current = entries.get(entry.requestId);
    if (
      current === undefined ||
      relaySpoolStatePrecedence(entry.state) > relaySpoolStatePrecedence(current)
    ) {
      entries.set(entry.requestId, entry.state);
    }
  }
  return [...entries].map(([requestId, state]) => ({ requestId, state }));
}

type RelaySpoolEntry = Awaited<ReturnType<typeof listRelaySpoolEntries>>[number];

function relaySpoolStatePrecedence(state: RelaySpoolEntry['state']): number {
  switch (state) {
    case 'active': {
      return 0;
    }
    case 'materializing': {
      return 1;
    }
    case 'dead-letter': {
      return 2;
    }
    case 'delivery-claim': {
      return 3;
    }
    case 'recovery-claim': {
      return 4;
    }
  }
}

function relaySpoolEntry(filename: string): RelaySpoolEntry | undefined {
  const delivery = parseClaim(filename);
  if (delivery !== undefined) return { requestId: delivery.requestId, state: 'delivery-claim' };
  const recovery = parseRecoveryClaim(filename);
  if (recovery !== undefined) return { requestId: recovery.requestId, state: 'recovery-claim' };
  const deadLetter = parseDeadLetter(filename);
  if (deadLetter !== undefined) return { requestId: deadLetter, state: 'dead-letter' };
  const materializing = parseMaterializing(filename);
  if (materializing !== undefined) return { requestId: materializing, state: 'materializing' };
  const active = parsePrimary(filename);
  return active === undefined ? undefined : { requestId: active, state: 'active' };
}

async function relayDeadLettersFromFilenames(
  directory: string,
  filenames: string[],
): Promise<{ bytes: Buffer; requestId: string }[]> {
  return readRelayFiles(directory, filenames, parseDeadLetter);
}

async function readRelayFiles(
  directory: string,
  filenames: string[],
  requestIdFor: (filename: string) => string | undefined,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  const candidates = filenames.flatMap(filename => {
    const requestId = requestIdFor(filename);
    return requestId === undefined ? [] : [{ filename, requestId }];
  });
  const requests: { bytes: Buffer; requestId: string }[] = [];
  for (let index = 0; index < candidates.length; index += RELAY_FILE_CONCURRENCY) {
    const chunk = candidates.slice(index, index + RELAY_FILE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async ({ filename, requestId }) => {
        try {
          return {
            found: true as const,
            request: { bytes: await readFile(path.join(directory, filename)), requestId },
          };
        } catch (error) {
          if (errorCode(error) === 'ENOENT') return { found: false as const };
          throw error;
        }
      }),
    );
    requests.push(...results.flatMap(result => (result.found ? [result.request] : [])));
  }
  return requests;
}

async function rearmClaim(
  projectDirectory: string,
  claim: RelayClaim,
  stateSnapshot?: RelayStateSnapshot,
): Promise<void> {
  if (await discardBlocks(projectDirectory, claim.requestId, stateSnapshot)) return;
  if (
    (await exists(ackPath(projectDirectory, claim.requestId))) ||
    (await exists(discardedPath(projectDirectory, claim.requestId)))
  ) {
    await removeIfPresent(claim.path);
    return;
  }
  try {
    await linkDurable(claim.path, primaryPath(projectDirectory, claim.requestId));
    await unlinkDurable(claim.path);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

async function deadLetterClaim(
  projectDirectory: string,
  claim: RelayClaim,
  stateSnapshot?: RelayStateSnapshot,
): Promise<boolean> {
  if (await discardBlocks(projectDirectory, claim.requestId, stateSnapshot)) return false;
  if (await exists(discardedPath(projectDirectory, claim.requestId))) {
    await removeIfPresent(claim.path);
    return false;
  }
  const deadLetter = deadLetterPath(projectDirectory, claim.requestId);
  try {
    await linkDurable(claim.path, deadLetter);
    await unlinkDurable(claim.path);
    await removeRetrySchedule(projectDirectory, claim.requestId);
    return true;
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
    return false;
  }
}

async function claimRelayDeadLetter(
  projectDirectory: string,
  requestId: string,
  claimId: string,
  now = Date.now(),
): Promise<RelayClaim | undefined> {
  if (!CLAIM_ID_PATTERN.test(claimId)) throw new Error('invalid relay claim identity');
  if (await discardBlocks(projectDirectory, requestId)) return undefined;
  const expiresAt = relayClaimExpiry(now, RECOVERY_CLAIM_LEASE_MS);
  const claimed = path.join(
    relayDirectory(projectDirectory),
    `${requestId}.recovery-claim.${claimId}.${expiresAt}.json`,
  );
  try {
    await renameDurable(deadLetterPath(projectDirectory, requestId), claimed);
    if (await exists(discardedPath(projectDirectory, requestId))) {
      await removeIfPresent(claimed);
      return undefined;
    }
    return { bytes: await readFile(claimed), path: claimed, requestId };
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
    return undefined;
  }
}

async function releaseRecoveryClaim(
  projectDirectory: string,
  claim: RelayClaim,
  discardIntentAtSnapshot?: boolean,
): Promise<void> {
  if (discardIntentAtSnapshot ?? (await hasDiscardIntent(projectDirectory, claim.requestId)))
    return;
  if (await exists(discardedPath(projectDirectory, claim.requestId))) {
    await removeIfPresent(claim.path);
    return;
  }
  try {
    await linkDurable(claim.path, deadLetterPath(projectDirectory, claim.requestId));
    await unlinkDurable(claim.path);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

async function recoverExpiredRecoveryClaims(
  projectDirectory: string,
  filenames: string[],
  now: number,
  recoveryOptions: RelaySpoolRecoveryOptions = {},
  discardIntentRequestIds = new Set<string>(),
): Promise<void> {
  const directory = relayDirectory(projectDirectory);
  for (const filename of filenames) {
    const parsed = parseRecoveryClaim(filename);
    if (parsed === undefined || parsed.expiresAt > now) continue;
    const claimPath = path.join(directory, filename);
    if (await exists(discardedPath(projectDirectory, parsed.requestId))) {
      await removeIfPresent(claimPath);
      continue;
    }
    if (discardIntentRequestIds.has(parsed.requestId)) continue;
    const activeCandidates = await Promise.all(
      [
        primaryPath(projectDirectory, parsed.requestId),
        materializingPath(projectDirectory, parsed.requestId),
      ].map(async candidate => ((await exists(candidate)) ? candidate : undefined)),
    );
    const activeSibling = activeCandidates.find(
      (candidate): candidate is string => candidate !== undefined,
    );
    if (activeSibling !== undefined) {
      await removeDuplicateClaimIfMatching(claimPath, activeSibling, recoveryOptions);
      continue;
    }
    await releaseRecoveryClaim(
      projectDirectory,
      {
        bytes: Buffer.alloc(0),
        path: claimPath,
        requestId: parsed.requestId,
      },
      false,
    );
  }
}

export async function rearmRelayDeadLetter(
  projectDirectory: string,
  requestId: string,
): Promise<boolean> {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  const claim = await claimRelayDeadLetter(projectDirectory, requestId, `rearm-${randomUUID()}`);
  if (claim === undefined) return false;
  const primary = primaryPath(projectDirectory, requestId);
  if (await exists(primary)) {
    await releaseRecoveryClaim(projectDirectory, claim);
    throw new Error('relay request is already active');
  }
  try {
    await linkDurable(claim.path, primary);
    await unlinkDurable(claim.path);
    await removeRetrySchedule(projectDirectory, requestId);
    return true;
  } catch (error) {
    if (errorCode(error) === 'EEXIST') {
      await releaseRecoveryClaim(projectDirectory, claim);
      throw new Error('relay request is already active', { cause: error });
    }
    throw error;
  }
}

interface RelayRecoveryOptions {
  credential: string;
  fetch: typeof fetch;
  operatorCredential?: string;
  relayUrl: string;
  timeoutMs?: number;
}

function relaySubmissionHeaders(credential: string): Record<string, string> {
  return {
    authorization: `Bearer ${credential}`,
    'content-type': 'application/json',
    [RELAY_API_VERSION_HEADER]: RELAY_API_VERSION,
  };
}

function submitRelayRecovery(
  relayOrigin: string,
  request: RelayDraftRequest,
  options: RelayRecoveryOptions,
): Promise<Response> {
  return options.fetch(`${relayOrigin}/v1/retro-filings`, {
    body: relayRequestBytes(request),
    headers: relaySubmissionHeaders(options.credential),
    method: 'POST',
    signal: AbortSignal.timeout(options.timeoutMs ?? 750),
  });
}

async function submitRelayRecoveryAttempt(
  relayOrigin: string,
  request: RelayDraftRequest,
  options: RelayRecoveryOptions,
): Promise<{ body: Record<string, unknown> | undefined; response: Response }> {
  const response = await submitRelayRecovery(relayOrigin, request, options);
  return { body: await relayResponseBody(response), response };
}

function relayRecoveryOrigin(options: RelayRecoveryOptions): string {
  if (options.credential.trim().length === 0) {
    throw new Error('invalid relay recovery configuration');
  }
  const relayOrigin = normalizeRelayOrigin(options.relayUrl);
  if (relayOrigin === undefined) throw new Error('invalid relay recovery configuration');
  return relayOrigin;
}

function assertValidRelayReceipt(receipt: RelayReceipt, requestId: string): void {
  if (receipt.requestId !== requestId || typeof receipt.receiptId !== 'string') {
    throw new Error('relay returned an invalid durable receipt');
  }
}

function assertAcknowledgeableRelayReceipt(receipt: RelayReceipt, requestId: string): void {
  assertValidRelayReceipt(receipt, requestId);
  if (!ACKNOWLEDGEABLE_RELAY_RECEIPT_STATES.has(receipt.state)) {
    throw new RetryableRelayDeliveryError('relay returned an unrecognized durable ownership state');
  }
}

async function relayResponseBody(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const body = await response.json();
    return typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function relayReceiptFromBody(
  body: Record<string, unknown> | undefined,
  requestId: string,
): RelayReceipt | undefined {
  if (
    body?.requestId !== requestId ||
    typeof body.receiptId !== 'string' ||
    typeof body.state !== 'string' ||
    (body.issueNumber !== undefined && typeof body.issueNumber !== 'number')
  ) {
    return undefined;
  }
  return {
    ...(typeof body.issueNumber === 'number' && { issueNumber: body.issueNumber }),
    receiptId: body.receiptId,
    requestId,
    state: body.state,
  };
}

function needsDeadlineRenewal(
  attempt: { body: Record<string, unknown> | undefined; response: Response },
  request: RelayDraftRequest,
): boolean {
  const retryDeadline = Date.parse(request.retryDeadlineAt);
  return (
    attempt.response.status === 400 &&
    attempt.body?.reason === 'retry-deadline-elapsed' &&
    Number.isFinite(retryDeadline) &&
    retryDeadline <= Date.now()
  );
}

async function renewRelayRecovery(
  relayOrigin: string,
  original: RelayDraftRequest,
  originalBytes: Buffer,
  deadLetter: string,
  options: RelayRecoveryOptions,
): Promise<{
  body: Record<string, unknown> | undefined;
  request: RelayDraftRequest;
  response: Response;
}> {
  const renewed = {
    ...original,
    retryDeadlineAt: new Date(Date.now() + RELAY_RETRY_WINDOW_MS).toISOString(),
  };
  await replaceAtomic(deadLetter, Buffer.from(JSON.stringify(renewed), 'utf8'));
  const attempt = await submitRelayRecoveryAttempt(relayOrigin, renewed, options);
  const payloadRejected =
    attempt.response.status === 409 ||
    (attempt.response.status === 400 && attempt.body?.reason === 'invalid-request');
  if (payloadRejected) {
    await replaceAtomic(deadLetter, originalBytes);
    return { ...attempt, request: original };
  }
  return { ...attempt, request: renewed };
}

async function recoverRelayReceipt(
  relayOrigin: string,
  request: RelayDraftRequest,
  receipt: RelayReceipt,
  deadLetter: string,
  options: RelayRecoveryOptions,
): Promise<boolean> {
  if (options.operatorCredential === undefined) return false;
  const response = await options.fetch(
    `${relayOrigin}/v1/retro-filings/${encodeURIComponent(receipt.receiptId)}/recover`,
    {
      headers: {
        authorization: `Bearer ${options.operatorCredential}`,
        [RELAY_API_VERSION_HEADER]: RELAY_API_VERSION,
      },
      method: 'POST',
      signal: AbortSignal.timeout(options.timeoutMs ?? 750),
    },
  );
  if (!response.ok) return false;
  const recovered = relayReceiptFromBody(await relayResponseBody(response), request.requestId);
  if (
    recovered?.receiptId !== receipt.receiptId ||
    !['filed', 'tombstone'].includes(recovered?.state ?? '')
  ) {
    return false;
  }
  return acknowledgeRelayClaim(
    {
      bytes: Buffer.from(JSON.stringify(request), 'utf8'),
      path: deadLetter,
      requestId: request.requestId,
    },
    recovered,
  );
}

// eslint-disable-next-line complexity -- Recovery validates, renews, and reconciles one durable ownership transition.
export async function recoverRelayDeadLetter(
  projectDirectory: string,
  requestId: string,
  options: RelayRecoveryOptions,
): Promise<boolean> {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  await recoverRelaySpool(projectDirectory, Date.now());
  const relayOrigin = relayRecoveryOrigin(options);
  const claim = await claimRelayDeadLetter(projectDirectory, requestId, `recover-${randomUUID()}`);
  if (claim === undefined) return false;
  try {
    const original = parseDurableRequest(claim);
    if (original?.requestId !== requestId) return false;
    const initial = await submitRelayRecoveryAttempt(relayOrigin, original, options);
    const attempt = needsDeadlineRenewal(initial, original)
      ? await renewRelayRecovery(relayOrigin, original, claim.bytes, claim.path, options)
      : { ...initial, request: original };
    const receipt = relayReceiptFromBody(attempt.body, requestId);
    if (receipt?.state === 'ambiguous') {
      return await recoverRelayReceipt(relayOrigin, attempt.request, receipt, claim.path, options);
    }
    if (!attempt.response.ok || receipt === undefined) return false;
    assertValidRelayReceipt(receipt, requestId);
    if (receipt.state === 'dead-letter') {
      return await recoverRelayReceipt(relayOrigin, attempt.request, receipt, claim.path, options);
    }
    if (!['filed', 'rejected', 'tombstone'].includes(receipt.state)) return false;
    return await acknowledgeRelayClaim(
      {
        bytes: Buffer.from(JSON.stringify(attempt.request), 'utf8'),
        path: claim.path,
        requestId,
      },
      receipt,
    );
  } finally {
    await releaseRecoveryClaim(projectDirectory, claim);
  }
}

function retryableRelayStatus(status: number): boolean {
  return status === 401 || status === 408 || status === 425 || status === 429 || status >= 500;
}

function isIncompatibleRelayVersion(
  response: Response,
  body: Record<string, unknown> | undefined,
): boolean {
  return response.status === 400 && typeof body?.supportedVersion === 'string';
}

class RetryableRelayDeliveryError extends Error {}

interface RelayDeliveryPriority {
  createdAt: number;
  requestId: string;
  retryDeadlineAt: number;
}

function relayDeliveryPriority(candidate: DurableRelayFile): RelayDeliveryPriority {
  const request = parseDurableRequest(candidate);
  if (request === undefined) {
    return {
      createdAt: -Infinity,
      requestId: candidate.requestId,
      retryDeadlineAt: -Infinity,
    };
  }
  return {
    createdAt: Date.parse(request.createdAt),
    requestId: request.requestId,
    retryDeadlineAt: Date.parse(request.retryDeadlineAt),
  };
}

function compareRelayDeliveryPriority(
  leftPriority: RelayDeliveryPriority,
  rightPriority: RelayDeliveryPriority,
): number {
  return (
    leftPriority.retryDeadlineAt - rightPriority.retryDeadlineAt ||
    leftPriority.createdAt - rightPriority.createdAt ||
    leftPriority.requestId.localeCompare(rightPriority.requestId)
  );
}

function orderedRelayCandidates(candidates: DurableRelayFile[]): DurableRelayFile[] {
  return candidates
    .map(candidate => ({ candidate, priority: relayDeliveryPriority(candidate) }))
    .toSorted((left, right) => compareRelayDeliveryPriority(left.priority, right.priority))
    .map(({ candidate }) => candidate);
}

type RelayRetrySchedule = { attemptCount: number; nextAttemptAt: number; version: 1 };

function isRelayRetrySchedule(value: unknown): value is RelayRetrySchedule {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return false;
  if (!Number.isSafeInteger(candidate.attemptCount)) return false;
  if ((candidate.attemptCount as number) < 0) return false;
  if (!Number.isFinite(candidate.nextAttemptAt)) return false;
  return (candidate.nextAttemptAt as number) >= 0;
}

async function retryScheduleFor(
  projectDirectory: string,
  requestId: string,
): Promise<RelayRetrySchedule | undefined> {
  let serialized: string;
  try {
    serialized = await readFile(retrySchedulePath(projectDirectory, requestId), 'utf8');
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
  try {
    const value = JSON.parse(serialized) as unknown;
    if (!isRelayRetrySchedule(value)) throw new Error('invalid relay retry schedule');
    return value;
  } catch {
    // A readable but malformed schedule is disposable local backoff metadata.
    await removeIfPresent(retrySchedulePath(projectDirectory, requestId));
    return undefined;
  }
}

async function deferRelayClaim(
  projectDirectory: string,
  claim: RelayClaim,
  now: number,
  stateSnapshot?: RelayStateSnapshot,
): Promise<void> {
  const previous = await retryScheduleFor(projectDirectory, claim.requestId);
  const attemptCount = (previous?.attemptCount ?? 0) + 1;
  const delay = Math.min(
    RELAY_RETRY_BACKOFF_MS * 2 ** (attemptCount - 1),
    MAX_RELAY_RETRY_BACKOFF_MS,
  );
  await replaceAtomic(
    retrySchedulePath(projectDirectory, claim.requestId),
    Buffer.from(JSON.stringify({ attemptCount, nextAttemptAt: now + delay, version: 1 }), 'utf8'),
  );
  await rearmClaim(projectDirectory, claim, stateSnapshot);
}

async function removeRetrySchedule(projectDirectory: string, requestId: string): Promise<void> {
  await removeIfPresent(retrySchedulePath(projectDirectory, requestId));
}

function isReportedTerminalRelayReceipt(
  receipt: RelayReceipt,
): receipt is RelayReportedTerminalReceipt {
  return REPORTED_TERMINAL_RELAY_RECEIPT_STATES.has(
    receipt.state as RelayReportedTerminalReceipt['state'],
  );
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Claim, expiry, HTTP, and rearm are one filesystem state machine.
export async function deliverRelayRequests(
  projectDirectory: string,
  options: {
    credential: string;
    deadlineMs: number;
    fetch: typeof fetch;
    monotonicNow?: () => number;
    now: () => number;
    overallDeadlineMs?: number;
    relayUrl: string;
  },
): Promise<{
  accepted: number;
  deadLetterBacklog: number;
  deadLetteredThisRun: number;
  retryable: number;
  serverReportedTerminalReceipts?: RelayReportedTerminalReceipt[];
}> {
  const relayOrigin = normalizeRelayOrigin(options.relayUrl);
  if (relayOrigin === undefined) throw new Error('invalid relay URL');
  const monotonicNow = options.monotonicNow ?? (() => performance.now());
  const wallClockNow = options.now();
  const {
    active: initial,
    deadLetters: initialDeadLetters,
    directory,
  } = await recoveredRelayQueueSnapshot(projectDirectory, wallClockNow);
  const deliveryStateSnapshot = await captureRelayStateSnapshot(projectDirectory);
  // Recovery is durable maintenance, not a relay attempt. Start the bounded
  // network-drain budget only after the spool is consistent and claimable.
  const overallDeadline =
    monotonicNow() + (options.overallDeadlineMs ?? options.deadlineMs + RELAY_OVERALL_HEADROOM_MS);
  const processed = new Set<string>();
  let accepted = 0;
  let deadLetterBacklog = initialDeadLetters.length;
  let deadLetteredThisRun = 0;
  const serverReportedTerminalReceipts: RelayReportedTerminalReceipt[] = [];
  for (const request of orderedRelayCandidates(initial)) {
    if (monotonicNow() >= overallDeadline) break;
    if (processed.has(request.requestId)) continue;
    const retrySchedule = await retryScheduleFor(projectDirectory, request.requestId);
    if (retrySchedule !== undefined && retrySchedule.nextAttemptAt > options.now()) continue;
    const claim = await claimSpecificRelayRequest(projectDirectory, request.requestId, {
      claimId: randomUUID(),
      leaseMs: Math.max(options.deadlineMs * 2, 1000),
      now: options.now(),
      stateSnapshot: deliveryStateSnapshot,
    });
    if (claim === undefined) continue;
    processed.add(claim.requestId);
    const parsedRequest = parseDurableRequest(claim);
    if (parsedRequest?.requestId !== claim.requestId) {
      const deadLettered = Number(
        await deadLetterClaim(projectDirectory, claim, deliveryStateSnapshot),
      );
      deadLetteredThisRun += deadLettered;
      deadLetterBacklog += deadLettered;
      continue;
    }
    if (options.now() >= Date.parse(parsedRequest.retryDeadlineAt)) {
      const deadLettered = Number(
        await deadLetterClaim(projectDirectory, claim, deliveryStateSnapshot),
      );
      deadLetteredThisRun += deadLettered;
      deadLetterBacklog += deadLettered;
      continue;
    }
    const remainingOverallMs = overallDeadline - monotonicNow();
    if (remainingOverallMs <= RELAY_CLEANUP_RESERVE_MS) {
      await rearmClaim(projectDirectory, claim, deliveryStateSnapshot);
      break;
    }
    const attemptDeadlineMs = Math.min(
      options.deadlineMs,
      remainingOverallMs - RELAY_CLEANUP_RESERVE_MS,
    );
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, attemptDeadlineMs);
    timer.unref();
    try {
      let response: Response;
      try {
        response = await options.fetch(`${relayOrigin}/v1/retro-filings`, {
          body: relayRequestBytes(parsedRequest),
          headers: relaySubmissionHeaders(options.credential),
          method: 'POST',
          signal: controller.signal,
        });
      } catch (error) {
        throw new RetryableRelayDeliveryError('relay request failed', { cause: error });
      }
      if (!response.ok) {
        const body = await relayResponseBody(response);
        if (!retryableRelayStatus(response.status) && !isIncompatibleRelayVersion(response, body)) {
          const deadLettered = Number(
            await deadLetterClaim(projectDirectory, claim, deliveryStateSnapshot),
          );
          deadLetteredThisRun += deadLettered;
          deadLetterBacklog += deadLettered;
          continue;
        }
        throw new RetryableRelayDeliveryError('relay returned a retryable response');
      }
      const body = relayReceiptFromBody(await relayResponseBody(response), claim.requestId);
      if (body === undefined) {
        throw new RetryableRelayDeliveryError('relay returned an invalid durable receipt');
      }
      assertAcknowledgeableRelayReceipt(body, claim.requestId);
      if (await acknowledgeRelayClaim(claim, body)) {
        await removeRetrySchedule(projectDirectory, claim.requestId);
        accepted += 1;
        if (isReportedTerminalRelayReceipt(body)) serverReportedTerminalReceipts.push(body);
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        error instanceof TypeError ||
        error instanceof RetryableRelayDeliveryError
      ) {
        await deferRelayClaim(projectDirectory, claim, options.now(), deliveryStateSnapshot);
      } else {
        await rearmClaim(projectDirectory, claim, deliveryStateSnapshot);
        throw error;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const finalFilenames = await sortedFilenames(directory);
  const retryable = finalFilenames.filter(
    filename =>
      parsePrimary(filename) !== undefined ||
      parseMaterializing(filename) !== undefined ||
      parseClaim(filename) !== undefined,
  ).length;
  return {
    accepted,
    deadLetterBacklog,
    deadLetteredThisRun,
    retryable,
    ...(serverReportedTerminalReceipts.length > 0 && { serverReportedTerminalReceipts }),
  };
}
