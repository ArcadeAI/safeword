import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  measureRelayDrainThroughput,
  RELAY_LATENCY_MS,
  type RelayDrainMeasurement,
} from '../../scripts/relay-drain-measurement.js';
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

async function readinessValidation(artifact: RelayDrainMeasurement) {
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
        ? `${JSON.stringify(artifact, undefined, 2)}\n`
        : relayReadinessMeasurementContent(manifest, measurement.path);
    measurement.sha256 = createHash('sha256').update(content).digest('hex');
    artifactContent.set(measurement.path, content);
  }
  return validateRelayReadiness(manifest, {
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
}

/**
 * One virtual timeline for everything delivery times: the drain budget clock,
 * each attempt's abort timer, and the simulated relay latency. A wait advances
 * the clock and fires any timer that falls due on the way, in order, so an
 * attempt whose deadline lands inside its round trip is aborted exactly as a
 * real transport would be.
 */
function virtualTimeline() {
  let now = 0;
  const timers: { at: number; callback: () => void; live: boolean }[] = [];
  return {
    monotonicNow: () => now,
    setTimer: (callback: () => void, delayMs: number) => {
      const timer = { at: now + delayMs, callback, live: true };
      timers.push(timer);
      return () => {
        timer.live = false;
      };
    },
    wait: (milliseconds: number, signal?: AbortSignal) => {
      const until = now + milliseconds;
      const due = timers
        .filter(timer => timer.live && timer.at <= until)
        .toSorted((left, right) => left.at - right.at);
      for (const timer of due) {
        timer.live = false;
        now = timer.at;
        timer.callback();
        if (signal?.aborted === true) return Promise.reject(new Error('relay attempt aborted'));
      }
      now = until;
      return Promise.resolve();
    },
  };
}

describe('relay drain-throughput measurement producer', () => {
  // The producer's logic is proven on a virtual clock. On real time, how many
  // drafts drain inside the 750 ms budget is a property of the machine, not the
  // code: a contended CI runner has completed as few as one, which failed
  // assertions with nothing wrong in the producer. Here every relay round trip
  // costs exactly RELAY_LATENCY_MS of virtual time and nothing else moves.
  it('drains exactly the drafts whose round trip fits inside its attempt deadline', async () => {
    const artifact = await measureRelayDrainThroughput(virtualTimeline());

    // Each attempt may run for min(500, remaining − 100) ms. Attempt k starts
    // at 80k ms, so it is allowed 650 − 80k: the eighth (k = 7) gets 90 ms and
    // completes; the ninth (k = 8) gets only 10 ms and is aborted at 650 ms,
    // leaving exactly the 100 ms cleanup reserve, so the drain stops there.
    expect(artifact.result).toEqual({
      acceptedCount: 8,
      backlogSize: 300,
      durationMs: 650,
      overallDeadlineMs: 750,
      relayLatencyMs: RELAY_LATENCY_MS,
      requestDeadlineMs: 500,
    });
  });

  it('produces evidence the release readiness validator accepts', async () => {
    const artifact = await measureRelayDrainThroughput(virtualTimeline());

    expect(await readinessValidation(artifact)).toEqual({ enabled: true });
  });

  // The CLI is release tooling that measures the real machine, so its output
  // is checked for shape only. A count or duration bound here would be a
  // statement about the runner's speed, which is exactly what flaked before.
  it('writes a well-formed artifact from the command line', () => {
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

    expect(
      result.error,
      `failed to start bun: ${result.error?.message ?? 'unknown error'}`,
    ).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const artifact = JSON.parse(readFileSync(output, 'utf8')) as RelayDrainMeasurement;
    expect(artifact).toMatchObject({
      metric: 'drainThroughput',
      repository: 'ArcadeAI/safeword',
      result: {
        backlogSize: 300,
        overallDeadlineMs: 750,
        relayLatencyMs: RELAY_LATENCY_MS,
        requestDeadlineMs: 500,
      },
      sampleSize: 300,
      version: 2,
    });
    expect(new Date(artifact.measuredAt).toISOString()).toBe(artifact.measuredAt);
    expect(Number.isSafeInteger(artifact.result.acceptedCount)).toBe(true);
    expect(artifact.result.acceptedCount).toBeGreaterThanOrEqual(0);
    expect(artifact.result.acceptedCount).toBeLessThanOrEqual(artifact.result.backlogSize);
    expect(Number.isFinite(artifact.result.durationMs)).toBe(true);
    expect(artifact.result.durationMs).toBeGreaterThan(0);
  });
});
