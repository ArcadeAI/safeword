import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { assemblePublicFinding, type Finding } from './finding.js';
import { prepareFinding } from './pipeline.js';

export interface PublicRetroSource {
  harness: 'claude-code' | 'codex';
  hostClass: 'local';
  projectUUID: string;
  safewordCliVersion: string;
  repository?: string;
  agentVersion?: string;
  model?: string;
  safewordPluginVersion?: string;
  osFamily?: string;
  userIdentity?: string;
}

export interface PublicRetroEnvelopeInput {
  finding: string;
  source: PublicRetroSource;
  sessionId: string;
}

export interface PublicRetroCandidateInput {
  candidate: unknown;
  source: PublicRetroSource;
  sessionId: string;
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

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

function deriveSessionScope(
  harness: PublicRetroSource['harness'],
  projectUUID: string,
  sessionId: string,
): string {
  return createHash('sha256')
    .update('safeword-retro-session-scope:v1\0')
    .update(harness)
    .update('\0')
    .update(projectUUID)
    .update('\0')
    .update(sessionId)
    .digest('hex');
}

export function buildPublicRetroEnvelope(
  input: PublicRetroEnvelopeInput,
): BuiltPublicRetroEnvelope {
  const projectUUID = input.source.projectUUID.toLowerCase();
  if (!UUID.test(projectUUID) || input.finding.trim() === '' || input.sessionId.trim() === '') {
    throw new Error('Invalid public retrospective input');
  }

  const source: PublicRetroSource = {
    harness: input.source.harness,
    hostClass: input.source.hostClass,
    projectUUID,
    safewordCliVersion: input.source.safewordCliVersion,
    ...(hasValue(input.source.repository) && { repository: input.source.repository }),
    ...(hasValue(input.source.agentVersion) && { agentVersion: input.source.agentVersion }),
    ...(hasValue(input.source.model) && { model: input.source.model }),
    ...(hasValue(input.source.safewordPluginVersion) && {
      safewordPluginVersion: input.source.safewordPluginVersion,
    }),
    ...(hasValue(input.source.osFamily) && { osFamily: input.source.osFamily }),
    ...(hasValue(input.source.userIdentity) && { userIdentity: input.source.userIdentity }),
  };
  const scope = deriveSessionScope(source.harness, projectUUID, input.sessionId);
  const bytes = new TextEncoder().encode(
    JSON.stringify({ version: 'v1', finding: input.finding, source, sessionScope: scope }),
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

export async function deliverPublicRetro(
  input: PublicRetroEnvelopeInput,
  dependencies: PublicRetroDeliveryDependencies,
): Promise<PublicRetroDeliveryOutcome> {
  const preparationDeadline = dependencies.now() + 1000;
  return deliverPreparedInput(input, dependencies, preparationDeadline);
}

async function deliverPreparedInput(
  input: PublicRetroEnvelopeInput,
  dependencies: PublicRetroDeliveryDependencies,
  preparationDeadline: number,
): Promise<PublicRetroDeliveryOutcome> {
  try {
    const built = buildPublicRetroEnvelope(input);
    if (built.bytes.byteLength > MAX_ENVELOPE_BYTES) return 'abandoned';
    if (dependencies.now() >= preparationDeadline) return 'abandoned';
    const prepared = claimPublicRetroRequest(built, dependencies);
    if (!prepared || dependencies.now() >= preparationDeadline) return 'abandoned';

    const handoffDeadline = dependencies.now() + 2000;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 2000);
    timeout.unref();
    let result: PublicRetroReceipt;
    try {
      result = await submitPublicRetroRequest(prepared, dependencies.transport, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
    if (dependencies.now() >= handoffDeadline) return 'abandoned';

    const markerPath = path.join(dependencies.attemptsDirectory, `${prepared.sessionScope}.json`);
    const temporaryPath = `${markerPath}.${prepared.requestId}.tmp`;
    writeFileSync(
      temporaryPath,
      JSON.stringify({ sessionScope: prepared.sessionScope, receipt: result.receipt }),
      { encoding: 'utf8', flag: 'wx', flush: true },
    );
    if (dependencies.now() >= handoffDeadline) return 'abandoned';
    renameSync(temporaryPath, markerPath);
    return 'preserved';
  } catch {
    return 'abandoned';
  }
}

export async function deliverPublicRetroCandidate(
  input: PublicRetroCandidateInput,
  dependencies: PublicRetroDeliveryDependencies,
): Promise<PublicRetroDeliveryOutcome> {
  const preparationDeadline = dependencies.now() + 1000;
  try {
    const prepared = await prepareFinding(input.candidate);
    if ('dropped' in prepared || dependencies.now() >= preparationDeadline) return 'abandoned';
    return await deliverPreparedInput(
      {
        finding: assemblePublicFinding(prepared.finding),
        source: input.source,
        sessionId: input.sessionId,
      },
      dependencies,
      preparationDeadline,
    );
  } catch {
    return 'abandoned';
  }
}

export function deliverSanitizedPublicRetroFinding(
  input: { finding: Finding; source: PublicRetroSource; sessionId: string },
  dependencies: PublicRetroDeliveryDependencies,
  preparationDeadline: number,
): Promise<PublicRetroDeliveryOutcome> {
  return deliverPreparedInput(
    {
      finding: assemblePublicFinding(input.finding),
      source: input.source,
      sessionId: input.sessionId,
    },
    dependencies,
    preparationDeadline,
  );
}
