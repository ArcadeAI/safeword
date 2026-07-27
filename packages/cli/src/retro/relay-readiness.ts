export interface RelayMeasurementArtifact {
  measuredAt: string;
  path: string;
  sampleSize: number;
  sha256: string;
}

export interface RelayReadinessManifest {
  enabled: true;
  evidenceCommit: string;
  measurements: {
    sameSignatureCollisions: RelayMeasurementArtifact;
    spooledNeverFiled: RelayMeasurementArtifact;
  };
  prerequisites: [
    {
      closedAt: string;
      issue: 1474;
      mergedCommit: string;
      state: 'closed';
      url: string;
    },
    {
      closedAt: string;
      issue: 1481;
      mergedCommit: string;
      state: 'closed';
      url: string;
    },
  ];
  reviewedAt: string;
  version: 1;
}

export const CHECKED_IN_RELAY_READINESS = { enabled: false, version: 1 } as const;

export function validateRelayReadiness(
  _manifest: RelayReadinessManifest | typeof CHECKED_IN_RELAY_READINESS,
  _dependencies: {
    buildCommit: string;
    isAncestor: (ancestor: string, descendant: string) => Promise<boolean>;
    now: Date;
    readArtifactAtCommit: (commit: string, path: string) => Promise<{ sha256: string } | undefined>;
  },
): Promise<{ enabled: boolean }> {
  throw new Error('RED: relay readiness is not implemented');
}
