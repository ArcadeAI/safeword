import { createHash } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { assemblePublicFinding, type Finding } from './finding.js';

export interface PublicRetroSource {
  harness: 'claude-code' | 'codex' | 'cursor';
  hostClass: 'local' | 'unknown';
  projectUUID: string;
  safewordCliVersion: string;
  repository?: string;
  agentVersion?: string;
  model?: string;
  safewordPluginVersion?: string;
  osFamily?: string;
}

export interface PublicRetroEnvelopeInput {
  findings: readonly string[];
  source: PublicRetroSource;
  sessionId: string;
  windowStart?: number;
}

export interface BuiltPublicRetroEnvelope {
  bytes: Uint8Array;
  sessionScope: string;
}

export interface PreparedPublicRetroRequest extends BuiltPublicRetroEnvelope {
  markerPath?: string;
  requestId: string;
}

export interface PublicRetroHttpRequest {
  method: 'POST';
  path: '/v1/public-retros';
  headers: {
    'content-type': 'application/json; charset=utf-8';
    'x-safeword-request-id': string;
  };
  body: Uint8Array;
  redirect: 'error';
}

export interface PublicRetroReceipt {
  requestId: string;
  receipt: string;
}

export type PublicRetroTransport = (
  request: PublicRetroHttpRequest,
  signal?: AbortSignal,
) => Promise<PublicRetroReceipt>;

