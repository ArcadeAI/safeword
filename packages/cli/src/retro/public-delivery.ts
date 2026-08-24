import { createHash } from 'node:crypto';

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

export interface PublicRetroPreparationDependencies {
  attemptsDirectory: string;
  randomUUID: () => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  _input: PublicRetroEnvelopeInput,
  _dependencies: PublicRetroPreparationDependencies,
): PreparedPublicRetroRequest | undefined {
  throw new Error('Not implemented');
}
