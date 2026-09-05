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

// This checked-in manifest is a maintainer attestation. Digests identify reviewed
// production artifacts; the validator proves completeness, freshness, and ancestry,
// while the release process owns the artifacts' substantive review.

type DisabledManifest = { enabled: false; version: 1 };
export const CHECKED_IN_LOCAL_RETRO_READINESS = checkedInManifest as
  DisabledManifest | LocalRetroReadinessManifest;

const COMMIT = /^[\da-f]{40}$/u;
const DIGEST = /^[\da-f]{64}$/u;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;

// Production canary and fault artifacts do not yet carry a collector/relay
// signature or another independently verifiable provenance record. Keep this
// rollout gate closed until that authority exists; committed digests alone are
// not evidence of production behavior.
function hasAuthoritativeProductionEvidence(): boolean {
  return false;
}

function harnessBuildIsCurrent(
  buildCommit: string,
  manifest: LocalRetroReadinessManifest,
  input: Parameters<typeof validateLocalRetroReadiness>[1],
): boolean {
  return (
    COMMIT.test(buildCommit) &&
    (buildCommit === manifest.evidenceCommit ||
      input.ancestorPairs.some(
        pair => pair.ancestor === buildCommit && pair.descendant === manifest.evidenceCommit,
      ))
  );
}

function receiptPairIsValid(evidence: LocalRetroReadinessManifest['harnesses']['codex']): boolean {
  return (
    UUID.test(evidence.collectorReceipt) &&
    UUID.test(evidence.relayReceipt) &&
    evidence.collectorReceipt !== evidence.relayReceipt
  );
}

function validHarnessEvidence(
  harness: keyof LocalRetroReadinessManifest['harnesses'],
  evidence: LocalRetroReadinessManifest['harnesses']['codex'],
  manifest: LocalRetroReadinessManifest,
  input: Parameters<typeof validateLocalRetroReadiness>[1],
): boolean {
  const expectedArtifactDigest = createHash('sha256')
    .update(
      [
        'local-retro-canary:v1',
        harness,
        evidence.buildCommit,
        evidence.requestId,
        evidence.sessionScope,
        evidence.collectorReceipt,
        evidence.relayReceipt,
        evidence.terminal,
      ].join('\0'),
    )
    .digest('hex');
  const requestIdentityIsValid =
    UUID.test(evidence.requestId) && DIGEST.test(evidence.sessionScope);
  return (
    evidence.hostClass === 'local' &&
    harnessBuildIsCurrent(evidence.buildCommit, manifest, input) &&
    receiptPairIsValid(evidence) &&
    requestIdentityIsValid &&
    evidence.artifactDigest === expectedArtifactDigest &&
    ['duplicate', 'filed'].includes(evidence.terminal)
  );
}

function allUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function validHarnesses(
  manifest: LocalRetroReadinessManifest,
  input: Parameters<typeof validateLocalRetroReadiness>[1],
): boolean {
  const harnesses = Object.entries(manifest.harnesses) as [
    keyof LocalRetroReadinessManifest['harnesses'],
    LocalRetroReadinessManifest['harnesses']['codex'],
  ][];
  if (
    harnesses.some(
      ([harness, evidence]) => !validHarnessEvidence(harness, evidence, manifest, input),
    )
  ) {
    return false;
  }
  const evidenceValues = harnesses.map(([, evidence]) => evidence);
  return (
    allUnique(evidenceValues.map(evidence => evidence.requestId)) &&
    allUnique(evidenceValues.map(evidence => evidence.sessionScope)) &&
    allUnique(evidenceValues.map(evidence => evidence.artifactDigest))
  );
}

function manifestBuildIsAncestor(
  manifest: LocalRetroReadinessManifest,
  input: Parameters<typeof validateLocalRetroReadiness>[1],
): boolean {
  return (
    manifest.evidenceCommit === input.buildCommit ||
    input.ancestorPairs.some(
      pair => pair.ancestor === manifest.evidenceCommit && pair.descendant === input.buildCommit,
    )
  );
}

function validReviewWindow(manifest: LocalRetroReadinessManifest, now: Date): boolean {
  const reviewedAt = new Date(manifest.reviewedAt);
  return (
    COMMIT.test(manifest.evidenceCommit) &&
    !Number.isNaN(reviewedAt.getTime()) &&
    reviewedAt <= now &&
    now.getTime() - reviewedAt.getTime() <= 30 * 86_400_000
  );
}

function hasEvidenceCollections(manifest: LocalRetroReadinessManifest): boolean {
  return (
    typeof manifest.harnesses === 'object' &&
    manifest.harnesses !== null &&
    typeof manifest.recoveredFaults === 'object' &&
    manifest.recoveredFaults !== null
  );
}

function readinessPrerequisites(
  manifest: DisabledManifest | LocalRetroReadinessManifest,
  input: Parameters<typeof validateLocalRetroReadiness>[1],
): manifest is LocalRetroReadinessManifest {
  return (
    manifest.enabled &&
    input.relayReady &&
    COMMIT.test(input.buildCommit) &&
    hasAuthoritativeProductionEvidence()
  );
}

export function validateLocalRetroReadiness(
  manifest: DisabledManifest | LocalRetroReadinessManifest,
  input: {
    ancestorPairs: readonly { ancestor: string; descendant: string }[];
    buildCommit: string;
    now: Date;
    relayReady: boolean;
  },
): boolean {
  if (!readinessPrerequisites(manifest, input)) return false;
  if (!validReviewWindow(manifest, input.now) || !manifestBuildIsAncestor(manifest, input))
    return false;
  if (!hasEvidenceCollections(manifest)) return false;
  const harnessKeys = Object.keys(manifest.harnesses).toSorted((left, right) =>
    left.localeCompare(right),
  );
  if (harnessKeys.join('\0') !== ['claude-code', 'codex', 'cursor'].join('\0')) return false;
  if (!validHarnesses(manifest, input)) return false;
  const faultKeys = Object.keys(manifest.recoveredFaults).toSorted((left, right) =>
    left.localeCompare(right),
  );
  return (
    faultKeys.join('\0') ===
      [
        'ambiguousCreateMatch',
        'ambiguousCreateNoMatch',
        'claimCrash',
        'retryExhaustion',
        'workerOutage',
      ].join('\0') && Object.values(manifest.recoveredFaults).every(value => DIGEST.test(value))
  );
}
