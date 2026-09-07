import checkedInProductionAttestation from './local-retro-production-attestation.json' with { type: 'json' };
import checkedInManifest from './local-retro-readiness-manifest.json' with { type: 'json' };
import { digestLocalRetroReadinessManifest } from './readiness-digest.js';

export { digestLocalRetroReadinessManifest } from './readiness-digest.js';

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
      terminal: 'filed';
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

type DisabledProductionAttestation = { enabled: false; version: 1 };
export const CHECKED_IN_LOCAL_RETRO_PRODUCTION_ATTESTATION = checkedInProductionAttestation as
  DisabledProductionAttestation | LocalRetroProductionAttestation;

const COMMIT_PATTERN = /^[\da-f]{40}$/u;
const HASH_PATTERN = /^[\da-f]{64}$/u;
const REQUEST_ID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REQUIRED_HARNESSES = ['claude-code', 'codex', 'cursor'] as const;
const REQUIRED_FAULTS = [
  'ambiguousCreateMatch',
  'ambiguousCreateNoMatch',
  'claimCrash',
  'retryExhaustion',
  'workerOutage',
] as const;

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

export function isLocalRetroProductionAttestationFresh(
  attestation: DisabledProductionAttestation | LocalRetroProductionAttestation,
  now: Date,
): boolean {
  return attestation.enabled && isFresh(attestation.verifiedAt, now);
}

function hasRequiredLifecycle(attestation: LocalRetroProductionAttestation): boolean {
  return (
    attestation.lifecycle['claude-code'] === 'claude-code-interactive' &&
    attestation.lifecycle.codex === 'codex-desktop' &&
    attestation.lifecycle.cursor === 'cursor-desktop'
  );
}

function hasExactKeys(record: object, expected: readonly string[]): boolean {
  const keys = Object.keys(record);
  return keys.length === expected.length && expected.every(key => Object.hasOwn(record, key));
}

function hasAncestry(
  ancestorPairs: readonly { ancestor: string; descendant: string }[],
  ancestor: string,
  descendant: string,
): boolean {
  return (
    ancestor === descendant ||
    ancestorPairs.some(pair => pair.ancestor === ancestor && pair.descendant === descendant)
  );
}

function validHarnessEvidence(
  evidence: LocalRetroReadinessManifest['harnesses'][keyof LocalRetroReadinessManifest['harnesses']],
  manifest: LocalRetroReadinessManifest,
  ancestorPairs: readonly { ancestor: string; descendant: string }[],
): boolean {
  return (
    HASH_PATTERN.test(evidence.artifactDigest) &&
    COMMIT_PATTERN.test(evidence.buildCommit) &&
    hasAncestry(ancestorPairs, evidence.buildCommit, manifest.evidenceCommit) &&
    REQUEST_ID_PATTERN.test(evidence.collectorReceipt) &&
    evidence.hostClass === 'local' &&
    /^[\w-]+$/u.test(evidence.relayReceipt) &&
    REQUEST_ID_PATTERN.test(evidence.requestId) &&
    HASH_PATTERN.test(evidence.sessionScope) &&
    evidence.terminal === 'filed'
  );
}

function hasCompleteEvidence(
  manifest: LocalRetroReadinessManifest,
  ancestorPairs: readonly { ancestor: string; descendant: string }[],
): boolean {
  const harnessEvidence = REQUIRED_HARNESSES.map(harness => manifest.harnesses[harness]);
  const distinctFields = ['collectorReceipt', 'relayReceipt', 'requestId', 'sessionScope'] as const;
  return (
    hasExactKeys(manifest.harnesses, REQUIRED_HARNESSES) &&
    harnessEvidence.every(evidence => validHarnessEvidence(evidence, manifest, ancestorPairs)) &&
    distinctFields.every(
      field =>
        new Set(harnessEvidence.map(evidence => evidence[field])).size === harnessEvidence.length,
    ) &&
    hasExactKeys(manifest.recoveredFaults, REQUIRED_FAULTS) &&
    REQUIRED_FAULTS.every(fault => HASH_PATTERN.test(manifest.recoveredFaults[fault]))
  );
}

function validProductionAttestation(
  manifest: LocalRetroReadinessManifest,
  attestation: DisabledProductionAttestation | LocalRetroProductionAttestation | undefined,
): boolean {
  if (!attestation?.enabled) return false;
  const reviewedAt = new Date(manifest.reviewedAt);
  const verifiedAt = new Date(attestation.verifiedAt);
  return (
    attestation.version === 1 &&
    attestation.authority === 'retro-relay-production-v1' &&
    hasRequiredLifecycle(attestation) &&
    !Number.isNaN(reviewedAt.getTime()) &&
    reviewedAt.toISOString() === manifest.reviewedAt &&
    !Number.isNaN(verifiedAt.getTime()) &&
    reviewedAt.getTime() <= verifiedAt.getTime() &&
    attestation.manifestSha256 === digestLocalRetroReadinessManifest(manifest)
  );
}

/**
 * Validate the build-attested release state already approved by the separate
 * production verifier. Freshness belongs to that release boundary so an
 * installed client never falls back to direct filing as its wall clock ages.
 */
export function validateLocalRetroReadiness(
  manifest: DisabledManifest | LocalRetroReadinessManifest,
  input: {
    ancestorPairs: readonly { ancestor: string; descendant: string }[];
    buildCommit: string;
    productionAttestation?: DisabledProductionAttestation | LocalRetroProductionAttestation;
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
    hasCompleteEvidence(manifest, input.ancestorPairs) &&
    validProductionAttestation(manifest, input.productionAttestation)
  );
}
