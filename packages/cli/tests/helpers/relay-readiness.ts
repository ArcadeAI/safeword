import type { RelayReadinessManifest } from '../../src/retro/relay-readiness.js';

export function validRelayReadinessManifest(): RelayReadinessManifest {
  return {
    enabled: true,
    evidenceCommit: 'a'.repeat(40),
    measurements: {
      drainThroughput: {
        measuredAt: '2026-07-25T00:00:00.000Z',
        path: 'measurements/drain-throughput.json',
        sampleSize: 300,
        sha256: '3'.repeat(64),
      },
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
  const metric = measurementMetric(manifest, artifactPath);
  const artifact = manifest.measurements[metric];
  return JSON.stringify({
    measuredAt: artifact.measuredAt,
    metric,
    repository: 'ArcadeAI/safeword',
    result:
      metric === 'drainThroughput'
        ? {
            acceptedCount: 2,
            backlogSize: artifact.sampleSize,
            durationMs: 999,
            relayLatencyMs: 80,
          }
        : { count: 0 },
    sampleSize: artifact.sampleSize,
    version: 1,
  });
}

export function relayReadinessArtifact(
  manifest: RelayReadinessManifest,
  artifactPath: string,
): { content: string; sha256: string } {
  const metric = measurementMetric(manifest, artifactPath);
  return {
    content: relayReadinessMeasurementContent(manifest, artifactPath),
    sha256: manifest.measurements[metric].sha256,
  };
}

function measurementMetric(
  manifest: RelayReadinessManifest,
  artifactPath: string,
): keyof RelayReadinessManifest['measurements'] {
  const entry = Object.entries(manifest.measurements).find(
    ([, artifact]) => artifact.path === artifactPath,
  );
  if (entry === undefined) throw new Error(`unknown relay readiness artifact: ${artifactPath}`);
  return entry[0] as keyof RelayReadinessManifest['measurements'];
}
