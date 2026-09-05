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

/**
 * Production canary and recovery artifacts do not yet have independently
 * verifiable collector/relay provenance. Keep cutover unconditionally closed
 * until a production authority verifier exists; a checked-in manifest and
 * caller-supplied hashes cannot authorize the route.
 */
export function validateLocalRetroReadiness(
  _manifest: DisabledManifest | LocalRetroReadinessManifest,
  _input: {
    ancestorPairs: readonly { ancestor: string; descendant: string }[];
    buildCommit: string;
    now: Date;
    relayReady: boolean;
  },
): false {
  return false;
}
