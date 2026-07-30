import { createHash } from 'node:crypto';

import checkedInRelayReadiness from './relay-readiness-manifest.json' with { type: 'json' };

interface RelayMeasurementArtifact {
  measuredAt: string;
  path: string;
  sampleSize: number;
  sha256: string;
}

export interface RelayReadinessManifest {
  enabled: true;
  evidenceCommit: string;
  measurements: {
    drainThroughput: RelayMeasurementArtifact;
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

type DisabledRelayReadiness = { enabled: false; version: 1 };

export const CHECKED_IN_RELAY_READINESS = checkedInRelayReadiness as
  DisabledRelayReadiness | RelayReadinessManifest;

declare const __SAFEWORD_BUILD_COMMIT__: string | undefined;
declare const __SAFEWORD_RELAY_BUILD_ATTESTATION__: RelayBuildAttestation | undefined;

export const SAFEWORD_BUILD_COMMIT =
  typeof __SAFEWORD_BUILD_COMMIT__ === 'string' ? __SAFEWORD_BUILD_COMMIT__ : 'development-source';

export interface RelayBuildAttestation {
  ancestorPairs: string[];
  artifactContents: Record<string, string>;
  artifactHashes: Record<string, string>;
  buildCommit: string;
  enabled: boolean;
  manifestSha256: string;
}

export const SAFEWORD_RELAY_BUILD_ATTESTATION: RelayBuildAttestation =
  typeof __SAFEWORD_RELAY_BUILD_ATTESTATION__ === 'object'
    ? __SAFEWORD_RELAY_BUILD_ATTESTATION__
    : {
        ancestorPairs: [],
        artifactContents: {},
        artifactHashes: {},
        buildCommit: 'development-source',
        enabled: false,
        manifestSha256: '',
      };

const COMMIT_PATTERN = /^[\da-f]{40}$/u;
const HASH_PATTERN = /^[\da-f]{64}$/u;
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_DRAIN_ACCEPTED_COUNT = 2;
const MIN_DRAIN_BACKLOG_SIZE = 300;
const MIN_RELAY_LATENCY_MS = 80;
const MAX_DRAIN_DURATION_MS = 1000;
const REQUIRED_MEASUREMENTS = [
  'drainThroughput',
  'sameSignatureCollisions',
  'spooledNeverFiled',
] as const;

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
    artifact.sampleSize > 0
  );
}

function parseObject(content: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(content) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function hasMeasurementShape(record: Record<string, unknown>): boolean {
  return (
    Object.keys(record)
      .toSorted((left, right) => left.localeCompare(right))
      .join('\0') ===
    ['measuredAt', 'metric', 'repository', 'result', 'sampleSize', 'version'].join('\0')
  );
}

function hasValidCountResult(result: unknown, sampleSize: number): boolean {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return false;
  if (Object.keys(result).join('\0') !== 'count') return false;
  const count = (result as { count?: unknown }).count;
  return Number.isSafeInteger(count) && (count as number) >= 0 && (count as number) <= sampleSize;
}

interface DrainThroughputResult {
  acceptedCount: unknown;
  backlogSize: unknown;
  durationMs: unknown;
  relayLatencyMs: unknown;
}

function drainThroughputResult(result: unknown): DrainThroughputResult | undefined {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return undefined;
  if (
    Object.keys(result)
      .toSorted((left, right) => left.localeCompare(right))
      .join('\0') !== ['acceptedCount', 'backlogSize', 'durationMs', 'relayLatencyMs'].join('\0')
  ) {
    return undefined;
  }
  return result as unknown as DrainThroughputResult;
}

function validAcceptedCount(value: unknown, sampleSize: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= MIN_DRAIN_ACCEPTED_COUNT &&
    (value as number) <= sampleSize
  );
}

function validBacklogSize(value: unknown, sampleSize: number): boolean {
  return Number.isSafeInteger(value) && value === sampleSize && value >= MIN_DRAIN_BACKLOG_SIZE;
}

function validDrainDuration(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < MAX_DRAIN_DURATION_MS
  );
}

function validRelayLatency(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_RELAY_LATENCY_MS;
}

