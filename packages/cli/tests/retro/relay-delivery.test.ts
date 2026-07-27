import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import type { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAutoExtractor } from '../../src/commands/retro.js';
import {
  acknowledgeRelayClaim,
  claimRelayRequest,
  createRelayRequest,
  deliverRelayRequests,
  listRelayRequests,
  persistRelayRequest,
  recoverRelaySpool,
} from '../../src/retro/relay-delivery.js';
import {
  CHECKED_IN_RELAY_READINESS,
  type RelayReadinessManifest,
  validateRelayReadiness,
} from '../../src/retro/relay-readiness.js';

const directories: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  const openServers = [...servers];
  servers.length = 0;
  for (const server of openServers) {
    await new Promise<void>(resolve =>
      server.close(() => {
        resolve();
      }),
    );
  }
  const usedDirectories = [...directories];
  directories.length = 0;
  for (const directory of usedDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function temporaryProject(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-spool-'));
  directories.push(directory);
  return directory;
}

function request(overrides: Record<string, unknown> = {}) {
  return createRelayRequest(
    {
      installationId: 42,
      repository: 'arcadeai/safeword',
      canonicalKey: 'canonical:abc123',
      legacySignature: 'retro:def456',
      title: 'Retry-safe filing',
      body: 'Sanitized body',
      labels: ['retro'],
      ...overrides,
    },
    { randomUUID },
  );
}

describe('immutable relay delivery spool', () => {
  it('persists UUIDv4 request identity and exact serialized bytes once', async () => {
    const project = temporaryProject();
    const original = request();
    const persisted = await persistRelayRequest(project, original);

    expect(original.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(readFileSync(persisted.path)).toEqual(persisted.bytes);

    await expect(
      persistRelayRequest(project, { ...original, title: 'Re-rendered title' }),
    ).rejects.toThrow('different payload');
    expect(readFileSync(persisted.path)).toEqual(persisted.bytes);
  });

  it('claims exclusively, rearms expiry, and prevents stale-owner cleanup', async () => {
    const project = temporaryProject();
    const original = request();
    await persistRelayRequest(project, original);
    const first = await claimRelayRequest(project, {
      claimId: 'first',
      leaseMs: 100,
      now: 1000,
    });
    expect(first?.bytes.toString()).toBe(JSON.stringify(original));
    await expect(
      claimRelayRequest(project, { claimId: 'second', leaseMs: 100, now: 1050 }),
    ).resolves.toBeUndefined();

    const successor = await claimRelayRequest(project, {
      claimId: 'second',
      leaseMs: 100,
      now: 1101,
    });
    if (first === undefined || successor === undefined) throw new Error('expected both claims');
    expect(successor?.requestId).toBe(original.requestId);
    expect(successor?.bytes).toEqual(first?.bytes);

    await expect(
      acknowledgeRelayClaim(first, {
        receiptId: 'receipt-old',
        requestId: original.requestId,
        state: 'filed',
        issueNumber: 1479,
      }),
    ).resolves.toBe(false);
    expect(readdirSync(path.dirname(successor.path))).toContain(path.basename(successor.path));
  });

  it('uses ack as the authoritative commit and recovers crash-before-cleanup', async () => {
    const project = temporaryProject();
    const original = request();
    await persistRelayRequest(project, original);
    const claim = await claimRelayRequest(project, { claimId: 'owner', leaseMs: 1000, now: 0 });
    if (claim === undefined) throw new Error('expected claim');

    await expect(
      acknowledgeRelayClaim(
        claim,
        {
          receiptId: 'receipt-1',
          requestId: original.requestId,
          state: 'filed',
          issueNumber: 1479,
        },
        { faultAfterAck: () => Promise.reject(new Error('crash')) },
      ),
    ).rejects.toThrow('crash');

    await recoverRelaySpool(project, 1);
    expect(await listRelayRequests(project)).toEqual([]);
    const ackPath = path.join(
      project,
      '.safeword',
      'retro-drafts',
      'relay',
      `${original.requestId}.ack.json`,
    );
    const ack = JSON.parse(readFileSync(ackPath, 'utf8')) as unknown;
    expect(ack).toMatchObject({ requestId: original.requestId, receiptId: 'receipt-1' });
  });

  it('cannot lose a concurrent request while another request is acknowledged', async () => {
    const project = temporaryProject();
    const firstRequest = request({ title: 'First' });
    const secondRequest = request({ title: 'Second' });
    await persistRelayRequest(project, firstRequest);
    const firstClaim = await claimRelayRequest(project, {
      claimId: 'first',
      leaseMs: 1000,
      now: 0,
    });
    if (firstClaim === undefined) throw new Error('expected first claim');

    await Promise.all([
      acknowledgeRelayClaim(firstClaim, {
        receiptId: 'receipt-first',
        requestId: firstRequest.requestId,
        state: 'filed',
      }),
      persistRelayRequest(project, secondRequest),
    ]);

    const remaining = await listRelayRequests(project);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.requestId).toBe(secondRequest.requestId);
    expect(remaining[0]?.bytes.toString()).toBe(JSON.stringify(secondRequest));
  });

  it('returns before one second and never invokes native fallback after a lost response', async () => {
    const project = temporaryProject();
    const original = request();
    await persistRelayRequest(project, original);
    const nativeFallback = vi.fn();
    const started = performance.now();

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
      nativeFallback,
      now: () => Date.now(),
      relayUrl: 'https://relay.invalid',
    });

    expect(performance.now() - started).toBeLessThan(1000);
    expect(outcome).toEqual({ accepted: 0, retryable: 1 });
    expect(nativeFallback).not.toHaveBeenCalled();
    const retryable = await listRelayRequests(project);
    expect(retryable[0]?.bytes.toString()).toBe(JSON.stringify(original));
  });
});

