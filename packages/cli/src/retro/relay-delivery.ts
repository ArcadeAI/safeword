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

function sourceReservationPath(projectDirectory: string, sourceKey: string): string {
  const key = createHash('sha256').update(sourceKey).digest('hex');
  return path.join(relayDirectory(projectDirectory), `source-${key}.json`);
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

export async function persistRelayRequest(
  projectDirectory: string,
  request: RelayDraftRequest,
): Promise<{ bytes: Buffer; path: string }> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.from(JSON.stringify(request), 'utf8');
  const deadLetter = deadLetterPath(projectDirectory, request.requestId);
  if (await exists(deadLetter)) {
    const existing = await readFile(deadLetter);
    if (!existing.equals(bytes)) {
      throw new Error('relay request identity was reused with a different payload');
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
    bytes = await readFile(sourceReservationPath(projectDirectory, draft.sourceKey));
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

async function resolveSourceReservation(
  projectDirectory: string,
  draft: RelayDraftInput,
  reservation: RelaySourceReservation,
): Promise<RelayDraftRequest | undefined> {
  validateSourceReservation(reservation, draft);
  if (reservation.state === 'acknowledged') return undefined;
  if (await exists(ackPath(projectDirectory, reservation.request.requestId))) {
    await compactSourceReservation(projectDirectory, reservation.request);
    return undefined;
  }
  await persistRelayRequest(projectDirectory, reservation.request);
  return reservation.request;
}

async function reserveSource(
  projectDirectory: string,
  draft: RelayDraftInput,
  reservation: RelaySourceReservation,
): Promise<RelayDraftRequest | undefined> {
  const file = sourceReservationPath(projectDirectory, draft.sourceKey);
  const written = await writeAtomic(file, Buffer.from(JSON.stringify(reservation), 'utf8'));
  if (written) return resolveSourceReservation(projectDirectory, draft, reservation);
  const winner = await loadSourceReservation(projectDirectory, draft);
  if (winner === undefined) throw new Error('relay source reservation disappeared');
  return resolveSourceReservation(projectDirectory, draft, winner);
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
  await replaceAtomic(
    sourceReservationPath(projectDirectory, request.sourceKey),
    Buffer.from(JSON.stringify(reservation), 'utf8'),
  );
}

async function findAcknowledgedSource(
  directory: string,
  draft: RelayDraftInput,
): Promise<{
  corrupt: boolean;
  receipt?: RelayReceipt & { sourceKey?: string; sourcePayloadHash?: string };
}> {
  const filenames = await sortedFilenames(directory);
  let corrupt = false;
  for (const filename of filenames) {
    if (!filename.endsWith('.ack.json')) continue;
    let acknowledged: RelayReceipt & { sourceKey?: string; sourcePayloadHash?: string };
    try {
      acknowledged = JSON.parse(
        await readFile(path.join(directory, filename), 'utf8'),
      ) as RelayReceipt & { sourceKey?: string; sourcePayloadHash?: string };
    } catch {
      // Corrupt acknowledgements remain visible and cannot authorize replacement.
      corrupt = true;
      continue;
    }
    if (acknowledged.sourceKey !== draft.sourceKey) continue;
    if (acknowledged.sourcePayloadHash !== relaySourcePayloadDigest(draft)) {
      throw new Error('relay source identity was reused with a different payload');
    }
    return { corrupt, receipt: acknowledged };
  }
  return { corrupt };
}

export async function persistRelayDraft(
  projectDirectory: string,
  draft: RelayDraftInput,
): Promise<RelayDraftRequest | undefined> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  const reserved = await loadSourceReservation(projectDirectory, draft);
  if (reserved !== undefined) {
    return resolveSourceReservation(projectDirectory, draft, reserved);
  }
  const [active, deadLetters] = await Promise.all([
    listRelayRequests(projectDirectory),
    listRelayDeadLetters(projectDirectory),
  ]);
  const durableRequests = [...active, ...deadLetters];
  let corrupt = false;
  for (const candidate of durableRequests) {
    const request = parseDurableRequest(candidate);
    if (request === undefined) {
      corrupt = true;
      continue;
    }
    if (request.sourceKey !== draft.sourceKey) continue;
    if (!sameRelayDraft(request, draft)) {
      throw new Error('relay source identity was reused with a different payload');
    }
    return reserveSource(projectDirectory, draft, {
      request,
      requestHash: relayRequestDigest(request),
      sourceKey: draft.sourceKey,
      sourcePayloadHash: relaySourcePayloadDigest(draft),
      state: 'active',
      version: 1,
    });
  }
  const acknowledged = await findAcknowledgedSource(directory, draft);
  if (acknowledged.receipt !== undefined) {
    return reserveSource(projectDirectory, draft, {
      requestId: acknowledged.receipt.requestId,
      sourceKey: draft.sourceKey,
      sourcePayloadHash: relaySourcePayloadDigest(draft),
      state: 'acknowledged',
      version: 1,
    });
  }
  if (corrupt || acknowledged.corrupt) {
    throw new Error('relay spool contains a corrupt durable identity record');
  }
  const request = createRelayRequest(draft);
  return reserveSource(projectDirectory, draft, {
    request,
    requestHash: relayRequestDigest(request),
    sourceKey: draft.sourceKey,
    sourcePayloadHash: relaySourcePayloadDigest(draft),
    state: 'active',
    version: 1,
  });
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
    const requestId = parsePrimary(filename);
    if (
      requestId === undefined ||
      options.excludeRequestIds?.has(requestId) === true ||
      (await exists(ackPath(projectDirectory, requestId)))
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
    try {
      await rename(path.join(directory, filename), primaryPath(projectDirectory, parsed.requestId));
    } catch (error) {
      if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
    }
  }
}

async function claimSpecificRelayRequest(
  projectDirectory: string,
  requestId: string,
  options: { claimId: string; leaseMs: number; now: number },
): Promise<RelayClaim | undefined> {
  if (await exists(ackPath(projectDirectory, requestId))) return undefined;
  const directory = relayDirectory(projectDirectory);
  const claimed = path.join(
    directory,
    `${requestId}.claim.${options.claimId}.${options.now + options.leaseMs}.json`,
  );
  try {
    await rename(primaryPath(projectDirectory, requestId), claimed);
    return { bytes: await readFile(claimed), path: claimed, requestId };
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
    return undefined;
  }
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
  options: { faultAfterAck?: () => Promise<void> } = {},
): Promise<boolean> {
  if (receipt.requestId !== claim.requestId || !(await exists(claim.path))) return false;
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
  await removeIfPresent(claim.path);
  return true;
}

export async function recoverRelaySpool(projectDirectory: string, _now: number): Promise<void> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  const filenames = await readdir(directory);
  const acknowledged = new Set(
    filenames
      .map(filename => /^([0-9a-f-]+)\.ack\.json$/u.exec(filename)?.[1])
      .filter((requestId): requestId is string => requestId !== undefined),
  );
  await Promise.all(
    filenames.map(async filename => {
      const requestId = parsePrimary(filename) ?? parseClaim(filename)?.requestId;
      if (requestId === undefined || !acknowledged.has(requestId)) return;
      const file = path.join(directory, filename);
      const { request } = acknowledgementSourceMetadata(await readFile(file));
      if (request !== undefined) await compactSourceReservation(projectDirectory, request);
      await removeIfPresent(file);
    }),
  );
}

export async function listRelayRequests(
  projectDirectory: string,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  await recoverRelaySpool(projectDirectory, Date.now());
  const directory = relayDirectory(projectDirectory);
  const requests: { bytes: Buffer; requestId: string }[] = [];
  const filenames = await sortedFilenames(directory);
  for (const filename of filenames) {
    const requestId = parsePrimary(filename) ?? parseClaim(filename)?.requestId;
    if (requestId === undefined) continue;
    requests.push({ bytes: await readFile(path.join(directory, filename)), requestId });
  }
  return requests;
}

export async function listRelayDeadLetters(
  projectDirectory: string,
): Promise<{ bytes: Buffer; requestId: string }[]> {
  const directory = relayDirectory(projectDirectory);
  await mkdir(directory, { recursive: true });
  const requests: { bytes: Buffer; requestId: string }[] = [];
  const filenames = await sortedFilenames(directory);
  for (const filename of filenames) {
    const requestId = parseDeadLetter(filename);
    if (requestId === undefined) continue;
    requests.push({ bytes: await readFile(path.join(directory, filename)), requestId });
  }
  return requests;
}

async function rearmClaim(projectDirectory: string, claim: RelayClaim): Promise<void> {
  if (await exists(ackPath(projectDirectory, claim.requestId))) return;
  try {
    await rename(claim.path, primaryPath(projectDirectory, claim.requestId));
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

async function deadLetterClaim(projectDirectory: string, claim: RelayClaim): Promise<void> {
  const deadLetter = deadLetterPath(projectDirectory, claim.requestId);
  try {
    await rename(claim.path, deadLetter);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(errorCode(error) ?? '')) throw error;
  }
}

export async function rearmRelayDeadLetter(
  projectDirectory: string,
  requestId: string,
): Promise<boolean> {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  const deadLetter = deadLetterPath(projectDirectory, requestId);
  const primary = primaryPath(projectDirectory, requestId);
  try {
    await link(deadLetter, primary);
    await unlink(deadLetter);
    return true;
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    if (errorCode(error) === 'EEXIST') {
      throw new Error('relay request is already active', { cause: error });
    }
    throw error;
  }
}

async function readDeadLetter(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
}

export async function recoverRelayDeadLetter(
  projectDirectory: string,
  requestId: string,
  options: { credential: string; fetch: typeof fetch; relayUrl: string; timeoutMs?: number },
): Promise<boolean> {
  if (!UUID_V4_PATTERN.test(requestId)) throw new Error('invalid relay request identity');
  const relayUrl = new URL(options.relayUrl);
  if (relayUrl.protocol !== 'https:' || options.credential.trim().length === 0) {
    throw new Error('invalid relay recovery configuration');
  }
  const deadLetter = deadLetterPath(projectDirectory, requestId);
  const bytes = await readDeadLetter(deadLetter);
  if (bytes === undefined) return false;
  const request = JSON.parse(bytes.toString('utf8')) as RelayDraftRequest;
  const response = await options.fetch(new URL('/v1/retro-filings', relayUrl), {
    body: relayRequestBytes(request),
    headers: {
      authorization: `Bearer ${options.credential}`,
      'content-type': 'application/json',
    },
    method: 'POST',
    signal: AbortSignal.timeout(options.timeoutMs ?? 750),
  });
  if (!response.ok) return false;
  const receipt = (await response.json()) as RelayReceipt;
  if (receipt.requestId !== requestId || typeof receipt.receiptId !== 'string') {
    throw new Error('relay returned an invalid durable receipt');
  }
  if (!['filed', 'rejected', 'tombstone'].includes(receipt.state)) return false;
  return acknowledgeRelayClaim({ bytes, path: deadLetter, requestId }, receipt);
}

function retryableRelayStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
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
  let retryable = 0;
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
      const response = await options.fetch(`${options.relayUrl}/v1/retro-filings`, {
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
      else retryable += 1;
    } catch {
      retryable += 1;
      await rearmClaim(projectDirectory, claim);
    } finally {
      clearTimeout(timer);
    }
  }
  return { accepted, deadLetterBacklog, deadLettered, retryable };
}
