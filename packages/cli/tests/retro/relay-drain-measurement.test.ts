import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { validateRelayReadiness } from '../../src/retro/relay-readiness.js';
import {
  relayReadinessMeasurementContent,
  validRelayReadinessManifest,
} from '../helpers/relay-readiness.js';

const directories: string[] = [];
const packageRoot = path.resolve(import.meta.dirname, '../..');

afterEach(() => {
  for (const directory of directories) rmSync(directory, { force: true, recursive: true });
  directories.length = 0;
});

describe('relay drain-throughput measurement producer', () => {
  it('writes exact validator-compatible evidence bytes', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'relay-drain-measurement-'));
    directories.push(directory);
    const output = path.join(directory, 'drain-throughput.json');
    const result = spawnSync(
      'bun',
      [path.join(packageRoot, 'scripts/measure-relay-drain-throughput.ts'), '--output', output],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        timeout: 10_000,
      },
    );

    expect(result.error, `${result.stderr}\n${result.stdout}`).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const writtenArtifact = readFileSync(output, 'utf8');
    const artifact = JSON.parse(writtenArtifact) as {
      measuredAt: string;
      metric: string;
      repository: string;
      result: {
        acceptedCount: number;
        backlogSize: number;
        durationMs: number;
        overallDeadlineMs: number;
        requestDeadlineMs: number;
        relayLatencyMs: number;
      };
      sampleSize: number;
      version: number;
    };
    expect(artifact).toMatchObject({
      metric: 'drainThroughput',
      repository: 'ArcadeAI/safeword',
      result: {
        backlogSize: 300,
        overallDeadlineMs: 750,
        requestDeadlineMs: 500,
        relayLatencyMs: 80,
      },
      sampleSize: 300,
      version: 2,
    });
    expect(new Date(artifact.measuredAt).toISOString()).toBe(artifact.measuredAt);
    const expectedSequentialCompletions = Math.floor(
      artifact.result.overallDeadlineMs / artifact.result.relayLatencyMs,
    );
    expect(
      artifact.result.acceptedCount,
      'the drain measurement must sustain the sequential deadline/latency budget',
    ).toBeGreaterThanOrEqual(expectedSequentialCompletions - 2);
    expect(
      artifact.result.acceptedCount,
      'the drain measurement must remain bounded by its configured deadline',
    ).toBeLessThanOrEqual(expectedSequentialCompletions + 1);

    const manifest = validRelayReadinessManifest();
    const closedAt = new Date(new Date(artifact.measuredAt).getTime() - 1000).toISOString();
    manifest.reviewedAt = artifact.measuredAt;
    for (const prerequisite of manifest.prerequisites) prerequisite.closedAt = closedAt;
    for (const measurement of Object.values(manifest.measurements)) {
      measurement.measuredAt = artifact.measuredAt;
    }
    manifest.measurements.drainThroughput.sampleSize = artifact.sampleSize;
    const artifactContent = new Map<string, string>();
    for (const [metric, measurement] of Object.entries(manifest.measurements)) {
      const content =
        metric === 'drainThroughput'
          ? writtenArtifact
          : relayReadinessMeasurementContent(manifest, measurement.path);
      measurement.sha256 = createHash('sha256').update(content).digest('hex');
      artifactContent.set(measurement.path, content);
    }

    const validation = await validateRelayReadiness(manifest, {
      buildCommit: 'b'.repeat(40),
      isAncestor: () => Promise.resolve(true),
      now: new Date(artifact.measuredAt),
      readArtifactAtCommit: (_commit, artifactPath) => {
        const content = artifactContent.get(artifactPath);
        if (content === undefined) return Promise.resolve(undefined);
        const sha256 = createHash('sha256').update(content).digest('hex');
        return Promise.resolve({ content, sha256 });
      },
    });
    expect(validation).toEqual({ enabled: true });
  });
});