function validManifest(): RelayReadinessManifest {
  const evidenceCommit = 'a'.repeat(40);
  return {
    enabled: true,
    evidenceCommit,
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

describe('relay readiness provenance', () => {
  it('keeps the checked-in public route disabled', () => {
    expect(CHECKED_IN_RELAY_READINESS).toEqual({ enabled: false, version: 1 });
  });

  it('accepts only fresh evidence reachable from the immutable build', async () => {
    const manifest = validManifest();
    const result = await validateRelayReadiness(manifest, {
      buildCommit: 'b'.repeat(40),
      isAncestor: (ancestor, descendant) =>
        Promise.resolve(
          descendant === 'b'.repeat(40) &&
            [
              manifest.evidenceCommit,
              ...manifest.prerequisites.map(item => item.mergedCommit),
            ].includes(ancestor),
        ),
      now: new Date('2026-07-26T12:00:00.000Z'),
      readArtifactAtCommit: (_commit, artifactPath) =>
        Promise.resolve(
          artifactPath.endsWith('collisions.json')
            ? { sha256: '1'.repeat(64) }
            : { sha256: '2'.repeat(64) },
        ),
    });
    expect(result).toEqual({ enabled: true });
  });

  it.each([
    ['unlanded prerequisite', (value: RelayReadinessManifest) => value],
    [
      'wrong repository',
      (value: RelayReadinessManifest) => {
        value.prerequisites[0].url = 'https://github.com/other/repo/issues/1474';
        return value;
      },
    ],
    [
      'other build',
      (value: RelayReadinessManifest) => {
        value.evidenceCommit = 'e'.repeat(40);
        return value;
      },
    ],
    [
      'stale measurement',
      (value: RelayReadinessManifest) => {
        value.measurements.sameSignatureCollisions.measuredAt = '2026-01-01T00:00:00.000Z';
        return value;
      },
    ],
  ])('fails closed for %s evidence', async (kind, mutate) => {
    const manifest = mutate(validManifest());
    const result = await validateRelayReadiness(manifest, {
      buildCommit: 'b'.repeat(40),
      isAncestor: ancestor =>
        Promise.resolve(
          (kind !== 'unlanded prerequisite' || ancestor !== 'c'.repeat(40)) &&
            (kind !== 'other build' || ancestor !== 'e'.repeat(40)),
        ),
      now: new Date('2026-07-26T12:00:00.000Z'),
      readArtifactAtCommit: (_commit, artifactPath) =>
        Promise.resolve({
          sha256: artifactPath.endsWith('collisions.json') ? '1'.repeat(64) : '2'.repeat(64),
        }),
    });
    expect(result.enabled).toBe(false);
  });
});

describe('headless extraction credential boundary', () => {
  it('constructs a minimal child environment without filing credentials', async () => {
    const project = temporaryProject();
    const observed: Record<string, string | undefined>[] = [];
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY_BASE64', 'github-app-secret');
    vi.stubEnv('GITHUB_TOKEN', 'github-token');
    vi.stubEnv('RELAY_CREDENTIAL_SECRET', 'server-secret');
    vi.stubEnv('SAFEWORD_RETRO_RELAY_CREDENTIAL', 'client-secret');
    try {
      const extract = await buildAutoExtractor(project, {
        model: 'sonnet',
        spawn: (_argv, options) => {
          observed.push(options.env);
          return Promise.resolve({
            code: 0,
            stdout: JSON.stringify({
              is_error: false,
              result: '[]',
              subtype: 'success',
              type: 'result',
            }),
          });
        },
      });
      await extract('transcript');
    } finally {
      vi.unstubAllEnvs();
    }

    expect(observed).toHaveLength(1);
    expect(observed[0]).not.toHaveProperty('SAFEWORD_RETRO_RELAY_CREDENTIAL');
    expect(observed[0]).not.toHaveProperty('RELAY_CREDENTIAL_SECRET');
    expect(observed[0]).not.toHaveProperty('GITHUB_APP_PRIVATE_KEY_BASE64');
    expect(observed[0]).not.toHaveProperty('GITHUB_TOKEN');
    expect(observed[0]).toHaveProperty('PATH');
  });
});
