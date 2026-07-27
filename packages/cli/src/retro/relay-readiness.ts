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

declare const __SAFEWORD_BUILD_COMMIT__: string | undefined;

export const SAFEWORD_BUILD_COMMIT =
  typeof __SAFEWORD_BUILD_COMMIT__ === 'string' ? __SAFEWORD_BUILD_COMMIT__ : 'development-source';

const COMMIT_PATTERN = /^[\da-f]{40}$/u;
const HASH_PATTERN = /^[\da-f]{64}$/u;
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function validDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.toISOString() !== value ? undefined : date;
}

function validArtifact(artifact: RelayMeasurementArtifact): boolean {
  return (
    artifact.path.length > 0 &&
    !artifact.path.startsWith('/') &&
    !artifact.path.split('/').includes('..') &&
    HASH_PATTERN.test(artifact.sha256) &&
    Number.isSafeInteger(artifact.sampleSize) &&
    artifact.sampleSize >= 0
  );
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Fail-closed validation keeps every independent evidence predicate visible.
export async function validateRelayReadiness(
  manifest: RelayReadinessManifest | typeof CHECKED_IN_RELAY_READINESS,
  dependencies: {
    buildCommit: string;
    isAncestor: (ancestor: string, descendant: string) => Promise<boolean>;
    now: Date;
    readArtifactAtCommit: (commit: string, path: string) => Promise<{ sha256: string } | undefined>;
  },
): Promise<{ enabled: boolean }> {
  if (!manifest.enabled) return { enabled: false };
  try {
    if (
      manifest.version !== 1 ||
      !COMMIT_PATTERN.test(dependencies.buildCommit) ||
      !COMMIT_PATTERN.test(manifest.evidenceCommit)
    ) {
      return { enabled: false };
    }
    const expectedIssues = [1474, 1481] as const;
    for (const [index, issue] of expectedIssues.entries()) {
      const prerequisite = manifest.prerequisites[index];
      if (
        prerequisite?.issue !== issue ||
        prerequisite?.state !== 'closed' ||
        prerequisite?.url !== `https://github.com/ArcadeAI/safeword/issues/${issue}` ||
        !COMMIT_PATTERN.test(prerequisite?.mergedCommit ?? '')
      ) {
        return { enabled: false };
      }
    }
    if (!(await dependencies.isAncestor(manifest.evidenceCommit, dependencies.buildCommit))) {
      return { enabled: false };
    }
    for (const prerequisite of manifest.prerequisites) {
      if (!(await dependencies.isAncestor(prerequisite.mergedCommit, manifest.evidenceCommit))) {
        return { enabled: false };
      }
    }

    const closedDates = manifest.prerequisites.map(item => validDate(item.closedAt));
    const reviewedAt = validDate(manifest.reviewedAt);
    if (closedDates.includes(undefined) || reviewedAt === undefined) {
      return { enabled: false };
    }
    const latestClose = Math.max(...closedDates.map(date => date?.getTime() ?? NaN));
    for (const artifact of Object.values(manifest.measurements)) {
      const measuredAt = validDate(artifact.measuredAt);
      if (
        !validArtifact(artifact) ||
        measuredAt === undefined ||
        measuredAt.getTime() < latestClose ||
        dependencies.now.getTime() - measuredAt.getTime() > MAX_EVIDENCE_AGE_MS ||
        dependencies.now.getTime() - reviewedAt.getTime() > MAX_EVIDENCE_AGE_MS
      ) {
        return { enabled: false };
      }
      const durableArtifact = await dependencies.readArtifactAtCommit(
        manifest.evidenceCommit,
        artifact.path,
      );
      if (durableArtifact?.sha256 !== artifact.sha256) return { enabled: false };
    }
    return { enabled: true };
  } catch {
    return { enabled: false };
  }
}