function hasValidDrainThroughputResult(result: unknown, sampleSize: number): boolean {
  const measurement = drainThroughputResult(result);
  return (
    measurement !== undefined &&
    validAcceptedCount(measurement.acceptedCount, sampleSize) &&
    validBacklogSize(measurement.backlogSize, sampleSize) &&
    validDrainDuration(measurement.durationMs) &&
    validRelayLatency(measurement.relayLatencyMs)
  );
}

function hasValidResult(
  result: unknown,
  sampleSize: number,
  metric: keyof RelayReadinessManifest['measurements'],
): boolean {
  return metric === 'drainThroughput'
    ? hasValidDrainThroughputResult(result, sampleSize)
    : hasValidCountResult(result, sampleSize);
}

function validMeasurementEvidence(
  content: string,
  metric: keyof RelayReadinessManifest['measurements'],
  artifact: RelayMeasurementArtifact,
): boolean {
  const record = parseObject(content);
  if (record === undefined) return false;
  return (
    hasMeasurementShape(record) &&
    record.version === 1 &&
    record.repository === 'ArcadeAI/safeword' &&
    record.metric === metric &&
    record.measuredAt === artifact.measuredAt &&
    record.sampleSize === artifact.sampleSize &&
    hasValidResult(record.result, artifact.sampleSize, metric)
  );
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Fail-closed validation keeps every independent evidence predicate visible.
export async function validateRelayReadiness(
  manifest: RelayReadinessManifest | typeof CHECKED_IN_RELAY_READINESS,
  dependencies: {
    buildCommit: string;
    isAncestor: (ancestor: string, descendant: string) => Promise<boolean>;
    now: Date;
    readArtifactAtCommit: (
      commit: string,
      path: string,
    ) => Promise<{ content: string; sha256: string } | undefined>;
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
    if (
      Object.keys(manifest.measurements)
        .toSorted((left, right) => left.localeCompare(right))
        .join('\0') !== REQUIRED_MEASUREMENTS.join('\0')
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
    if (
      latestClose > dependencies.now.getTime() ||
      reviewedAt.getTime() > dependencies.now.getTime()
    ) {
      return { enabled: false };
    }
    for (const [metric, artifact] of Object.entries(manifest.measurements) as [
      keyof RelayReadinessManifest['measurements'],
      RelayMeasurementArtifact,
    ][]) {
      const measuredAt = validDate(artifact.measuredAt);
      if (
        !validArtifact(artifact) ||
        measuredAt === undefined ||
        measuredAt.getTime() < latestClose ||
        measuredAt.getTime() > dependencies.now.getTime() ||
        dependencies.now.getTime() - measuredAt.getTime() > MAX_EVIDENCE_AGE_MS ||
        dependencies.now.getTime() - reviewedAt.getTime() > MAX_EVIDENCE_AGE_MS
      ) {
        return { enabled: false };
      }
      const durableArtifact = await dependencies.readArtifactAtCommit(
        manifest.evidenceCommit,
        artifact.path,
      );
      if (
        durableArtifact?.sha256 !== artifact.sha256 ||
        !validMeasurementEvidence(durableArtifact.content, metric, artifact)
      ) {
        return { enabled: false };
      }
    }
    return { enabled: true };
  } catch {
    return { enabled: false };
  }
}

function manifestSha256(
  manifest: RelayReadinessManifest | typeof CHECKED_IN_RELAY_READINESS,
): string {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

export function validateBuildAttestedRelayReadiness(
  manifest: RelayReadinessManifest | typeof CHECKED_IN_RELAY_READINESS,
  attestation: RelayBuildAttestation,
  now: Date,
): Promise<{ enabled: boolean }> {
  if (
    !manifest.enabled ||
    !attestation.enabled ||
    attestation.manifestSha256 !== manifestSha256(manifest)
  ) {
    return Promise.resolve({ enabled: false });
  }
  const ancestors = new Set(attestation.ancestorPairs);
  return validateRelayReadiness(manifest, {
    buildCommit: attestation.buildCommit,
    isAncestor: (ancestor, descendant) =>
      Promise.resolve(ancestors.has(`${ancestor}:${descendant}`)),
    now,
    readArtifactAtCommit: (commit, path) => {
      const key = `${commit}:${path}`;
      const content = attestation.artifactContents[key];
      const sha256 = attestation.artifactHashes[key];
      return Promise.resolve(
        content === undefined || sha256 === undefined ? undefined : { content, sha256 },
      );
    },
  });
}
