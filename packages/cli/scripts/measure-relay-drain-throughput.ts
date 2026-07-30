import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import {
  deliverRelayRequests,
  persistRelayDraftBatch,
  type RelayDraftRequest,
} from '../src/retro/relay-delivery.js';

const BACKLOG_SIZE = 300;
const DRAIN_BUDGET_MS = 650;
const RELAY_LATENCY_MS = 80;
const REQUEST_DEADLINE_MS = 150;

function outputPath(arguments_: string[]): string {
  const flag = arguments_.indexOf('--output');
  const value = flag === -1 ? undefined : arguments_[flag + 1];
  if (flag === -1 || value === undefined || value.trim().length === 0) {
    throw new Error('usage: measure-relay-drain-throughput --output <artifact.json>');
  }
  return path.resolve(value);
}

function measurementDrafts() {
  return Array.from({ length: BACKLOG_SIZE }, (_, index) => ({
    body: `Drain measurement body ${index}`,
    canonicalKey: `drain-measurement-${index}`,
    installationId: 42,
    labels: ['retro'],
    legacySignature: `drain-measurement-${index}`,
    repository: 'arcadeai/safeword',
    sourceKey: `drain-measurement-${index}`,
    title: `Drain measurement ${index}`,
  }));
}

async function main(): Promise<void> {
  const output = outputPath(process.argv.slice(2));
  const spool = await mkdtemp(path.join(tmpdir(), 'safeword-relay-drain-'));
  try {
    const persistence = await persistRelayDraftBatch(spool, measurementDrafts());
    if (persistence.some(result => result.status === 'rejected')) {
      throw new Error('failed to prepare the durable drain measurement backlog');
    }

    const started = performance.now();
    const result = await deliverRelayRequests(spool, {
      credential: 'measurement-only',
      deadlineMs: REQUEST_DEADLINE_MS,
      fetch: async (_input, init) => {
        await delay(RELAY_LATENCY_MS);
        const request = JSON.parse(
          Buffer.from(init?.body as Uint8Array).toString('utf8'),
        ) as RelayDraftRequest;
        return Response.json(
          {
            receiptId: `measurement-${request.requestId}`,
            requestId: request.requestId,
            state: 'accepted',
          },
          { status: 202 },
        );
      },
      now: Date.now,
      overallDeadlineMs: DRAIN_BUDGET_MS,
      relayUrl: 'https://relay.invalid',
    });
    const durationMs = performance.now() - started;
    const artifact = {
      measuredAt: new Date().toISOString(),
      metric: 'drainThroughput',
      repository: 'ArcadeAI/safeword',
      result: {
        acceptedCount: result.accepted,
        backlogSize: BACKLOG_SIZE,
        durationMs,
        relayLatencyMs: RELAY_LATENCY_MS,
      },
      sampleSize: BACKLOG_SIZE,
      version: 1,
    };
    await writeFile(output, `${JSON.stringify(artifact, undefined, 2)}\n`, 'utf8');
  } finally {
    await rm(spool, { force: true, recursive: true });
  }
}

await main();
