import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  link,
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

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

type RelayDraftInput = Omit<RelayDraftRequest, 'createdAt' | 'requestId' | 'retryDeadlineAt'>;
type RelaySourcePayload = Omit<RelayDraftInput, 'sourceKey'>;

const UUID_V4_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;

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
      state: 'acknowledged';
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
  dependencies?: { now?: () => number; randomUUID: () => string },
): RelayDraftRequest {
  const createdAt = (dependencies?.now ?? Date.now)();
  return {
    requestId: (dependencies?.randomUUID ?? randomUUID)(),
    createdAt: new Date(createdAt).toISOString(),
    retryDeadlineAt: new Date(createdAt + 24 * 60 * 60 * 1000).toISOString(),
    ...input,
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

function primaryPath(projectDirectory: string, requestId: string): string {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  return path.join(relayDirectory(projectDirectory), `${requestId}.json`);
}

function ackPath(projectDirectory: string, requestId: string): string {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  return path.join(relayDirectory(projectDirectory), `${requestId}.ack.json`);
}

function deadLetterPath(projectDirectory: string, requestId: string): string {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  return path.join(relayDirectory(projectDirectory), `${requestId}.dead-letter.json`);
}

function materializingPath(projectDirectory: string, requestId: string): string {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  return path.join(relayDirectory(projectDirectory), `${requestId}.materializing.json`);
}

function discardedPath(projectDirectory: string, requestId: string): string {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  return path.join(relayDirectory(projectDirectory), `${requestId}.discarded.json`);
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

function sourceReservationPath(projectDirectory: string, sourceKey: string): string {
  const key = createHash('sha256').update(sourceKey).digest('hex');
  return path.join(relayDirectory(projectDirectory), `source-${key}.json`);
}

function sourceAcknowledgementPath(projectDirectory: string, sourceKey: string): string {
  const key = createHash('sha256').update(sourceKey).digest('hex');
  return path.join(relayDirectory(projectDirectory), `source-${key}.acknowledged.json`);
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
  try {
    await unlink(file);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
}

async function sortedFilenames(directory: string): Promise<string[]> {
  const filenames = await readdir(directory);
  return filenames.toSorted((left, right) => left.localeCompare(right));
}

async function writeAtomic(file: string, bytes: Buffer): Promise<boolean> {
  const temporary = `${file}.tmp.${randomUUID()}`;
  await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
  try {
    await link(temporary, file);
    return true;
  } catch (error) {
    if (errorCode(error) !== 'EEXIST') throw error;
    return false;
  } finally {
    await removeIfPresent(temporary);
  }
}

async function replaceAtomic(file: string, bytes: Buffer): Promise<void> {
  const temporary = `${file}.tmp.${randomUUID()}`;
  await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
  try {
    await rename(temporary, file);
  } finally {
    await removeIfPresent(temporary);
  }
}

function parseClaim(
  filename: string,
): { claimId: string; expiresAt: number; requestId: string } | undefined {
  const match =
    /^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.claim\.([\w-]+)\.(\d+)\.json$/u.exec(
      filename,
    );
  if (match === null) return undefined;
  const [, requestId, claimId, expiresAt] = match;
  if (requestId === undefined || claimId === undefined || expiresAt === undefined) {
    return undefined;
  }
  return { claimId, expiresAt: Number(expiresAt), requestId };
}

function parsePrimary(filename: string): string | undefined {
  return /^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.json$/u.exec(
    filename,
  )?.[1];
}

function parseDeadLetter(filename: string): string | undefined {
  return /^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.dead-letter\.json$/u.exec(
    filename,
  )?.[1];
}

function parseMaterializing(filename: string): string | undefined {
  return /^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.materializing\.json$/u.exec(
    filename,
  )?.[1];
}

function parseDiscarded(filename: string): string | undefined {
  return /^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.discarded\.json$/u.exec(
    filename,
  )?.[1];
}

function parseDiscardIntent(filename: string): { requestId: string; token: string } | undefined {
  const match =
    /^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.discarding\.([\da-f-]+)\.json$/u.exec(
      filename,
    );
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

async function discardBlocksRequest(projectDirectory: string, requestId: string): Promise<boolean> {
  return (
    (await exists(discardedPath(projectDirectory, requestId))) ||
    (await hasDiscardIntent(projectDirectory, requestId))
  );
}

function parseRecoveryClaim(
  filename: string,
): { claimId: string; expiresAt: number; requestId: string } | undefined {
  const match =
    /^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.recovery-claim\.([\w-]+)\.(\d+)\.json$/u.exec(
      filename,
    );
  if (match === null) return undefined;
  const [, requestId, claimId, expiresAt] = match;
  if (requestId === undefined || claimId === undefined || expiresAt === undefined) {
    return undefined;
  }
  return { claimId, expiresAt: Number(expiresAt), requestId };
}

export async function persistRelayRequest(
  projectDirectory: string,
  request: RelayDraftRequest,
  options: { faultAfterDiscardCheck?: () => Promise<void> } = {},
): Promise<{ bytes: Buffer; path: string }> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  if (await discardBlocksRequest(projectDirectory, request.requestId)) {
    throw new Error('relay request identity was discarded');
  }
  await options.faultAfterDiscardCheck?.();
  const bytes = Buffer.from(JSON.stringify(request), 'utf8');
  const deadLetter = deadLetterPath(projectDirectory, request.requestId);
  if (await exists(deadLetter)) {
    const existing = await readFile(deadLetter);
    if (!existing.equals(bytes)) {
      throw new Error('relay request identity was reused with a different payload');
    }
    if (await discardBlocksRequest(projectDirectory, request.requestId)) {
      await removeIfPresent(deadLetter);
      throw new Error('relay request identity was discarded');
    }
    return { bytes, path: deadLetter };
  }
  const file = primaryPath(projectDirectory, request.requestId);
  if (!(await writeAtomic(file, bytes))) {
    const existing = await readFile(file);
    if (!existing.equals(bytes)) {
      throw new Error('relay request identity was reused with a different payload');
    }
  }
  if (await discardBlocksRequest(projectDirectory, request.requestId)) {
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
    return JSON.parse(candidate.bytes.toString('utf8')) as RelayDraftRequest;
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
  if (candidate.state === 'acknowledged') {
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
      bytes = await readFile(sourceReservationPath(projectDirectory, draft.sourceKey));
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

async function reconcileRenewedDeadLetter(
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
    throw new Error('relay request identity was reused with a different payload');
  }
  if (!activeSourceRequestShape(renewed)) {
    throw new Error('relay request identity was reused with a different payload');
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
  | { kind: 'dead-letter' | 'delivery' | 'materializing' | 'missing' | 'primary' }
  | { kind: 'recovery'; path: string };

function reservedRequestState(
  directory: string,
  filenames: string[],
  requestId: string,
): ReservedRequestState {
  const recoveryClaim = filenames.find(
    filename => parseRecoveryClaim(filename)?.requestId === requestId,
  );
  if (recoveryClaim !== undefined) {
    return { kind: 'recovery', path: path.join(directory, recoveryClaim) };
  }
  if (filenames.some(filename => parseClaim(filename)?.requestId === requestId)) {
    return { kind: 'delivery' };
  }
  if (filenames.includes(`${requestId}.materializing.json`)) return { kind: 'materializing' };
  if (filenames.includes(`${requestId}.dead-letter.json`)) return { kind: 'dead-letter' };
  if (filenames.includes(`${requestId}.json`)) return { kind: 'primary' };
  return { kind: 'missing' };
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

async function resolveExistingReservedState(
  projectDirectory: string,
  reservation: Extract<RelaySourceReservation, { state: 'active' }>,
  state: Exclude<ReservedRequestState, { kind: 'missing' }>,
): Promise<RelayDraftRequest> {
  if (state.kind === 'recovery') {
    return (
      (await reconcileRenewedDeadLetter(projectDirectory, reservation, state.path, false)) ??
      reservation.request
    );
  }
  if (state.kind === 'dead-letter') {
    return (await reconcileRenewedDeadLetter(projectDirectory, reservation)) ?? reservation.request;
  }
  if (state.kind === 'primary' || state.kind === 'materializing') {
    await validateReservedPrimary(
      projectDirectory,
      reservation.request,
      state.kind === 'primary'
        ? primaryPath(projectDirectory, reservation.request.requestId)
        : materializingPath(projectDirectory, reservation.request.requestId),
    );
  }
  return reservation.request;
}

async function materializeReservedRequest(
  projectDirectory: string,
  directory: string,
  draft: RelayDraftInput,
  reservation: Extract<RelaySourceReservation, { state: 'active' }>,
): Promise<RelayDraftRequest | undefined> {
  const requestId = reservation.request.requestId;
  if (await discardBlocksRequest(projectDirectory, requestId)) return undefined;
  const currentReservation = await loadSourceReservation(projectDirectory, draft);
  if (currentReservation?.state !== 'active') return undefined;
  const currentState = reservedRequestState(directory, await sortedFilenames(directory), requestId);
  if (currentState.kind !== 'missing') {
    return resolveExistingReservedState(projectDirectory, currentReservation, currentState);
  }
  const materializing = materializingPath(projectDirectory, requestId);
  const bytes = Buffer.from(JSON.stringify(currentReservation.request), 'utf8');
  if (!(await writeAtomic(materializing, bytes))) {
    await validateReservedPrimary(projectDirectory, currentReservation.request, materializing);
  }
  if (!(await discardBlocksRequest(projectDirectory, requestId))) {
    return currentReservation.request;
  }
  await removeIfPresent(materializing);
  return undefined;
}

async function resolveSourceReservation(
  projectDirectory: string,
  draft: RelayDraftInput,
  reservation: RelaySourceReservation,
  options: { faultAfterStateSnapshot?: () => Promise<void> } = {},
): Promise<RelayDraftRequest | undefined> {
  validateSourceReservation(reservation, draft);
  if (reservation.state === 'acknowledged') return undefined;
  if (await discardBlocksRequest(projectDirectory, reservation.request.requestId)) {
    return undefined;
  }
  if (await compactIfAcknowledged(projectDirectory, reservation.request)) return undefined;
  const directory = relayDirectory(projectDirectory);
  const filenames = await sortedFilenames(directory);
  await options.faultAfterStateSnapshot?.();
  const requestId = reservation.request.requestId;
  const state = reservedRequestState(directory, filenames, requestId);
  if (state.kind !== 'missing') {
    return resolveExistingReservedState(projectDirectory, reservation, state);
  }
  if (await compactIfAcknowledged(projectDirectory, reservation.request)) return undefined;
  return materializeReservedRequest(projectDirectory, directory, draft, reservation);
}

async function reserveSource(
  projectDirectory: string,
  draft: RelayDraftInput,
  reservation: RelaySourceReservation,
  options: { faultAfterStateSnapshot?: () => Promise<void> } = {},
): Promise<RelayDraftRequest | undefined> {
  const file = sourceReservationPath(projectDirectory, draft.sourceKey);
  const written = await writeAtomic(file, Buffer.from(JSON.stringify(reservation), 'utf8'));
  if (written) return resolveSourceReservation(projectDirectory, draft, reservation, options);
  const winner = await loadSourceReservation(projectDirectory, draft);
  if (winner === undefined) throw new Error('relay source reservation disappeared');
  return resolveSourceReservation(projectDirectory, draft, winner, options);
}

async function compactSourceReservation(
  projectDirectory: string,
  request: RelayDraftRequest,
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
      throw new Error('relay acknowledgement conflicts with the durable source tombstone');
    }
  }
  await replaceAtomic(sourceReservationPath(projectDirectory, request.sourceKey), bytes);
}

async function reservedRequestIds(directory: string): Promise<Set<string>> {
  const filenames = await sortedFilenames(directory);
  const requestIds = new Set<string>();
  for (const filename of filenames) {
    if (!filename.startsWith('source-') || !filename.endsWith('.json')) continue;
    try {
      const reservation = JSON.parse(
        await readFile(path.join(directory, filename), 'utf8'),
      ) as unknown;
      if (!sourceReservationShape(reservation) || reservation.state !== 'active') continue;
      requestIds.add(reservation.request.requestId);
    } catch {
      // The filename hashes source identity, so a corrupt reservation for one
      // source cannot authorize or block a different source.
    }
  }
  return requestIds;
}

export async function persistRelayDraft(
  projectDirectory: string,
  draft: RelayDraftInput,
  options: { faultAfterStateSnapshot?: () => Promise<void> } = {},
): Promise<RelayDraftRequest | undefined> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  await recoverRelaySpool(projectDirectory, Date.now());
  const reserved = await loadSourceReservation(projectDirectory, draft);
  if (reserved !== undefined) {
    return resolveSourceReservation(projectDirectory, draft, reserved, options);
  }
  const [active, deadLetters] = await Promise.all([
    listRelayRequests(projectDirectory),
    listRelayDeadLetters(projectDirectory),
  ]);
  const durableRequests = [...active, ...deadLetters];
  let reservedIds: Set<string> | undefined;
  for (const candidate of durableRequests) {
    const request = parseDurableRequest(candidate);
    if (request === undefined) {
      reservedIds ??= await reservedRequestIds(directory);
      if (!reservedIds.has(candidate.requestId)) {
        throw new Error('relay spool contains an unreserved corrupt durable identity record');
      }
      continue;
    }
    if (request.sourceKey !== draft.sourceKey) continue;
    if (!sameRelayDraft(request, draft)) {
      throw new Error('relay source identity was reused with a different payload');
    }
    return reserveSource(
      projectDirectory,
      draft,
      {
        request,
        requestHash: relayRequestDigest(request),
        sourceKey: draft.sourceKey,
        sourcePayloadHash: relaySourcePayloadDigest(draft),
        state: 'active',
        version: 1,
      },
      options,
    );
  }
  const request = createRelayRequest(draft);
  return reserveSource(
    projectDirectory,
    draft,
    {
      request,
      requestHash: relayRequestDigest(request),
      sourceKey: draft.sourceKey,
      sourcePayloadHash: relaySourcePayloadDigest(draft),
      state: 'active',
      version: 1,
    },
    options,
  );
}

export async function claimRelayRequest(
  projectDirectory: string,
  options: { claimId: string; excludeRequestIds?: Set<string>; leaseMs: number; now: number },
): Promise<RelayClaim | undefined> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  let filenames = await sortedFilenames(directory);

  await recoverExpiredClaims(projectDirectory, filenames, options.now, options.excludeRequestIds);
  filenames = await sortedFilenames(directory);
  for (const filename of filenames) {
    const requestId = parsePrimary(filename) ?? parseMaterializing(filename);
    if (
      requestId === undefined ||
      options.excludeRequestIds?.has(requestId) === true ||
      (await exists(ackPath(projectDirectory, requestId))) ||
      (await discardBlocksRequest(projectDirectory, requestId))
    ) {
      continue;
    }
    const claim = await claimSpecificRelayRequest(projectDirectory, requestId, {
      claimId: options.claimId,
      leaseMs: options.leaseMs,
      now: options.now,
    });
    if (claim !== undefined) return claim;
  }
  return undefined;
}

async function recoverExpiredClaims(
  projectDirectory: string,
  filenames: string[],
  now: number,
  excludeRequestIds?: Set<string>,
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
    await recoverExpiredClaim(projectDirectory, path.join(directory, filename), parsed.requestId);
  }
}

async function recoverExpiredClaim(
  projectDirectory: string,
  claimPath: string,
  requestId: string,
): Promise<void> {
  if (await exists(discardedPath(projectDirectory, requestId))) {
    await removeIfPresent(claimPath);
    return;
  }
  if (await hasDiscardIntent(projectDirectory, requestId)) return;
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
    const [claimBytes, siblingBytes] = await Promise.all([readFile(claimPath), readFile(sibling)]);
    if (claimBytes.equals(siblingBytes)) await removeIfPresent(claimPath);
    return;
  }
  try {
    await link(claimPath, primaryPath(projectDirectory, requestId));
    await unlink(claimPath);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

async function claimSpecificRelayRequest(
  projectDirectory: string,
  requestId: string,
  options: { claimId: string; leaseMs: number; now: number },
): Promise<RelayClaim | undefined> {
  if (
    (await exists(ackPath(projectDirectory, requestId))) ||
    (await discardBlocksRequest(projectDirectory, requestId))
  ) {
    return undefined;
  }
  const directory = relayDirectory(projectDirectory);
  const claimed = path.join(
    directory,
    `${requestId}.claim.${options.claimId}.${options.now + options.leaseMs}.json`,
  );
  for (const candidate of [
    primaryPath(projectDirectory, requestId),
    materializingPath(projectDirectory, requestId),
  ]) {
    try {
      await rename(candidate, claimed);
      if (await discardBlocksRequest(projectDirectory, requestId)) {
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
  request?: RelayDraftRequest;
  sourceKey?: string;
  sourcePayloadHash?: string;
} {
  try {
    const request = JSON.parse(bytes.toString('utf8')) as RelayDraftRequest;
    return {
      request,
      sourceKey: request.sourceKey,
      sourcePayloadHash: relaySourcePayloadDigest(request),
    };
  } catch {
    // A valid relay receipt can still durably acknowledge legacy request bytes.
    return {};
  }
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

export async function acknowledgeRelayClaim(
  claim: RelayClaim,
  receipt: RelayReceipt,
  options: {
    faultAfterAck?: () => Promise<void>;
    faultAfterOwnershipCheck?: () => Promise<void>;
  } = {},
): Promise<boolean> {
  if (receipt.requestId !== claim.requestId || !(await exists(claim.path))) return false;
  await options.faultAfterOwnershipCheck?.();
  const projectDirectory = path.resolve(path.dirname(claim.path), '..', '..', '..');
  const durableAck = ackPath(projectDirectory, claim.requestId);
  const { request, sourceKey, sourcePayloadHash } = acknowledgementSourceMetadata(claim.bytes);
  const written = await writeAtomic(
    durableAck,
    Buffer.from(
      JSON.stringify({
        ...receipt,
        ...(sourceKey !== undefined && { sourceKey }),
        ...(sourcePayloadHash !== undefined && { sourcePayloadHash }),
      }),
      'utf8',
    ),
  );
  if (!written) await assertCompatibleAcknowledgement(durableAck, receipt);
  if (request !== undefined) await compactSourceReservation(projectDirectory, request);
  await options.faultAfterAck?.();
  await removeIfPresent(discardedPath(projectDirectory, claim.requestId));
  await cancelDiscardIntents(projectDirectory, claim.requestId);
  await removeIfPresent(claim.path);
  await removeIfPresent(durableAck);
  return true;
}

export async function recoverRelaySpool(projectDirectory: string, _now: number): Promise<void> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  let filenames = await readdir(directory);
  await recoverDiscardIntents(projectDirectory, filenames);
  filenames = await readdir(directory);
  await recoverExpiredClaims(projectDirectory, filenames, _now);
  filenames = await readdir(directory);
  await recoverExpiredRecoveryClaims(projectDirectory, filenames, _now);
  filenames = await readdir(directory);
  await recoverDiscardedRequests(projectDirectory, filenames);
  filenames = await readdir(directory);
  const acknowledged = new Set(
    filenames
      .map(filename => /^([0-9a-f-]+)\.ack\.json$/u.exec(filename)?.[1])
      .filter((requestId): requestId is string => requestId !== undefined),
  );
  await Promise.all(
    filenames.map(filename =>
      cleanupAcknowledgedFile(projectDirectory, directory, filename, acknowledged),
    ),
  );
}

async function cleanupAcknowledgedFile(
  projectDirectory: string,
  directory: string,
  filename: string,
  acknowledged: Set<string>,
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
  const { request } = acknowledgementSourceMetadata(bytes);
  if (request !== undefined) await compactSourceReservation(projectDirectory, request);
  await removeIfPresent(file);
  await removeIfPresent(ackPath(projectDirectory, requestId));
}

async function recoverDiscardIntents(projectDirectory: string, filenames: string[]): Promise<void> {
  for (const filename of filenames) {
    const parsed = parseDiscardIntent(filename);
    if (parsed === undefined) continue;
    const intent = await loadDiscardIntent(projectDirectory, filename);
    if (intent === undefined) continue;
    if (await exists(ackPath(projectDirectory, parsed.requestId))) {
      await cancelDiscardIntent(intent);
      continue;
    }
    const current = await sortedFilenames(relayDirectory(projectDirectory));
    const foreignClaim = current.some(candidate => {
      const claim = parseClaim(candidate) ?? parseRecoveryClaim(candidate);
      return claim?.requestId === parsed.requestId && claim.claimId !== intent.claimId;
    });
    if (foreignClaim) {
      await cancelDiscardIntent(intent);
      continue;
    }
    await commitDiscardIntent(projectDirectory, intent);
  }
}

async function recoverDiscardedRequests(
  projectDirectory: string,
  filenames: string[],
): Promise<void> {
  const directory = relayDirectory(projectDirectory);
  for (const filename of filenames) {
    const requestId = parseDiscarded(filename);
    if (requestId === undefined) continue;
    if (await exists(ackPath(projectDirectory, requestId))) {
      await removeIfPresent(path.join(directory, filename));
      continue;
    }
    const current = await sortedFilenames(directory);
    const reservationFiles = await reservationFilesForRequest(directory, current, requestId);
    const durableFiles = current.filter(candidate => {
      const claim = parseClaim(candidate) ?? parseRecoveryClaim(candidate);
      return (
        parsePrimary(candidate) === requestId ||
        parseMaterializing(candidate) === requestId ||
        parseDeadLetter(candidate) === requestId ||
        claim?.requestId === requestId
      );
    });
    await Promise.all(
      [...durableFiles, ...reservationFiles].map(candidate =>
        removeIfPresent(path.join(directory, candidate)),
      ),
    );
  }
}

async function reservationFilesForRequest(
  directory: string,
  filenames: string[],
  requestId: string,
): Promise<string[]> {
  const matching: string[] = [];
  for (const filename of filenames) {
    if (!filename.startsWith('source-') || !filename.endsWith('.json')) continue;
    try {
      const reservation = JSON.parse(
        await readFile(path.join(directory, filename), 'utf8'),
      ) as unknown;
      if (
        sourceReservationShape(reservation) &&
        reservation.state === 'active' &&
        reservation.request.requestId === requestId
      ) {
        matching.push(filename);
      }
    } catch {
      // A corrupt reservation cannot be attributed to this request identity.
    }
  }
  return matching;
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
  const record = JSON.stringify({
    claimId,
    requestId,
    startedAt: new Date().toISOString(),
    token,
    version: 1,
  });
  if (!(await writeAtomic(tokenPath, Buffer.from(record, 'utf8')))) {
    throw new Error('relay discard intent token collided');
  }
  return { claimId, requestId, tokenPath };
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
      requestId?: unknown;
      token?: unknown;
    };
    if (
      record.requestId !== parsed.requestId ||
      typeof record.claimId !== 'string' ||
      record.token !== parsed.token
    ) {
      return undefined;
    }
    return {
      claimId: record.claimId,
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
  await Promise.all(
    filenames.map(async filename => {
      if (parseDiscardIntent(filename)?.requestId !== requestId) return;
      await removeIfPresent(path.join(directory, filename));
    }),
  );
}

async function commitDiscardIntent(
  projectDirectory: string,
  intent: DiscardIntent,
): Promise<boolean> {
  try {
    await link(intent.tokenPath, discardedPath(projectDirectory, intent.requestId));
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    if (errorCode(error) !== 'EEXIST') throw error;
    const existing = JSON.parse(
      await readFile(discardedPath(projectDirectory, intent.requestId), 'utf8'),
    ) as { requestId?: unknown };
    if (existing.requestId !== intent.requestId) {
      throw new Error('relay discard tombstone conflicts with the request identity', {
        cause: error,
      });
    }
  }
  await cancelDiscardIntent(intent);
  return true;
}

async function removeRelayFiles(directory: string, filenames: string[]): Promise<void> {
  for (const filename of filenames) await removeIfPresent(path.join(directory, filename));
}

async function discardOwnedRelayRequest(
  projectDirectory: string,
  requestId: string,
  options: {
    faultAfterClaims?: () => Promise<void>;
    faultAfterConflictCheck?: () => Promise<void>;
    faultAfterTombstone?: () => Promise<void>;
  } = {},
): Promise<boolean> {
  const directory = relayDirectory(projectDirectory);
  const discardClaimId = `discard-${randomUUID()}`;
  const discardClaim = await claimSpecificRelayRequest(projectDirectory, requestId, {
    claimId: discardClaimId,
    leaseMs: 60_000,
    now: Date.now(),
  });
  const discardRecoveryClaim = await claimRelayDeadLetter(
    projectDirectory,
    requestId,
    discardClaimId,
  );
  const ownership = { delivery: discardClaim, recovery: discardRecoveryClaim };
  const intent = await createDiscardIntent(projectDirectory, requestId, discardClaimId);
  await options.faultAfterClaims?.();
  const filenames = await sortedFilenames(directory);
  if (discardHasConflict(filenames, requestId, discardClaimId)) {
    await cancelDiscardIntent(intent);
    await releaseDiscardOwnership(projectDirectory, ownership, true);
    throw new Error('relay request is actively claimed; retry discard after delivery completes');
  }
  await options.faultAfterConflictCheck?.();
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
  await options.faultAfterTombstone?.();
  await removeRelayFiles(directory, [...durableFiles, ...reservationFiles]);
  return true;
}

export async function discardRelayRequest(
  projectDirectory: string,
  requestId: string,
  options: {
    faultAfterClaims?: () => Promise<void>;
    faultAfterConflictCheck?: () => Promise<void>;
    faultAfterTombstone?: () => Promise<void>;
  } = {},
): Promise<boolean> {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  await mkdir(relayDirectory(projectDirectory), { recursive: true });
  await recoverRelaySpool(projectDirectory, Date.now());
  if (await exists(discardedPath(projectDirectory, requestId))) return false;
  return discardOwnedRelayRequest(projectDirectory, requestId, options);
}

export async function listRelayRequests(
  projectDirectory: string,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  await recoverRelaySpool(projectDirectory, Date.now());
  const directory = relayDirectory(projectDirectory);
  const requests: { bytes: Buffer; requestId: string }[] = [];
  const filenames = await sortedFilenames(directory);
  for (const filename of filenames) {
    const requestId =
      parsePrimary(filename) ?? parseMaterializing(filename) ?? parseClaim(filename)?.requestId;
    if (requestId === undefined) continue;
    try {
      requests.push({ bytes: await readFile(path.join(directory, filename)), requestId });
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
  }
  return requests;
}

export async function listRelayDeadLetters(
  projectDirectory: string,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  await recoverRelaySpool(projectDirectory, Date.now());
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  const requests: { bytes: Buffer; requestId: string }[] = [];
  const filenames = await sortedFilenames(directory);
  for (const filename of filenames) {
    const requestId = parseDeadLetter(filename);
    if (requestId === undefined) continue;
    try {
      requests.push({ bytes: await readFile(path.join(directory, filename)), requestId });
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
  }
  return requests;
}

async function rearmClaim(projectDirectory: string, claim: RelayClaim): Promise<void> {
  if (await hasDiscardIntent(projectDirectory, claim.requestId)) return;
  if (
    (await exists(ackPath(projectDirectory, claim.requestId))) ||
    (await exists(discardedPath(projectDirectory, claim.requestId)))
  ) {
    await removeIfPresent(claim.path);
    return;
  }
  try {
    await link(claim.path, primaryPath(projectDirectory, claim.requestId));
    await unlink(claim.path);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

async function deadLetterClaim(projectDirectory: string, claim: RelayClaim): Promise<void> {
  if (await hasDiscardIntent(projectDirectory, claim.requestId)) return;
  if (await exists(discardedPath(projectDirectory, claim.requestId))) {
    await removeIfPresent(claim.path);
    return;
  }
  const deadLetter = deadLetterPath(projectDirectory, claim.requestId);
  try {
    await link(claim.path, deadLetter);
    await unlink(claim.path);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

async function claimRelayDeadLetter(
  projectDirectory: string,
  requestId: string,
  claimId: string,
  now = Date.now(),
): Promise<RelayClaim | undefined> {
  if (await discardBlocksRequest(projectDirectory, requestId)) return undefined;
  const claimed = path.join(
    relayDirectory(projectDirectory),
    `${requestId}.recovery-claim.${claimId}.${now + 60_000}.json`,
  );
  try {
    await rename(deadLetterPath(projectDirectory, requestId), claimed);
    if (await discardBlocksRequest(projectDirectory, requestId)) {
      await removeIfPresent(claimed);
      return undefined;
    }
    return { bytes: await readFile(claimed), path: claimed, requestId };
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
    return undefined;
  }
}

async function releaseRecoveryClaim(projectDirectory: string, claim: RelayClaim): Promise<void> {
  if (await hasDiscardIntent(projectDirectory, claim.requestId)) return;
  if (await exists(discardedPath(projectDirectory, claim.requestId))) {
    await removeIfPresent(claim.path);
    return;
  }
  try {
    await link(claim.path, deadLetterPath(projectDirectory, claim.requestId));
    await unlink(claim.path);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

async function recoverExpiredRecoveryClaims(
  projectDirectory: string,
  filenames: string[],
  now: number,
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
    if (await hasDiscardIntent(projectDirectory, parsed.requestId)) continue;
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
      const [claimBytes, activeBytes] = await Promise.all([
        readFile(claimPath),
        readFile(activeSibling),
      ]);
      if (claimBytes.equals(activeBytes)) await removeIfPresent(claimPath);
      continue;
    }
    await releaseRecoveryClaim(projectDirectory, {
      bytes: Buffer.alloc(0),
      path: claimPath,
      requestId: parsed.requestId,
    });
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
    await link(claim.path, primary);
    await unlink(claim.path);
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

function submitRelayRecovery(
  relayOrigin: string,
  request: RelayDraftRequest,
  options: RelayRecoveryOptions,
): Promise<Response> {
  return options.fetch(`${relayOrigin}/v1/retro-filings`, {
    body: relayRequestBytes(request),
    headers: {
      authorization: `Bearer ${options.credential}`,
      'content-type': 'application/json',
    },
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
    typeof body.state !== 'string'
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
    retryDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  await replaceAtomic(deadLetter, Buffer.from(JSON.stringify(renewed), 'utf8'));
  const attempt = await submitRelayRecoveryAttempt(relayOrigin, renewed, options);
  if (attempt.response.status >= 400 && attempt.response.status < 500) {
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
      headers: { authorization: `Bearer ${options.operatorCredential}` },
      method: 'POST',
      signal: AbortSignal.timeout(options.timeoutMs ?? 750),
    },
  );
  if (!response.ok) return false;
  const recovered = (await response.json()) as RelayReceipt;
  if (
    recovered.requestId !== request.requestId ||
    recovered.receiptId !== receipt.receiptId ||
    !['filed', 'tombstone'].includes(recovered.state)
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
    const original = JSON.parse(claim.bytes.toString('utf8')) as RelayDraftRequest;
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
  deadLettered: number;
  retryable: number;
}> {
  const monotonicNow = options.monotonicNow ?? (() => performance.now());
  const overallDeadline = monotonicNow() + (options.overallDeadlineMs ?? options.deadlineMs * 2);
  const initial = await listRelayRequests(projectDirectory);
  const wallClockNow = options.now();
  await recoverExpiredClaims(
    projectDirectory,
    await sortedFilenames(relayDirectory(projectDirectory)),
    wallClockNow,
  );
  const processed = new Set<string>();
  let accepted = 0;
  const initialDeadLetters = await listRelayDeadLetters(projectDirectory);
  let deadLetterBacklog = initialDeadLetters.length;
  let deadLettered = 0;
  for (const request of initial) {
    if (monotonicNow() >= overallDeadline) break;
    if (processed.has(request.requestId)) continue;
    const claim = await claimSpecificRelayRequest(projectDirectory, request.requestId, {
      claimId: randomUUID(),
      leaseMs: Math.max(options.deadlineMs * 2, 1000),
      now: options.now(),
    });
    if (claim === undefined) continue;
    processed.add(claim.requestId);
    let parsedRequest: RelayDraftRequest;
    try {
      parsedRequest = JSON.parse(claim.bytes.toString('utf8')) as RelayDraftRequest;
    } catch {
      await deadLetterClaim(projectDirectory, claim);
      deadLettered += 1;
      deadLetterBacklog += 1;
      continue;
    }
    if (options.now() >= Date.parse(parsedRequest.retryDeadlineAt)) {
      await deadLetterClaim(projectDirectory, claim);
      deadLettered += 1;
      deadLetterBacklog += 1;
      continue;
    }
    const remainingOverallMs = overallDeadline - monotonicNow();
    if (remainingOverallMs < options.deadlineMs) {
      await rearmClaim(projectDirectory, claim);
      break;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, options.deadlineMs);
    timer.unref();
    try {
      const relayOrigin = normalizeRelayOrigin(options.relayUrl);
      if (relayOrigin === undefined) throw new Error('invalid relay URL');
      const response = await options.fetch(`${relayOrigin}/v1/retro-filings`, {
        body: relayRequestBytes(parsedRequest),
        headers: {
          authorization: `Bearer ${options.credential}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok) {
        if (!retryableRelayStatus(response.status)) {
          await deadLetterClaim(projectDirectory, claim);
          deadLettered += 1;
          deadLetterBacklog += 1;
          continue;
        }
        throw new Error('relay returned a retryable response');
      }
      const body = (await response.json()) as RelayReceipt;
      if (body.requestId !== claim.requestId || typeof body.receiptId !== 'string') {
        throw new Error('relay returned an invalid durable receipt');
      }
      if (await acknowledgeRelayClaim(claim, body)) accepted += 1;
    } catch {
      await rearmClaim(projectDirectory, claim);
    } finally {
      clearTimeout(timer);
    }
  }
  const retryableRequests = await listRelayRequests(projectDirectory);
  return { accepted, deadLetterBacklog, deadLettered, retryable: retryableRequests.length };
}
