import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  DEFAULT_RELAY_REQUEST_DEADLINE_MS,
  deliverRelayRequests,
  persistRelayDraftBatch,
  RELAY_OVERALL_HEADROOM_MS,
  type RelayDraftRequest,
} from '../src/retro/relay-delivery.js';

const BACKLOG_SIZE = 300;
// Match the minimum latency accepted by the readiness validator while leaving
// enough headroom for heavily contended CI runners to observe the real 750 ms
// drain deadline without a scheduler-delay false negative against the 1 s gate.
export const RELAY_LATENCY_MS = 80;
const REQUEST_DEADLINE_MS = DEFAULT_RELAY_REQUEST_DEADLINE_MS;
const DRAIN_BUDGET_MS = REQUEST_DEADLINE_MS + RELAY_OVERALL_HEADROOM_MS;

export interface RelayDrainMeasurement {
  measuredAt: string;
  metric: 'drainThroughput';
  repository: 'ArcadeAI/safeword';
  result: {
    acceptedCount: number;
    backlogSize: number;
    durationMs: number;
    overallDeadlineMs: number;
    relayLatencyMs: number;
    requestDeadlineMs: number;
  };
  sampleSize: number;
  version: 2;
}

/**
 * Time sources for one measurement. Production leaves both unset and measures
 * real wall-clock throughput — that is the whole point of the evidence. Tests
 * supply a virtual clock and a wait that advances it, so the producer's logic
 * can be proven exactly without asking a shared CI runner to be fast.
 */
export interface RelayDrainClock {
  monotonicNow?: () => number;
  /** Arms delivery's per-attempt abort timer; see `deliverRelayRequests`. */
  setTimer?: (callback: () => void, delayMs: number) => () => void;
  /** Simulated relay latency. Must reject once `signal` aborts. */
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
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

function measurementRelay(
  wait: (milliseconds: number, signal?: AbortSignal) => Promise<void>,
): typeof fetch {
  return async (_input, init) => {
    // Honor cancellation like a real transport. Ignoring the abort would let a
    // request that overran its attempt deadline still count as accepted, and
    // the readiness evidence would overstate throughput.
    await wait(RELAY_LATENCY_MS, init?.signal ?? undefined);
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
  };
}

/** Drains a durable 300-draft backlog against a fixed-latency relay and reports throughput. */
export async function measureRelayDrainThroughput(
  clock: RelayDrainClock = {},
): Promise<RelayDrainMeasurement> {
  const monotonicNow = clock.monotonicNow ?? (() => performance.now());
  const wait =
    clock.wait ??
    (async (milliseconds: number, signal?: AbortSignal) => {
      await delay(milliseconds, undefined, { signal });
    });
  const spool = await mkdtemp(path.join(tmpdir(), 'safeword-relay-drain-'));
  try {
    const persistence = await persistRelayDraftBatch(spool, measurementDrafts());
    if (persistence.some(result => result.status === 'rejected')) {
      throw new Error('failed to prepare the durable drain measurement backlog');
    }

    const started = monotonicNow();
    const result = await deliverRelayRequests(spool, {
      credential: 'measurement-only',
      deadlineMs: REQUEST_DEADLINE_MS,
      fetch: measurementRelay(wait),
      monotonicNow,
      now: Date.now,
      ...(clock.setTimer && { setTimer: clock.setTimer }),
      overallDeadlineMs: DRAIN_BUDGET_MS,
      relayUrl: 'https://relay.invalid',
    });
    return {
      measuredAt: new Date().toISOString(),
      metric: 'drainThroughput',
      repository: 'ArcadeAI/safeword',
      result: {
        acceptedCount: result.accepted,
        backlogSize: BACKLOG_SIZE,
        durationMs: monotonicNow() - started,
        overallDeadlineMs: DRAIN_BUDGET_MS,
        relayLatencyMs: RELAY_LATENCY_MS,
        requestDeadlineMs: REQUEST_DEADLINE_MS,
      },
      sampleSize: BACKLOG_SIZE,
      version: 2,
    };
  } finally {
    await rm(spool, { force: true, recursive: true });
  }
}
