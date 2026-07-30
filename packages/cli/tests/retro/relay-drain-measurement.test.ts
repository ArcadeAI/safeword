import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) rmSync(directory, { force: true, recursive: true });
  directories.length = 0;
});

describe('relay drain-throughput measurement producer', () => {
  it('writes validator-compatible evidence by measuring the real durable spool', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'relay-drain-measurement-'));
    directories.push(directory);
    const output = path.join(directory, 'drain-throughput.json');
    const result = spawnSync(
      'bun',
      [path.resolve('scripts/measure-relay-drain-throughput.ts'), '--output', output],
      {
        cwd: path.resolve('.'),
        encoding: 'utf8',
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
        relayLatencyMs: 80,
      },
      sampleSize: 300,
      version: 1,
    });
    expect(new Date(artifact.measuredAt).toISOString()).toBe(artifact.measuredAt);
    expect(artifact.result.acceptedCount).toBeGreaterThanOrEqual(2);
    expect(artifact.result.durationMs).toBeGreaterThanOrEqual(0);
    expect(artifact.result.durationMs).toBeLessThan(1000);
  });
});
