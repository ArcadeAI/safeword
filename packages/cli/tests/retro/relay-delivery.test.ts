import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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
  listRelayDeadLetters,
  listRelayRequests,
  persistRelayDraft,
  persistRelayRequest,
  rearmRelayDeadLetter,
  recoverRelaySpool,
  type RelayDraftRequest,
  relaySourceKey,
} from '../../src/retro/relay-delivery.js';
import {
  CHECKED_IN_RELAY_READINESS,
  type RelayReadinessManifest,
  validateBuildAttestedRelayReadiness,
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
      sourceKey: 'source-default',
      ...overrides,
    },
    { randomUUID },
  );
}

describe('immutable relay delivery spool', () => {
  it('derives the same source identity regardless of payload property insertion order', () => {
    const first = {
      body: 'body',
      canonicalKey: 'canonical',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'legacy',
      repository: 'arcadeai/safeword',
      title: 'title',
    };
    const reordered = {
      title: first.title,
      repository: first.repository,
      legacySignature: first.legacySignature,
      labels: first.labels,
      installationId: first.installationId,
      canonicalKey: first.canonicalKey,
      body: first.body,
    };

    expect(relaySourceKey('session', 1000, first)).toBe(relaySourceKey('session', 1000, reordered));
  });

  it('persists unrelated findings independently while retaining per-source identity', async () => {
    const project = temporaryProject();
    const firstDraft = {
      body: 'first body',
      canonicalKey: 'canonical:first',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'retro:first',
      repository: 'arcadeai/safeword',
      sourceKey: 'session:0',
      title: 'First',
    };
    const first = await persistRelayDraft(project, firstDraft);
    const second = await persistRelayDraft(project, {
      ...firstDraft,
      body: 'second body',
      canonicalKey: 'canonical:second',
      legacySignature: 'retro:second',
      sourceKey: 'session:1',
      title: 'Second',
    });
    const repeated = await persistRelayDraft(project, firstDraft);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(repeated?.requestId).toBe(first?.requestId);
    expect(await listRelayRequests(project)).toHaveLength(2);
  });

  it('atomically reserves one request identity across simultaneous source persistence', async () => {
    const project = temporaryProject();
    const draft = {
      body: 'one body',
      canonicalKey: 'canonical:one',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'retro:one',
      repository: 'arcadeai/safeword',
      sourceKey: 'one-source',
      title: 'One',
    };

    const persisted = await Promise.all(
      Array.from({ length: 20 }, () => persistRelayDraft(project, draft)),
    );

    expect(new Set(persisted.map(item => item?.requestId)).size).toBe(1);
    expect(await listRelayRequests(project)).toHaveLength(1);
  });

  it('rejects a source reservation whose nested request identity was altered', async () => {
    const project = temporaryProject();
    const draft = {
      body: 'reserved body',
      canonicalKey: 'canonical:reserved',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'retro:reserved',
      repository: 'arcadeai/safeword',
      sourceKey: 'reserved-source',
      title: 'Reserved',
    };
    const original = await persistRelayDraft(project, draft);
    if (original === undefined) throw new Error('missing original request');
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    const sourceFile = readdirSync(directory).find(filename => filename.startsWith('source-'));
    if (sourceFile === undefined) throw new Error('missing source reservation');
    const sourcePath = path.join(directory, sourceFile);
    const reservation = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
      request: { sourceKey: string };
    };
    reservation.request.sourceKey = 'altered-source';
    writeFileSync(sourcePath, JSON.stringify(reservation));

    await expect(persistRelayDraft(project, draft)).rejects.toThrow(
      'source identity was reused with a different payload',
    );
    const requests = await listRelayRequests(project);
    expect(requests.map(item => item.requestId)).toEqual([original.requestId]);
  });

  it.each(['active', 'dead-letter', 'acknowledgement'] as const)(
    'never re-identifies a source after corrupt %s bytes',
    async state => {
      const project = temporaryProject();
      const draft = {
        body: 'durable body',
        canonicalKey: 'canonical:durable',
        installationId: 42,
        labels: ['retro'],
        legacySignature: 'retro:durable',
        repository: 'arcadeai/safeword',
        sourceKey: `durable-${state}`,
        title: 'Durable',
      };
      const original = await persistRelayDraft(project, draft);
      if (original === undefined) throw new Error('missing original request');
      const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
      const active = path.join(directory, `${original.requestId}.json`);

      if (state === 'dead-letter') {
        const deadLetter = path.join(directory, `${original.requestId}.dead-letter.json`);
        renameSync(active, deadLetter);
        writeFileSync(deadLetter, '{"requestId":');
      } else if (state === 'acknowledgement') {
        const claim = await claimRelayRequest(project, {
          claimId: 'owner',
          leaseMs: 1000,
          now: 0,
        });
        if (claim === undefined) throw new Error('missing claim');
        await acknowledgeRelayClaim(claim, {
          receiptId: 'receipt-corrupt',
          requestId: original.requestId,
          state: 'filed',
        });
        const sourceFile = readdirSync(directory).find(filename => filename.startsWith('source-'));
        if (sourceFile === undefined) throw new Error('missing source reservation');
        const compacted = readFileSync(path.join(directory, sourceFile), 'utf8');
        expect(compacted).not.toContain(draft.body);
        expect(compacted).not.toContain(draft.title);
        writeFileSync(path.join(directory, `${original.requestId}.ack.json`), '{"requestId":');
      } else {
        writeFileSync(active, '{"requestId":');
      }

      const repeated = persistRelayDraft(project, draft);
      if (state === 'acknowledgement') await expect(repeated).resolves.toBeUndefined();
      else await expect(repeated).rejects.toThrow('different payload');
      const requestFiles = readdirSync(directory).filter(filename =>
        /^[\da-f]{8}-/u.test(filename),
      );
      expect(requestFiles.every(filename => filename.startsWith(original.requestId))).toBe(true);
    },
  );

  it('isolates corrupt bytes when their source reservation proves they belong to another draft', async () => {
    const project = temporaryProject();
    const poisoned = await persistRelayDraft(project, {
      body: 'poisoned body',
      canonicalKey: 'canonical:poisoned',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'retro:poisoned',
      repository: 'arcadeai/safeword',
      sourceKey: 'source-poisoned',
      title: 'Poisoned',
    });
    if (poisoned === undefined) throw new Error('missing poisoned request');
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    writeFileSync(path.join(directory, `${poisoned.requestId}.json`), '{"requestId":');

    await expect(
      persistRelayDraft(project, {
        body: 'healthy body',
        canonicalKey: 'canonical:healthy',
        installationId: 42,
        labels: ['retro'],
        legacySignature: 'retro:healthy',
        repository: 'arcadeai/safeword',
        sourceKey: 'source-healthy',
        title: 'Healthy',
      }),
    ).resolves.toMatchObject({ sourceKey: 'source-healthy' });
  });

  it('never lets a semantic source collision silently replace immutable payload', async () => {
    const project = temporaryProject();
    const original = {
      body: 'first body',
      canonicalKey: 'canonical:collision',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'retro:collision',
      repository: 'arcadeai/safeword',
      sourceKey: 'same-source',
      title: 'First',
    };
    await persistRelayDraft(project, original);

    await expect(
      persistRelayDraft(project, { ...original, body: 'different body', title: 'Second' }),
    ).rejects.toThrow('source identity was reused with a different payload');
    expect(await listRelayRequests(project)).toHaveLength(1);
  });

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
    expect(readdirSync(path.dirname(ackPath))).not.toContain(path.basename(ackPath));
    const sourceFile = readdirSync(path.dirname(ackPath)).find(filename =>
      filename.startsWith('source-'),
    );
    if (sourceFile === undefined) throw new Error('missing source reservation');
    const compactedSource = readFileSync(path.join(path.dirname(ackPath), sourceFile), 'utf8');
    expect(compactedSource).not.toContain(original.body);
    expect(compactedSource).not.toContain(original.title);
    expect(JSON.parse(compactedSource)).toMatchObject({
      requestId: original.requestId,
      state: 'acknowledged',
    });

    await expect(
      persistRelayDraft(project, {
        body: 'changed after acknowledgement',
        canonicalKey: original.canonicalKey,
        installationId: original.installationId,
        labels: original.labels,
        legacySignature: original.legacySignature,
        repository: original.repository,
        sourceKey: original.sourceKey,
        title: original.title,
      }),
    ).rejects.toThrow('source identity was reused with a different payload');
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
      now: () => Date.now(),
      relayUrl: 'https://relay.invalid',
    });

    expect(performance.now() - started).toBeLessThan(1000);
    expect(outcome).toEqual({
      accepted: 0,
      deadLetterBacklog: 0,
      deadLettered: 0,
      retryable: 1,
    });
    const retryable = await listRelayRequests(project);
    expect(retryable[0]?.bytes.toString()).toBe(JSON.stringify(original));
  });

  it('moves a draft to a visible dead letter at the shared 24-hour deadline', async () => {
    const project = temporaryProject();
    const createdAt = Date.parse('2026-07-01T00:00:00.000Z');
    const original = createRelayRequest(
      {
        body: 'body',
        canonicalKey: 'canonical:key',
        installationId: 42,
        labels: ['retro'],
        legacySignature: 'retro:signature',
        repository: 'arcadeai/safeword',
        sourceKey: 'source-dead-letter',
        title: 'title',
      },
      {
        now: () => createdAt,
        randomUUID: () => '00000000-0000-4000-8000-000000000147',
      },
    );
    await persistRelayRequest(project, original);
    const send = vi.fn<typeof fetch>();

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: send,
      now: () => createdAt + 24 * 60 * 60 * 1000,
      relayUrl: 'https://relay.invalid',
    });

    expect(outcome).toEqual({
      accepted: 0,
      deadLetterBacklog: 1,
      deadLettered: 1,
      retryable: 0,
    });
    expect(send).not.toHaveBeenCalled();
    expect(await listRelayRequests(project)).toEqual([]);
    await expect(
      readFile(
        path.join(
          project,
          '.safeword',
          'retro-drafts',
          'relay',
          `${original.requestId}.dead-letter.json`,
        ),
        'utf8',
      ),
    ).resolves.toContain('"requestId":"00000000-0000-4000-8000-000000000147"');

    await expect(persistRelayRequest(project, original)).resolves.toMatchObject({
      path: expect.stringContaining('.dead-letter.json'),
    });
    expect(await listRelayDeadLetters(project)).toHaveLength(1);
    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: send,
        now: () => createdAt + 24 * 60 * 60 * 1000,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toEqual({
      accepted: 0,
      deadLetterBacklog: 1,
      deadLettered: 0,
      retryable: 0,
    });

    const unrelated = await persistRelayDraft(project, {
      body: 'new body',
      canonicalKey: 'canonical:new',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'retro:new',
      repository: 'arcadeai/safeword',
      sourceKey: 'source-new',
      title: 'New finding',
    });
    expect(unrelated?.requestId).not.toBe(original.requestId);
    expect(await listRelayRequests(project)).toHaveLength(1);
  });

  it('quarantines corrupt bytes once instead of retrying them forever', async () => {
    const project = temporaryProject();
    const persisted = await persistRelayRequest(project, request());
    writeFileSync(persisted.path, '{"requestId":');
    const send = vi.fn<typeof fetch>();

    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: send,
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({ deadLetterBacklog: 1, deadLettered: 1, retryable: 0 });
    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: send,
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({ deadLetterBacklog: 1, deadLettered: 0, retryable: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('dead-letters terminal relay failures but rearms retryable failures', async () => {
    const project = temporaryProject();
    const terminal = request({ sourceKey: 'terminal' });
    await persistRelayRequest(project, terminal);

    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: () => Promise.resolve(Response.json({ error: 'forbidden' }, { status: 403 })),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({ deadLetterBacklog: 1, deadLettered: 1, retryable: 0 });
    expect(await listRelayRequests(project)).toHaveLength(0);

    expect(await rearmRelayDeadLetter(project, terminal.requestId)).toBe(true);
    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: () => Promise.resolve(Response.json({ error: 'busy' }, { status: 429 })),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({ deadLetterBacklog: 0, deadLettered: 0, retryable: 1 });
    expect(await listRelayRequests(project)).toHaveLength(1);
    expect(await rearmRelayDeadLetter(project, terminal.requestId)).toBe(false);
  });

  it('keeps authentication failures queued for credential rotation', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request());

    await expect(
      deliverRelayRequests(project, {
        credential: 'expired-client-credential',
        deadlineMs: 25,
        fetch: () => Promise.resolve(Response.json({ error: 'unauthorized' }, { status: 401 })),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({ deadLettered: 0, retryable: 1 });
    expect(await listRelayRequests(project)).toHaveLength(1);
    expect(await listRelayDeadLetters(project)).toHaveLength(0);
  });

  it('rejects non-UUID dead-letter identities before resolving a filesystem path', async () => {
    const project = temporaryProject();

    await expect(rearmRelayDeadLetter(project, '../../outside')).rejects.toThrow(
      'invalid relay request identity',
    );
  });

  it('never overwrites an active request while rearming the same dead letter', async () => {
    const project = temporaryProject();
    const active = request();
    const persisted = await persistRelayRequest(project, active);
    const deadLetter = persisted.path.replace(/\.json$/u, '.dead-letter.json');
    writeFileSync(deadLetter, JSON.stringify({ ...active, body: 'dead-letter bytes' }));

    await expect(rearmRelayDeadLetter(project, active.requestId)).rejects.toThrow('already active');
    expect(readFileSync(persisted.path, 'utf8')).toBe(JSON.stringify(active));
    expect(readFileSync(deadLetter, 'utf8')).toContain('dead-letter bytes');
  });

  it('bounds the whole drain and leaves unattempted requests durably spooled', async () => {
    const project = temporaryProject();
    for (const [index, title] of ['first', 'second', 'third'].entries()) {
      await persistRelayRequest(
        project,
        request({
          requestId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          title,
        }),
      );
    }
    let now = 0;
    const send = vi.fn<typeof fetch>((_input, init) => {
      now += 10;
      if (!(init?.body instanceof Uint8Array)) throw new Error('missing relay request body');
      const sent = JSON.parse(Buffer.from(init.body).toString('utf8')) as RelayDraftRequest;
      return Promise.resolve(
        Response.json(
          {
            receiptId: `receipt-${now}`,
            requestId: sent.requestId,
            state: 'filed',
          },
          { status: 201 },
        ),
      );
    });

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 10,
      overallDeadlineMs: 25,
      fetch: send,
      monotonicNow: () => now,
      now: () => now,
      relayUrl: 'https://relay.invalid',
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(outcome.accepted).toBe(2);
    expect(await listRelayRequests(project)).toHaveLength(1);
  });

  it('normalizes the configured relay origin before submitting', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request());
    const observedUrls: string[] = [];
    const send = vi.fn<typeof fetch>((input, _init) => {
      let observedUrl: string;
      if (typeof input === 'string') observedUrl = input;
      else if (input instanceof URL) observedUrl = input.href;
      else observedUrl = input.url;
      observedUrls.push(observedUrl);
      return Promise.resolve(
        Response.json(
          {
            receiptId: 'receipt-normalized-url',
            requestId: request().requestId,
            state: 'filed',
          },
          { status: 201 },
        ),
      );
    });

    await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: send,
      now: Date.now,
      relayUrl: 'https://relay.invalid/',
    });

    expect(send).toHaveBeenCalledOnce();
    expect(observedUrls).toEqual(['https://relay.invalid/v1/retro-filings']);
  });

  it('does not start an HTTP attempt without its full per-request budget', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request());
    let monotonic = 0;
    const send = vi.fn<typeof fetch>();

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 100,
      overallDeadlineMs: 100,
      fetch: send,
      monotonicNow: () => {
        monotonic += 1;
        return monotonic;
      },
      now: () => 0,
      relayUrl: 'https://relay.invalid',
    });

    expect(send).not.toHaveBeenCalled();
    expect(outcome.retryable).toBe(1);
    expect(await listRelayRequests(project)).toHaveLength(1);
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
          (ancestor === manifest.evidenceCommit && descendant === 'b'.repeat(40)) ||
            (manifest.prerequisites.map(item => item.mergedCommit).includes(ancestor) &&
              descendant === manifest.evidenceCommit),
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

  it('uses build-embedded evidence without consulting the customer repository', async () => {
    const manifest = validManifest();
    const buildCommit = 'b'.repeat(40);
    const result = await validateBuildAttestedRelayReadiness(
      manifest,
      {
        ancestorPairs: [
          `${manifest.evidenceCommit}:${buildCommit}`,
          ...manifest.prerequisites.map(
            prerequisite => `${prerequisite.mergedCommit}:${manifest.evidenceCommit}`,
          ),
        ],
        artifactHashes: Object.fromEntries(
          Object.values(manifest.measurements).map(artifact => [
            `${manifest.evidenceCommit}:${artifact.path}`,
            artifact.sha256,
          ]),
        ),
        buildCommit,
        enabled: true,
        manifestSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
      },
      new Date('2026-07-26T12:00:00.000Z'),
    );

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
    [
      'malformed artifact',
      (value: RelayReadinessManifest) => {
        value.measurements.sameSignatureCollisions.sha256 = 'not-a-sha256';
        return value;
      },
    ],
    ['hash mismatch', (value: RelayReadinessManifest) => value],
    [
      'future measurement',
      (value: RelayReadinessManifest) => {
        value.measurements.sameSignatureCollisions.measuredAt = '2026-07-27T00:00:00.000Z';
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
      readArtifactAtCommit: (_commit, artifactPath) => {
        let sha256 = artifactPath.endsWith('collisions.json') ? '1'.repeat(64) : '2'.repeat(64);
        if (kind === 'hash mismatch') sha256 = '3'.repeat(64);
        return Promise.resolve({ sha256 });
      },
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
    vi.stubEnv('HTTPS_PROXY', 'https://proxy.example');
    vi.stubEnv('NODE_EXTRA_CA_CERTS', '/certs/company.pem');
    vi.stubEnv('ANTHROPIC_BASE_URL', 'https://llm-gateway.example');
    vi.stubEnv('CLAUDE_CODE_USE_BEDROCK', '1');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'bedrock-access');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'bedrock-secret');
    vi.stubEnv('AWS_SESSION_TOKEN', 'bedrock-session');
    vi.stubEnv('AWS_REGION', 'us-west-2');
    vi.stubEnv('ANTHROPIC_VERTEX_PROJECT_ID', 'vertex-project');
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/credentials/vertex.json');
    vi.stubEnv('USERPROFILE', String.raw`C:\Users\safe`);
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
    expect(observed[0]).toMatchObject({
      ANTHROPIC_BASE_URL: 'https://llm-gateway.example',
      ANTHROPIC_VERTEX_PROJECT_ID: 'vertex-project',
      AWS_ACCESS_KEY_ID: 'bedrock-access',
      AWS_REGION: 'us-west-2',
      AWS_SECRET_ACCESS_KEY: 'bedrock-secret',
      AWS_SESSION_TOKEN: 'bedrock-session',
      CLAUDE_CODE_USE_BEDROCK: '1',
      GOOGLE_APPLICATION_CREDENTIALS: '/credentials/vertex.json',
      HTTPS_PROXY: 'https://proxy.example',
      NODE_EXTRA_CA_CERTS: '/certs/company.pem',
      USERPROFILE: String.raw`C:\Users\safe`,
    });
  });
});
