import { createHash } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

export type PublicRetroTransport = (request: PublicRetroHttpRequest) => Promise<PublicRetroReceipt>;

export interface PublicRetroPreparationDependencies {
  attemptsDirectory: string;
  randomUUID: () => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_ENVELOPE_BYTES = 65_536;

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
    ...(input.source.repository !== undefined && { repository: input.source.repository }),
    ...(input.source.agentVersion !== undefined && { agentVersion: input.source.agentVersion }),
    ...(input.source.model !== undefined && { model: input.source.model }),
    ...(input.source.safewordPluginVersion !== undefined && {
      safewordPluginVersion: input.source.safewordPluginVersion,
    }),
    ...(input.source.osFamily !== undefined && { osFamily: input.source.osFamily }),
    ...(input.source.userIdentity !== undefined && { userIdentity: input.source.userIdentity }),
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
  if (built.bytes.byteLength > MAX_ENVELOPE_BYTES) return undefined;
  const requestId = dependencies.randomUUID().toLowerCase();
  if (!UUID.test(requestId)) throw new Error('Invalid public retrospective request identity');

  const markerPath = path.join(dependencies.attemptsDirectory, `${built.sessionScope}.json`);
  try {
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
): Promise<PublicRetroReceipt> {
  const result = await transport({
    method: 'POST',
    path: '/v1/public-retros',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-safeword-request-id': prepared.requestId,
    },
    body: prepared.bytes,
  });
  if (result.requestId !== prepared.requestId || result.receipt.trim() === '') {
    throw new Error('Invalid public retrospective receipt');
  }
  return result;
}
