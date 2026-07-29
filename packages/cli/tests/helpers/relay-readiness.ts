import type { RelayReadinessManifest } from '../../src/retro/relay-readiness.js';

export function validRelayReadinessManifest(): RelayReadinessManifest {
  return {
    enabled: true,
    evidenceCommit: 'a'.repeat(40),
    measurements: {
      sameSignatureCollisions: {
        measuredAt: '2026-07-25T00:00:00.000Z',
        path: 'measurements/collisions.json',
        sampleSize: 100,
        sha256: '1'.repeat(64),
      },
      spooledNeverFiled: {
        measuredAt: '2026-07-25T00:00:00.000Z',
        path: 'measurements/spooled.json',
        sampleSize: 100,
        sha256: '2'.repeat(64),
      },
    },
    prerequisites: [
      {
        closedAt: '2026-07-24T00:00:00.000Z',
        issue: 1474,
        mergedCommit: 'c'.repeat(40),
        state: 'closed',
        url: 'https://github.com/ArcadeAI/safeword/issues/1474',
      },
      {
        closedAt: '2026-07-24T00:00:00.000Z',
        issue: 1481,
        mergedCommit: 'd'.repeat(40),
        state: 'closed',
        url: 'https://github.com/ArcadeAI/safeword/issues/1481',
      },
    ],
    reviewedAt: '2026-07-26T00:00:00.000Z',
    version: 1,
  };
}

export function relayReadinessMeasurementContent(
  manifest: RelayReadinessManifest,
  artifactPath: string,
): string {
  const metric = artifactPath.endsWith('collisions.json')
    ? 'sameSignatureCollisions'
    : 'spooledNeverFiled';
  const artifact = manifest.measurements[metric];
  return JSON.stringify({
    measuredAt: artifact.measuredAt,
    metric,
    repository: 'ArcadeAI/safeword',
    result: { count: 0 },
    sampleSize: artifact.sampleSize,
    version: 1,
  });
}

export function relayReadinessArtifact(
  manifest: RelayReadinessManifest,
  artifactPath: string,
): { content: string; sha256: string } {
  const metric = artifactPath.endsWith('collisions.json')
    ? 'sameSignatureCollisions'
    : 'spooledNeverFiled';
  return {
    content: relayReadinessMeasurementContent(manifest, artifactPath),
    sha256: manifest.measurements[metric].sha256,
  };
}
