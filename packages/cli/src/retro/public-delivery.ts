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

export function buildPublicRetroEnvelope(
  _input: PublicRetroEnvelopeInput,
): BuiltPublicRetroEnvelope {
  throw new Error('Not implemented');
}
