import { createHash } from 'node:crypto';

import checkedInManifest from './local-retro-readiness-manifest.json' with { type: 'json' };

export interface LocalRetroReadinessManifest {
  enabled: true;
  evidenceCommit: string;
  harnesses: Record<
    'claude-code' | 'codex' | 'cursor',
    {
      artifactDigest: string;
      buildCommit: string;
      collectorReceipt: string;
      hostClass: 'local';
      relayReceipt: string;
      requestId: string;
      sessionScope: string;
      terminal: 'duplicate' | 'filed';
    }
  >;
  recoveredFaults: Record<
    | 'ambiguousCreateMatch'
    | 'ambiguousCreateNoMatch'
    | 'claimCrash'
    | 'retryExhaustion'
    | 'workerOutage',
    string
  >;
  reviewedAt: string;
  version: 1;
}

type DisabledManifest = { enabled: false; version: 1 };
export const CHECKED_IN_LOCAL_RETRO_READINESS = checkedInManifest as
  DisabledManifest | LocalRetroReadinessManifest;

export interface LocalRetroProductionAttestation {
  authority: 'retro-relay-production-v1';
  enabled: true;
  lifecycle: {
    'claude-code': 'claude-code-interactive';
    codex: 'codex-desktop';
    cursor: 'cursor-desktop';
  };
  manifestSha256: string;
  verifiedAt: string;
  version: 1;
}

const COMMIT_PATTERN = /^[\da-f]{40}$/u;
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isFresh(verifiedAt: string, now: Date): boolean {
  const verified = new Date(verifiedAt);
  const age = now.getTime() - verified.getTime();
  return (
    !Number.isNaN(verified.getTime()) &&
    verified.toISOString() === verifiedAt &&
    age >= 0 &&
    age <= MAX_EVIDENCE_AGE_MS
  );
}

function hasRequiredLifecycle(attestation: LocalRetroProductionAttestation): boolean {
  return (
    attestation.lifecycle['claude-code'] === 'claude-code-interactive' &&
    attestation.lifecycle.codex === 'codex-desktop' &&
    attestation.lifecycle.cursor === 'cursor-desktop'
  );
}

function validProductionAttestation(
  manifest: LocalRetroReadinessManifest,
  attestation: LocalRetroProductionAttestation | undefined,
  now: Date,
): boolean {
  if (attestation === undefined) return false;
  return (
    attestation.enabled &&
    attestation.version === 1 &&
    attestation.authority === 'retro-relay-production-v1' &&
    hasRequiredLifecycle(attestation) &&
    isFresh(attestation.verifiedAt, now) &&
    attestation.manifestSha256 ===
      createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
  );
}

/**
 * Production canary and recovery artifacts do not yet have independently
 * verifiable collector/relay provenance. Keep cutover unconditionally closed
 * until a production authority verifier exists; a checked-in manifest and
 * caller-supplied hashes cannot authorize the route.
 */
export function validateLocalRetroReadiness(
  manifest: DisabledManifest | LocalRetroReadinessManifest,
  input: {
    ancestorPairs: readonly { ancestor: string; descendant: string }[];
    buildCommit: string;
    now: Date;
    productionAttestation?: LocalRetroProductionAttestation;
    relayReady: boolean;
  },
): boolean {
  if (!manifest.enabled || !input.relayReady) return false;
  return (
    COMMIT_PATTERN.test(manifest.evidenceCommit) &&
    COMMIT_PATTERN.test(input.buildCommit) &&
    input.ancestorPairs.some(
      pair => pair.ancestor === manifest.evidenceCommit && pair.descendant === input.buildCommit,
    ) &&
    validProductionAttestation(manifest, input.productionAttestation, input.now)
  );
}
