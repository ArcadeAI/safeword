import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
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

export interface PublicRetroPreparationDependencies {
  attemptsDirectory: string;
  randomUUID: () => string;
}

export interface PublicRetroDeliveryDependencies extends PublicRetroPreparationDependencies {
  now: () => number;
  transport: PublicRetroTransport;
}

export type PublicRetroDeliveryOutcome = 'preserved' | 'abandoned';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_ENVELOPE_BYTES = 65_536;
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
  return source.hostClass === 'unknown' || source.harness !== 'cursor';
}

function isValidEnvelopeInput(input: PublicRetroEnvelopeInput, projectUUID: string): boolean {
  const { source } = input;
  return (
    UUID.test(projectUUID) &&
    input.findings.length > 0 &&
    input.findings.every(finding => finding.trim() !== '') &&
    input.sessionId.trim() !== '' &&
    (input.windowStart === undefined ||
      (Number.isSafeInteger(input.windowStart) && input.windowStart >= 0)) &&
    validSourceRoute(source)
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
): BuiltPublicRetroEnvelope {
  const projectUUID = input.source.projectUUID.toLowerCase();
  const cliVersion = normalizePublicRetroOptionalValue(input.source.safewordCliVersion);
  if (cliVersion === undefined || !isValidEnvelopeInput(input, projectUUID)) {
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
    JSON.stringify({ version: 'v2', findings: input.findings, source, sessionScope: scope }),
  );

  return { bytes, sessionScope: scope };
}

export function preparePublicRetroRequest(
  input: PublicRetroEnvelopeInput,
  dependencies: PublicRetroPreparationDependencies,
): PreparedPublicRetroRequest | undefined {
  const built = buildPublicRetroEnvelope(input);
  return claimPublicRetroRequest(built, dependencies);
}

function claimPublicRetroRequest(
  built: BuiltPublicRetroEnvelope,
  dependencies: PublicRetroPreparationDependencies,
): PreparedPublicRetroRequest | undefined {
  if (built.bytes.byteLength > MAX_ENVELOPE_BYTES) return undefined;
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

async function deliverPreparedInput(
  input: PublicRetroEnvelopeInput,
  dependencies: PublicRetroDeliveryDependencies,
  preparationDeadline: number,
): Promise<PublicRetroDeliveryOutcome> {
  let claimedMarkerPath: string | undefined;
  let accepted = false;
  try {
    if (dependencies.now() >= preparationDeadline) return 'abandoned';
    const built = buildPublicRetroEnvelope(input);
    const prepared = claimPublicRetroRequest(built, dependencies);
    if (!prepared) return 'abandoned';
    claimedMarkerPath = path.join(dependencies.attemptsDirectory, `${prepared.sessionScope}.json`);
    if (dependencies.now() >= preparationDeadline) return 'abandoned';

    const handoffDeadline = dependencies.now() + 2000;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 2000);
    timeout.unref();
    let result: PublicRetroReceipt;
    try {
      result = await submitPublicRetroRequest(prepared, dependencies.transport, controller.signal);
      accepted = true;
    } finally {
      clearTimeout(timeout);
    }
    if (dependencies.now() >= handoffDeadline) return 'abandoned';

    const preserved = preservePublicRetroReceipt(
      prepared,
      result,
      claimedMarkerPath,
      dependencies.now,
      handoffDeadline,
    );
    return preserved ? 'preserved' : 'abandoned';
  } catch {
    return 'abandoned';
  } finally {
    if (claimedMarkerPath !== undefined && !accepted) {
      try {
        unlinkSync(claimedMarkerPath);
      } catch {
        // Another process may already have recovered the failed attempt.
      }
    }
  }
}

function preservePublicRetroReceipt(
  prepared: PreparedPublicRetroRequest,
  result: PublicRetroReceipt,
  markerPath: string,
  now: () => number,
  handoffDeadline: number,
): boolean {
  const temporaryPath = `${markerPath}.${prepared.requestId}.tmp`;
  let committed = false;
  try {
    writeFileSync(
      temporaryPath,
      JSON.stringify({ sessionScope: prepared.sessionScope, receipt: result.receipt }),
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
