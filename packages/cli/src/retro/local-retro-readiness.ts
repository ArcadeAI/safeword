import checkedInManifest from './local-retro-readiness-manifest.json' with { type: 'json' };

export interface LocalRetroReadinessManifest {
  enabled: true;
  evidenceCommit: string;
  harnesses: Record<
    'claude-code' | 'codex' | 'cursor',
    {
      buildCommit: string;
      collectorReceipt: string;
      hostClass: 'local';
      relayReceipt: string;
      terminal: 'duplicate' | 'filed';
    }
  >;
  recoveredFaults: Record<'ambiguousCreate' | 'retryExhaustion' | 'workerOutage', string>;
  reviewedAt: string;
  version: 1;
}

type DisabledManifest = { enabled: false; version: 1 };
export const CHECKED_IN_LOCAL_RETRO_READINESS = checkedInManifest as
  DisabledManifest | LocalRetroReadinessManifest;

const COMMIT = /^[\da-f]{40}$/u;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;

function validHarnessEvidence(
  evidence: LocalRetroReadinessManifest['harnesses']['codex'],
): boolean {
  return (
    evidence.hostClass === 'local' &&
    COMMIT.test(evidence.buildCommit) &&
    UUID.test(evidence.collectorReceipt) &&
    UUID.test(evidence.relayReceipt) &&
    ['duplicate', 'filed'].includes(evidence.terminal)
  );
}

function manifestBuildIsAncestor(
  manifest: LocalRetroReadinessManifest,
  input: Parameters<typeof validateLocalRetroReadiness>[1],
): boolean {
  return input.ancestorPairs.some(
    pair => pair.ancestor === manifest.evidenceCommit && pair.descendant === input.buildCommit,
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

export function validateLocalRetroReadiness(
  manifest: DisabledManifest | LocalRetroReadinessManifest,
  input: {
    ancestorPairs: readonly { ancestor: string; descendant: string }[];
    buildCommit: string;
    now: Date;
    relayReady: boolean;
  },
): boolean {
  if (!manifest.enabled || !input.relayReady || !COMMIT.test(input.buildCommit)) return false;
  if (!validReviewWindow(manifest, input.now) || !manifestBuildIsAncestor(manifest, input))
    return false;
  const harnesses = Object.values(manifest.harnesses);
  if (harnesses.length !== 3 || harnesses.some(evidence => !validHarnessEvidence(evidence)))
    return false;
  return Object.values(manifest.recoveredFaults).every(value => /^[\da-f]{64}$/u.test(value));
}
