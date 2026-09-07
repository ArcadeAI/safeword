import type {
  LocalRetroProductionAttestation,
  LocalRetroReadinessManifest,
} from '../../src/retro/local-retro-readiness.js';

export interface LocalRetroProductionVerificationOptions {
  collectorCredential: string;
  collectorOrigin: string;
  fetch: typeof fetch;
  githubToken?: string;
  installationId: number;
  relayCredential: string;
  relayOrigin: string;
  repository: string;
  tenantId: string;
}

export function verifyLocalRetroProductionReadiness(
  _manifest: LocalRetroReadinessManifest,
  _attestation: LocalRetroProductionAttestation,
  _options: LocalRetroProductionVerificationOptions,
): Promise<boolean> {
  return Promise.resolve(false);
}