export class PublicRetroRejection extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Public retrospective submission failed (${status})`);
  }
}

export interface PublicRetroPreparationDependencies {
  attemptsDirectory: string;
  randomUUID: () => string;
  route?: 'direct-v2' | 'server-v3';
  syncDirectory?: (directory: string) => void;
}

export interface PublicRetroDeliveryDependencies extends PublicRetroPreparationDependencies {
  now: () => number;
  transport: PublicRetroTransport;
}

export type PublicRetroDeliveryOutcome = 'preserved' | 'abandoned';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LEGACY_MAX_ENVELOPE_BYTES = 65_536;
const SERVER_MAX_ENVELOPE_BYTES = 262_144;
const MAX_OPTIONAL_VALUE_BYTES = 256;

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

export function normalizePublicRetroOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (
    normalized === undefined ||
    normalized === '' ||
    containsControlCharacter(normalized) ||
    Buffer.byteLength(normalized, 'utf8') > MAX_OPTIONAL_VALUE_BYTES
  ) {
    return undefined;
  }
  return normalized;
}

function validSourceRoute(source: PublicRetroSource): boolean {
  return source.hostClass === 'local' || source.hostClass === 'unknown';
}

function isValidEnvelopeInput(
  input: PublicRetroEnvelopeInput,
  projectUUID: string,
  version: 'v2' | 'v3',
): boolean {
  const { source } = input;
  return (
    UUID.test(projectUUID) &&
    input.findings.length > 0 &&
    input.findings.every(finding => finding.trim() !== '') &&
    input.sessionId.trim() !== '' &&
    (input.windowStart === undefined ||
      (Number.isSafeInteger(input.windowStart) && input.windowStart >= 0)) &&
    (version === 'v3' ? source.hostClass === 'local' : validSourceRoute(source))
  );
}

function deriveSessionScope(
  harness: PublicRetroSource['harness'],
  projectUUID: string,
  sessionId: string,
  windowStart: number,
): string {
  const hash = createHash('sha256')
    .update('safeword-retro-session-scope:v1\0')
    .update(harness)
    .update('\0')
    .update(projectUUID)
    .update('\0')
    .update(sessionId);
  if (windowStart > 0) hash.update('\0window\0').update(String(windowStart));
  return hash.digest('hex');
}

export function buildPublicRetroEnvelope(
  input: PublicRetroEnvelopeInput,
  version: 'v2' | 'v3' = 'v2',
): BuiltPublicRetroEnvelope {
  const projectUUID = input.source.projectUUID.toLowerCase();
  const cliVersion = normalizePublicRetroOptionalValue(input.source.safewordCliVersion);
  if (cliVersion === undefined || !isValidEnvelopeInput(input, projectUUID, version)) {
    throw new Error('Invalid public retrospective input');
  }

  const normalizedOptional = {
    repository: normalizePublicRetroOptionalValue(input.source.repository),
    agentVersion: normalizePublicRetroOptionalValue(input.source.agentVersion),
    model: normalizePublicRetroOptionalValue(input.source.model),
    safewordPluginVersion: normalizePublicRetroOptionalValue(input.source.safewordPluginVersion),
    osFamily: normalizePublicRetroOptionalValue(input.source.osFamily),
  };
  const source: PublicRetroSource = {
    harness: input.source.harness,
    hostClass: input.source.hostClass,
    projectUUID,
    safewordCliVersion: cliVersion,
    ...(normalizedOptional.repository !== undefined && {
      repository: normalizedOptional.repository,
    }),
    ...(normalizedOptional.agentVersion !== undefined && {
      agentVersion: normalizedOptional.agentVersion,
    }),
    ...(normalizedOptional.model !== undefined && {
      model: normalizedOptional.model,
    }),
    ...(normalizedOptional.safewordPluginVersion !== undefined && {
      safewordPluginVersion: normalizedOptional.safewordPluginVersion,
    }),
    ...(normalizedOptional.osFamily !== undefined && {
      osFamily: normalizedOptional.osFamily,
    }),
  };
  const scope = deriveSessionScope(
    source.harness,
    projectUUID,
    input.sessionId,
    input.windowStart ?? 0,
  );
  const bytes = new TextEncoder().encode(
    JSON.stringify({ version, findings: input.findings, source, sessionScope: scope }),
  );

  return { bytes, sessionScope: scope };
}

export function preparePublicRetroRequest(
  input: PublicRetroEnvelopeInput,
  dependencies: PublicRetroPreparationDependencies,
): PreparedPublicRetroRequest | undefined {
  const built = buildPublicRetroEnvelope(input, dependencies.route === 'server-v3' ? 'v3' : 'v2');
  return claimPublicRetroRequest(built, dependencies);
}

function claimPublicRetroRequest(
  built: BuiltPublicRetroEnvelope,
  dependencies: PublicRetroPreparationDependencies,
): PreparedPublicRetroRequest | undefined {
  if (dependencies.route === 'server-v3') {
    return claimServerPublicRetroRequest(built, dependencies);
  }
  if (built.bytes.byteLength > LEGACY_MAX_ENVELOPE_BYTES) return undefined;
  const requestId = dependencies.randomUUID().toLowerCase();
  if (!UUID.test(requestId)) throw new Error('Invalid public retrospective request identity');

  const markerPath = path.join(dependencies.attemptsDirectory, `${built.sessionScope}.json`);
  try {
    mkdirSync(dependencies.attemptsDirectory, { recursive: true });
    writeFileSync(markerPath, JSON.stringify({ sessionScope: built.sessionScope }), {
      encoding: 'utf8',
      flag: 'wx',
      flush: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return undefined;
    try {
      unlinkSync(markerPath);
    } catch {
      // The failed exclusive create left nothing to clean up.
    }
    throw error;
  }

  return { ...built, requestId };
}

function readServerAttempt(
  markerPath: string,
  built: BuiltPublicRetroEnvelope,
):
  | { kind: 'absent' | 'blocked' | 'conflict' }
  | { kind: 'pending'; prepared: PreparedPublicRetroRequest } {
  try {
    const record = JSON.parse(readFileSync(markerPath, 'utf8')) as Record<string, unknown>;
    if (record.route !== 'server-v3' || record.sessionScope !== built.sessionScope) {
      return { kind: 'blocked' };
    }
    if (record.state === 'accepted') return { kind: 'blocked' };
    if (
      record.state !== 'pending' ||
      typeof record.requestId !== 'string' ||
      typeof record.bodyBase64 !== 'string'
    ) {
      return { kind: 'blocked' };
    }
    const bytes = Buffer.from(record.bodyBase64, 'base64');
    if (!bytes.equals(built.bytes)) return { kind: 'conflict' };
    return {
      kind: 'pending',
      prepared: {
        bytes: new Uint8Array(bytes),
        markerPath,
        requestId: record.requestId,
        sessionScope: built.sessionScope,
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'absent' };
    throw error;
  }
}

function claimServerPublicRetroRequest(
  built: BuiltPublicRetroEnvelope,
  dependencies: PublicRetroPreparationDependencies,
): PreparedPublicRetroRequest | undefined {
  if (built.bytes.byteLength > SERVER_MAX_ENVELOPE_BYTES) return undefined;
  let markerPath = path.join(dependencies.attemptsDirectory, `${built.sessionScope}.json`);
  let existing = readServerAttempt(markerPath, built);
  if (existing.kind === 'conflict') {
    const digest = createHash('sha256').update(built.bytes).digest('hex');
    markerPath = path.join(dependencies.attemptsDirectory, `${built.sessionScope}.${digest}.json`);
    existing = readServerAttempt(markerPath, built);
  }
  if (existing.kind !== 'absent') {
    return existing.kind === 'pending' ? existing.prepared : undefined;
  }
  mkdirSync(dependencies.attemptsDirectory, { recursive: true });
  const requestId = dependencies.randomUUID().toLowerCase();
  if (!UUID_V4.test(requestId)) throw new Error('Invalid public retrospective request identity');
  try {
    createServerAttempt(markerPath, built, requestId, dependencies);
    return { ...built, markerPath, requestId };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      const raced = readServerAttempt(markerPath, built);
      return raced.kind === 'pending' ? raced.prepared : undefined;
    }
    throw error;
  }
}

function createServerAttempt(
  markerPath: string,
  built: BuiltPublicRetroEnvelope,
  requestId: string,
  dependencies: PublicRetroPreparationDependencies,
): void {
  writeFileSync(
    markerPath,
    JSON.stringify({
      bodyBase64: Buffer.from(built.bytes).toString('base64'),
      requestId,
      route: 'server-v3',
      sessionScope: built.sessionScope,
      state: 'pending',
    }),
    { encoding: 'utf8', flag: 'wx', flush: true },
  );
  try {
    (dependencies.syncDirectory ?? syncDirectoryEntry)(dependencies.attemptsDirectory);
  } catch (error) {
    unlinkSync(markerPath);
    throw error;
  }
}

function syncDirectoryEntry(directory: string): void {
  const descriptor = openSync(directory, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export async function submitPublicRetroRequest(
  prepared: PreparedPublicRetroRequest,
  transport: PublicRetroTransport,
  signal?: AbortSignal,
): Promise<PublicRetroReceipt> {
  const result = await transport(
    {
      method: 'POST',
      path: '/v1/public-retros',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-safeword-request-id': prepared.requestId,
      },
      body: prepared.bytes,
      redirect: 'error',
    },
    signal,
  );
  if (result.requestId !== prepared.requestId || result.receipt.trim() === '') {
    throw new Error('Invalid public retrospective receipt');
  }
  return result;
}

function handoffTiming(
  dependencies: PublicRetroDeliveryDependencies,
  preparationDeadline: number,
): { deadline: number; timeoutMs: number } | undefined {
  const now = dependencies.now();
  if (now >= preparationDeadline) return undefined;
  return { deadline: preparationDeadline, timeoutMs: preparationDeadline - now };
}

function preparedMarkerPath(
  prepared: PreparedPublicRetroRequest,
  attemptsDirectory: string,
): string {
  return prepared.markerPath ?? path.join(attemptsDirectory, `${prepared.sessionScope}.json`);
}

async function deliverPreparedInput(
  input: PublicRetroEnvelopeInput,
  dependencies: PublicRetroDeliveryDependencies,
  preparationDeadline: number,
): Promise<PublicRetroDeliveryOutcome> {
  let claimedMarkerPath: string | undefined;
  let accepted = false;
  try {
    const serverRoute = dependencies.route === 'server-v3';
    if (!serverRoute && dependencies.now() >= preparationDeadline) return 'abandoned';
    const built = buildPublicRetroEnvelope(input, serverRoute ? 'v3' : 'v2');
    const prepared = claimPublicRetroRequest(built, dependencies);
    if (!prepared) return 'abandoned';
    claimedMarkerPath = preparedMarkerPath(prepared, dependencies.attemptsDirectory);
    const timing = handoffTiming(dependencies, preparationDeadline);
    if (timing === undefined) return 'abandoned';
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timing.timeoutMs);
    timeout.unref();
    let result: PublicRetroReceipt;
    try {
      result = await submitPublicRetroRequest(prepared, dependencies.transport, controller.signal);
      accepted = true;
    } finally {
      clearTimeout(timeout);
    }
    if (dependencies.now() >= timing.deadline) return 'abandoned';

    const preserved = preservePublicRetroReceipt({
      handoffDeadline: timing.deadline,
      markerPath: claimedMarkerPath,
      now: dependencies.now,
      prepared,
      result,
      route: dependencies.route ?? 'direct-v2',
    });
    return preserved ? 'preserved' : 'abandoned';
  } catch (error) {
    preserveServerRejectionDiagnosis(dependencies.route, claimedMarkerPath, error);
    return 'abandoned';
  } finally {
    releaseLegacyClaim(claimedMarkerPath, accepted, dependencies.route);
  }
}

function preserveServerRejectionDiagnosis(
  route: PublicRetroPreparationDependencies['route'],
  markerPath: string | undefined,
  error: unknown,
): void {
  if (route === 'server-v3' && markerPath !== undefined && error instanceof PublicRetroRejection) {
    preserveServerRejection(markerPath, error);
  }
}

function preserveServerRejection(markerPath: string, rejection: PublicRetroRejection): void {
  const temporaryPath = `${markerPath}.rejection.tmp`;
  let renamed = false;
  try {
    const record = JSON.parse(readFileSync(markerPath, 'utf8')) as Record<string, unknown>;
    if (record.route !== 'server-v3' || record.state !== 'pending') return;
    writeFileSync(
      temporaryPath,
      JSON.stringify({
        ...record,
        lastRejection: { code: rejection.code, status: rejection.status },
      }),
      { encoding: 'utf8', flag: 'wx', flush: true },
    );
    renameSync(temporaryPath, markerPath);
    renamed = true;
  } catch {
    // Recovery remains valid without optional diagnosis persistence.
  } finally {
    if (!renamed) {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // The temporary record was never created or has already been moved.
      }
    }
  }
}

function releaseLegacyClaim(
  markerPath: string | undefined,
  accepted: boolean,
  route: PublicRetroPreparationDependencies['route'],
): void {
  if (markerPath === undefined || accepted || route === 'server-v3') return;
  try {
    unlinkSync(markerPath);
  } catch {
    // Another process may already have recovered the failed attempt.
  }
}

function preservePublicRetroReceipt(input: {
  handoffDeadline: number;
  markerPath: string;
  now: () => number;
  prepared: PreparedPublicRetroRequest;
  result: PublicRetroReceipt;
  route: 'direct-v2' | 'server-v3';
}): boolean {
  const { handoffDeadline, markerPath, now, prepared, result, route } = input;
  const temporaryPath = `${markerPath}.${prepared.requestId}.tmp`;
  let committed = false;
  try {
    writeFileSync(
      temporaryPath,
      JSON.stringify(
        route === 'server-v3'
          ? {
              receipt: result.receipt,
              requestId: prepared.requestId,
              route,
              sessionScope: prepared.sessionScope,
              state: 'accepted',
            }
          : { sessionScope: prepared.sessionScope, receipt: result.receipt },
      ),
      { encoding: 'utf8', flag: 'wx', flush: true },
    );
    if (now() >= handoffDeadline) return false;
    renameSync(temporaryPath, markerPath);
    committed = true;
    return true;
  } finally {
    if (!committed) {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // Nothing remains when creation failed before the temporary file existed.
      }
    }
  }
}

export function deliverSanitizedPublicRetroFindings(
  input: {
    findings: readonly Finding[];
    source: PublicRetroSource;
    sessionId: string;
    windowStart?: number;
  },
  dependencies: PublicRetroDeliveryDependencies,
  preparationDeadline: number,
): Promise<PublicRetroDeliveryOutcome> {
  try {
    return deliverPreparedInput(
      {
        findings: input.findings.map(finding => assemblePublicFinding(finding)),
        source: input.source,
        sessionId: input.sessionId,
        windowStart: input.windowStart,
      },
      dependencies,
      preparationDeadline,
    );
  } catch {
    return Promise.resolve('abandoned');
  }
}
