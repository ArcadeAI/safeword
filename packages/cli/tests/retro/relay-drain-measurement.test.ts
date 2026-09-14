import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
const packageRoot = path.resolve(import.meta.dirname, '../..');

afterEach(() => {
  for (const directory of directories) rmSync(directory, { force: true, recursive: true });
  directories.length = 0;
});

describe('relay drain-throughput measurement producer', () => {
  it('writes validator-compatible evidence and clears multiple relay-latency windows', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'relay-drain-measurement-'));
    directories.push(directory);
    const output = path.join(directory, 'drain-throughput.json');
    const result = spawnSync(
      'bun',
      [path.join(packageRoot, 'scripts/measure-relay-drain-throughput.ts'), '--output', output],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        timeout: 5000,
      },
    );

    expect(result.status, result.stderr).toBe(0);
    const artifact = JSON.parse(readFileSync(output, 'utf8')) as {
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
        relayLatencyMs: 40,
      },
      sampleSize: 300,
      version: 2,
    });
    expect(new Date(artifact.measuredAt).toISOString()).toBe(artifact.measuredAt);
    expect(artifact.result.acceptedCount).toBeGreaterThanOrEqual(12);
    expect(artifact.result.durationMs).toBeLessThan(1000);
  });
});
