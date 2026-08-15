import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
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
  discardRelayRequest,
  listRelayDeadLetters,
  listRelayRequests,
  listRelaySpoolEntries,
  persistRelayDraft,
  persistRelayDraftBatch,
  persistRelayRequest,
  rearmRelayDeadLetter,
  recoverRelayDeadLetter,
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
import {
  relayReadinessArtifact as measurementArtifact,
  relayReadinessMeasurementContent as measurementContent,
  validRelayReadinessManifest as validManifest,
} from '../helpers/relay-readiness.js';

const directories: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];
const READINESS_BUILD_COMMIT = 'b'.repeat(40);
const READINESS_NOW = new Date('2026-07-26T12:00:00.000Z');

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

function activeRequestPath(project: string, requestId: string): string {
  const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
  const filename = readdirSync(directory).find(
    candidate =>
      candidate === `${requestId}.json` || candidate === `${requestId}.materializing.json`,
  );
  if (filename === undefined) throw new Error('missing active request file');
  return path.join(directory, filename);
}

function deadLetterRequestPath(project: string, requestId: string): string {
  return path.join(project, '.safeword', 'retro-drafts', 'relay', `${requestId}.dead-letter.json`);
}

function retrySchedulePath(project: string, requestId: string): string {
  return path.join(
    project,
    '.safeword',
    'retro-drafts',
    'relay',
    `${requestId}.retry-schedule.json`,
  );
}

function request(overrides: Record<string, unknown> = {}) {
  const { createdAt, requestId, retryDeadlineAt, ...input } = overrides;
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
      ...input,
    },
    {
      ...(typeof createdAt === 'string' && { now: () => Date.parse(createdAt) }),
      randomUUID: () => (typeof requestId === 'string' ? requestId : randomUUID()),
      ...(typeof retryDeadlineAt === 'string' && {
        retryDeadlineAt: () => retryDeadlineAt,
      }),
    },
  );
}

type ReadinessDependencies = Parameters<typeof validateRelayReadiness>[1];
type BuildAttestation = Parameters<typeof validateBuildAttestedRelayReadiness>[1];

function validReadinessDependencies(
  manifest: RelayReadinessManifest,
  overrides: Partial<ReadinessDependencies> = {},
): ReadinessDependencies {
  return {
    buildCommit: READINESS_BUILD_COMMIT,
    isAncestor: (ancestor, descendant) =>
      Promise.resolve(
        (ancestor === manifest.evidenceCommit && descendant === READINESS_BUILD_COMMIT) ||
          (manifest.prerequisites.map(item => item.mergedCommit).includes(ancestor) &&
            descendant === manifest.evidenceCommit),
      ),
    now: READINESS_NOW,
    readArtifactAtCommit: (_commit, artifactPath) =>
      Promise.resolve(measurementArtifact(manifest, artifactPath)),
    ...overrides,
  };
}

function buildAttestation(
  manifest: RelayReadinessManifest,
  overrides: Partial<BuildAttestation> = {},
): BuildAttestation {
  for (const artifact of Object.values(manifest.measurements)) {
    artifact.sha256 = createHash('sha256')
      .update(measurementContent(manifest, artifact.path))
      .digest('hex');
  }
  const manifestContent = JSON.stringify(manifest);
  return {
    ancestorPairs: [
      { ancestor: manifest.evidenceCommit, descendant: READINESS_BUILD_COMMIT },
      ...manifest.prerequisites.map(prerequisite => ({
        ancestor: prerequisite.mergedCommit,
        descendant: manifest.evidenceCommit,
      })),
    ],
    artifacts: Object.fromEntries(
      Object.entries(manifest.measurements).map(([metric, artifact]) => [
        metric,
        {
          contentBase64: Buffer.from(measurementContent(manifest, artifact.path)).toString(
            'base64',
          ),
          sha256: artifact.sha256,
        },
      ]),
    ),
    buildCommit: READINESS_BUILD_COMMIT,
    enabled: true,
    manifestBase64: Buffer.from(manifestContent).toString('base64'),
    manifestSha256: createHash('sha256').update(manifestContent).digest('hex'),
    ...overrides,
  };
}

function acceptedRelayFetch(
  observe: (request: RelayDraftRequest) => void = () => {},
): typeof fetch {
  return (_input, init) => {
    const submitted = JSON.parse(
      Buffer.from(init?.body as Uint8Array).toString('utf8'),
    ) as RelayDraftRequest;
    observe(submitted);
    return Promise.resolve(
      Response.json(
        {
          receiptId: `receipt-${submitted.requestId}`,
          requestId: submitted.requestId,
          state: 'accepted',
        },
        { status: 202 },
      ),
    );
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let complete: ((value: T) => void) | undefined;
  // eslint-disable-next-line unicorn/prefer-promise-with-resolvers -- The package targets ES2022.
  const promise = new Promise<T>(resolve => {
    complete = resolve;
  });
  return {
    promise,
    resolve: value => {
      if (complete === undefined) throw new Error('deferred promise was not initialized');
      complete(value);
    },
  };
}

function sequenceClock(...times: number[]): () => number {
  return () => times.shift() ?? Infinity;
}

describe('immutable relay delivery spool', () => {
  it('keeps generated identity fields authoritative over runtime input', () => {
    const generatedId = randomUUID();
    const generatedAt = Date.parse('2026-08-14T00:00:00.000Z');
    const draft = request({ sourceKey: 'generated-identity' });
    const created = createRelayRequest(
      {
        ...draft,
        createdAt: '2000-01-01T00:00:00.000Z',
        requestId: randomUUID(),
        retryDeadlineAt: '2000-01-02T00:00:00.000Z',
      } as Parameters<typeof createRelayRequest>[0],
      { now: () => generatedAt, randomUUID: () => generatedId },
    );

    expect(created).toMatchObject({
      createdAt: new Date(generatedAt).toISOString(),
      requestId: generatedId,
      retryDeadlineAt: new Date(generatedAt + 86_400_000).toISOString(),
    });
  });

  it('rejects claim identities that could escape the relay spool', async () => {
    const project = temporaryProject();
    const persisted = await persistRelayRequest(project, request({ sourceKey: 'claim-path' }));

    await expect(
      claimRelayRequest(project, {
        claimId: '../../../outside',
        leaseMs: 60_000,
        now: Date.now(),
      }),
    ).rejects.toThrow('invalid relay claim identity');
    expect(readFileSync(persisted.path, 'utf8')).toBe(persisted.bytes.toString('utf8'));
  });

  it.each([
    ['NaN clock', { leaseMs: 60_000, now: NaN }],
    ['fractional clock', { leaseMs: 60_000, now: 1.5 }],
    ['negative clock', { leaseMs: 60_000, now: -1 }],
    ['infinite lease', { leaseMs: Infinity, now: 0 }],
    ['zero lease', { leaseMs: 0, now: 0 }],
    ['overflowing expiry', { leaseMs: 1, now: Number.MAX_SAFE_INTEGER }],
  ])('rejects %s before mutating the durable request', async (_case, timing) => {
    const project = temporaryProject();
    const persisted = await persistRelayRequest(project, request({ sourceKey: `timing-${_case}` }));

    await expect(
      claimRelayRequest(project, { claimId: 'timing-owner', ...timing }),
    ).rejects.toThrow('invalid relay claim timing');
    expect(readFileSync(persisted.path, 'utf8')).toBe(persisted.bytes.toString('utf8'));
  });

  it('rejects malformed claim bytes without acknowledging or resurrecting the source', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'malformed-acknowledgement' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'malformed-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const malformedBytes = Buffer.from('{not-json', 'utf8');
    writeFileSync(claim.path, malformedBytes);

    await expect(
      acknowledgeRelayClaim(
        { ...claim, bytes: malformedBytes },
        { receiptId: 'malformed-receipt', requestId: persisted.requestId, state: 'filed' },
      ),
    ).rejects.toThrow('cannot acknowledge malformed relay request bytes');
    expect(readFileSync(claim.path)).toEqual(malformedBytes);
    await expect(persistRelayDraft(project, draft)).rejects.toThrow('corrupt durable identity');
  });

  it('rejects valid claim bytes belonging to a different durable request', async () => {
    const project = temporaryProject();
    const firstDraft = request({ sourceKey: 'substituted-first', title: 'first' });
    const secondDraft = request({ sourceKey: 'substituted-second', title: 'second' });
    const first = await persistRelayDraft(project, firstDraft);
    const second = await persistRelayDraft(project, secondDraft);
    if (first === undefined || second === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'substitution-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const substitute = claim.requestId === first.requestId ? second : first;
    const substituteBytes = Buffer.from(JSON.stringify(substitute), 'utf8');

    await expect(
      acknowledgeRelayClaim(
        { ...claim, bytes: substituteBytes },
        { receiptId: 'substitution-receipt', requestId: claim.requestId, state: 'filed' },
      ),
    ).rejects.toThrow('relay claim bytes do not match the durable claim');
    expect(readFileSync(claim.path)).toEqual(claim.bytes);
    await expect(persistRelayDraft(project, firstDraft)).resolves.toMatchObject({
      requestId: first.requestId,
    });
    await expect(persistRelayDraft(project, secondDraft)).resolves.toMatchObject({
      requestId: second.requestId,
    });
  });

  it('rejects same-identity payload substitution against durable claim bytes', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request({ sourceKey: 'same-id-substitution' }));
    const claim = await claimRelayRequest(project, {
      claimId: 'same-id-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const forged = {
      ...(JSON.parse(claim.bytes.toString('utf8')) as RelayDraftRequest),
      body: 'forged body',
      sourceKey: 'forged source',
    };
    const forgedBytes = Buffer.from(JSON.stringify(forged), 'utf8');

    await expect(
      acknowledgeRelayClaim(
        { ...claim, bytes: forgedBytes },
        { receiptId: 'same-id-receipt', requestId: claim.requestId, state: 'filed' },
      ),
    ).rejects.toThrow('relay claim bytes do not match the durable claim');
    expect(readFileSync(claim.path)).toEqual(claim.bytes);
  });

  it('rejects a claim path outside the canonical spool layout', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request({ sourceKey: 'claim-layout' }));
    const claim = await claimRelayRequest(project, {
      claimId: 'layout-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const outside = path.join(project, path.basename(claim.path));
    renameSync(claim.path, outside);

    await expect(
      acknowledgeRelayClaim(
        { ...claim, path: outside },
        { receiptId: 'layout-receipt', requestId: claim.requestId, state: 'filed' },
      ),
    ).rejects.toThrow('invalid relay claim path');
    expect(readFileSync(outside, 'utf8')).toBe(claim.bytes.toString('utf8'));
  });

  it.each(['primary', 'materializing', 'dead-letter'] as const)(
    'rejects an in-spool %s path as acknowledgement ownership',
    async state => {
      const project = temporaryProject();
      const original = request({ sourceKey: `wrong-claim-kind-${state}` });
      const persisted = await persistRelayRequest(project, original);
      const suffix = state === 'primary' ? '' : `.${state}`;
      const candidate = path.join(
        path.dirname(persisted.path),
        `${original.requestId}${suffix}.json`,
      );
      if (candidate !== persisted.path) renameSync(persisted.path, candidate);
      const bytes = readFileSync(candidate);

      await expect(
        acknowledgeRelayClaim(
          { bytes, path: candidate, requestId: original.requestId },
          { receiptId: `wrong-${state}`, requestId: original.requestId, state: 'filed' },
        ),
      ).rejects.toThrow('invalid relay claim path');
      expect(readFileSync(candidate)).toEqual(bytes);
    },
  );

  it('reports the owning transient state when durable siblings coexist', async () => {
    const project = temporaryProject();
    const persisted = await persistRelayDraft(
      project,
      request({ sourceKey: 'source-list-precedence', title: 'list precedence' }),
    );
    if (persisted === undefined) throw new Error('missing relay request');
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    writeFileSync(
      path.join(directory, `${persisted.requestId}.claim.concurrent.${Date.now() + 60_000}.json`),
      readFileSync(activeRequestPath(project, persisted.requestId)),
    );

    await expect(listRelaySpoolEntries(project)).resolves.toEqual([
      { requestId: persisted.requestId, state: 'delivery-claim' },
    ]);
  });

  it('discards only the selected durable identity and its source reservation', async () => {
    const project = temporaryProject();
    const selected = await persistRelayDraft(
      project,
      request({ sourceKey: 'source-selected', title: 'selected' }),
    );
    const retained = await persistRelayDraft(
      project,
      request({ sourceKey: 'source-retained', title: 'retained' }),
    );
    if (selected === undefined || retained === undefined) throw new Error('missing relay request');
    const selectedPath = activeRequestPath(project, selected.requestId);
    renameSync(selectedPath, deadLetterRequestPath(project, selected.requestId));

    await expect(discardRelayRequest(project, selected.requestId)).resolves.toBe(true);
    await expect(discardRelayRequest(project, selected.requestId)).resolves.toBe(false);
    await expect(discardRelayRequest(project, 'not-a-request-id')).rejects.toThrow(
      'invalid relay request identity',
    );
    const active = await listRelayRequests(project);
    expect(active.map(item => item.requestId)).toEqual([retained.requestId]);
    expect(await listRelayDeadLetters(project)).toEqual([]);
    await expect(
      persistRelayDraft(project, request({ sourceKey: 'source-selected', title: 'selected' })),
    ).resolves.toBeUndefined();
    await expect(
      persistRelayDraft(project, request({ sourceKey: 'source-retained', title: 'retained' })),
    ).resolves.toMatchObject({ requestId: retained.requestId });
  });

  it('keeps one source tombstone when acknowledgement races source discard compaction', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-ack-discard-race', title: 'ack discard race' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    const sourceHash = createHash('sha256').update(draft.sourceKey).digest('hex');
    const sourcePayloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          body: draft.body,
          canonicalKey: draft.canonicalKey,
          installationId: draft.installationId,
          labels: draft.labels,
          legacySignature: draft.legacySignature,
          repository: draft.repository,
          title: draft.title,
        }),
      )
      .digest('hex');

    await discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterSourceDiscardWrite: () => {
          writeFileSync(
            path.join(directory, `source-${sourceHash}.acknowledged.json`),
            JSON.stringify({
              requestId: persisted.requestId,
              sourceKey: draft.sourceKey,
              sourcePayloadHash,
              state: 'acknowledged',
              version: 1,
            }),
          );
          return Promise.resolve();
        },
      },
    });

    expect(
      readdirSync(directory).filter(filename => filename.startsWith(`source-${sourceHash}`)),
    ).toEqual([`source-${sourceHash}.acknowledged.json`]);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
  });

  it('quarantines a conflicting source acknowledgement without wedging spool recovery', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-conflicting-ack', title: 'conflicting ack' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const directory = path.dirname(activeRequestPath(project, persisted.requestId));
    const sourceHash = createHash('sha256').update(draft.sourceKey).digest('hex');
    const conflictingAcknowledgement = JSON.stringify({
      requestId: randomUUID(),
      state: 'acknowledged',
      version: 1,
    });
    writeFileSync(path.join(directory, `${persisted.requestId}.ack.json`), '{}');
    writeFileSync(
      path.join(directory, `source-${sourceHash}.acknowledged.json`),
      conflictingAcknowledgement,
    );

    await expect(recoverRelaySpool(project, Date.now())).resolves.toBeUndefined();

    const sourceFiles = readdirSync(directory).filter(filename =>
      filename.startsWith(`source-${sourceHash}.acknowledged`),
    );
    expect(sourceFiles).toContain(`source-${sourceHash}.acknowledged.json`);
    const conflictFile = sourceFiles.find(filename => filename.includes('.conflict.'));
    expect(conflictFile).toBeDefined();
    expect(readFileSync(path.join(directory, conflictFile ?? ''), 'utf8')).toBe(
      conflictingAcknowledgement,
    );
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();

    const conflictPath = path.join(directory, conflictFile ?? '');
    utimesSync(conflictPath, new Date(0), new Date(0));
    await recoverRelaySpool(project, 8 * 24 * 60 * 60 * 1000);
    expect(readdirSync(directory)).not.toContain(conflictFile);
  });

  it('recovers an acknowledged malformed claim without wedging operator commands', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-malformed-ack', title: 'malformed ack' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'malformed-ack-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const directory = path.dirname(claim.path);
    writeFileSync(claim.path, '{"requestId":');
    writeFileSync(path.join(directory, `${persisted.requestId}.ack.json`), '{}');

    await expect(recoverRelaySpool(project, Date.now())).resolves.toBeUndefined();

    expect(
      readdirSync(directory).filter(filename => filename.startsWith(persisted.requestId)),
    ).toEqual([]);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
    await expect(discardRelayRequest(project, persisted.requestId)).resolves.toBe(false);
  });

  it('uses filename identity when acknowledged bytes name another request', async () => {
    const project = temporaryProject();
    const firstDraft = request({ sourceKey: 'source-ack-filename-first', title: 'first' });
    const secondDraft = request({ sourceKey: 'source-ack-filename-second', title: 'second' });
    const first = await persistRelayDraft(project, firstDraft);
    const second = await persistRelayDraft(project, secondDraft);
    if (first === undefined || second === undefined) throw new Error('missing relay requests');
    const firstPath = activeRequestPath(project, first.requestId);
    const directory = path.dirname(firstPath);
    writeFileSync(firstPath, JSON.stringify(second));
    writeFileSync(path.join(directory, `${first.requestId}.ack.json`), '{}');

    await recoverRelaySpool(project, Date.now());

    await expect(persistRelayDraft(project, firstDraft)).resolves.toBeUndefined();
    await expect(persistRelayDraft(project, secondDraft)).resolves.toMatchObject({
      requestId: second.requestId,
    });
  });

  it('removes an orphan durable acknowledgement after interrupted cleanup', async () => {
    const project = temporaryProject();
    const requestId = randomUUID();
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    mkdirSync(directory, { recursive: true });
    const orphan = path.join(directory, `${requestId}.ack.json`);
    writeFileSync(orphan, '{}');

    await recoverRelaySpool(project, Date.now());

    expect(existsSync(orphan)).toBe(false);
  });

  it('quarantines a diverged expired claim and keeps its durable sibling claimable', async () => {
    const project = temporaryProject();
    const persisted = await persistRelayDraft(
      project,
      request({ sourceKey: 'source-diverged-claim', title: 'diverged claim' }),
    );
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'diverged-owner',
      leaseMs: 1,
      now: 0,
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const directory = path.dirname(claim.path);
    const sibling = path.join(directory, `${persisted.requestId}.json`);
    const siblingBytes = Buffer.from(
      JSON.stringify({ ...persisted, title: 'canonical sibling' }),
      'utf8',
    );
    writeFileSync(sibling, siblingBytes);

    await recoverRelaySpool(project, 2);

    expect(existsSync(claim.path)).toBe(false);
    expect(readFileSync(sibling)).toEqual(siblingBytes);
    const conflict = readdirSync(directory).find(filename =>
      filename.startsWith(`${persisted.requestId}.claim-conflict.`),
    );
    expect(conflict).toBeDefined();
    expect(readFileSync(path.join(directory, conflict ?? ''))).toEqual(claim.bytes);
    await expect(
      claimRelayRequest(project, { claimId: 'successor', leaseMs: 60_000, now: 2 }),
    ).resolves.toMatchObject({ requestId: persisted.requestId });
  });

  it('keeps the canonical source tombstone visible while quarantining a conflict', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-conflict-race', title: 'conflict race' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'conflict-race-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const directory = path.dirname(claim.path);
    const sourceHash = createHash('sha256').update(draft.sourceKey).digest('hex');
    const conflictingAcknowledgement = JSON.stringify({
      requestId: randomUUID(),
      sourceKey: draft.sourceKey,
      sourcePayloadHash: '0'.repeat(64),
      state: 'acknowledged',
      version: 1,
    });
    writeFileSync(
      path.join(directory, `source-${sourceHash}.acknowledged.json`),
      conflictingAcknowledgement,
    );
    const quarantined = deferred<boolean>();
    const resumeReplacement = deferred<boolean>();
    const acknowledgement = acknowledgeRelayClaim(
      claim,
      {
        receiptId: 'receipt-conflict-race',
        requestId: persisted.requestId,
        state: 'filed',
      },
      {
        faults: {
          afterSourceAcknowledgementQuarantine: async () => {
            quarantined.resolve(true);
            await resumeReplacement.promise;
          },
        },
      },
    );
    await quarantined.promise;
    expect(
      readFileSync(path.join(directory, `source-${sourceHash}.acknowledged.json`), 'utf8'),
    ).toBe(conflictingAcknowledgement);

    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
    expect(
      readdirSync(directory).filter(filename => filename.endsWith('.materializing.json')),
    ).toEqual([]);
    resumeReplacement.resolve(true);
    await expect(acknowledgement).resolves.toBe(true);
  });

  it('refuses to discard a request owned by an active delivery claim', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-in-flight', title: 'in flight' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'delivery-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');

    await expect(discardRelayRequest(project, persisted.requestId)).rejects.toThrow(
      'relay request is actively claimed',
    );
    await expect(
      acknowledgeRelayClaim(claim, {
        issueNumber: 1479,
        receiptId: 'receipt-in-flight',
        requestId: persisted.requestId,
        state: 'accepted',
      }),
    ).resolves.toBe(true);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
  });

  it('fails discard closed when an active claim rearms after ownership attempts', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-rearming-discard', title: 'rearming discard' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'rearming-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const attempted = deferred<boolean>();
    const resumeDiscard = deferred<boolean>();
    const discard = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterClaims: async () => {
          attempted.resolve(true);
          await resumeDiscard.promise;
        },
      },
    });
    await attempted.promise;
    renameSync(claim.path, path.join(path.dirname(claim.path), `${persisted.requestId}.json`));
    resumeDiscard.resolve(true);

    await expect(discard).rejects.toThrow('relay request is actively claimed');
    await expect(persistRelayDraft(project, draft)).resolves.toMatchObject({
      requestId: persisted.requestId,
    });
  });

  it('preserves an acknowledged tombstone when delivery finishes during discard', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-ack-discard', title: 'ack during discard' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'ack-discard-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const attempted = deferred<boolean>();
    const resumeDiscard = deferred<boolean>();
    const discard = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterClaims: async () => {
          attempted.resolve(true);
          await resumeDiscard.promise;
        },
      },
    });
    await attempted.promise;
    await acknowledgeRelayClaim(claim, {
      issueNumber: 1479,
      receiptId: 'receipt-ack-discard',
      requestId: persisted.requestId,
      state: 'filed',
    });
    resumeDiscard.resolve(true);

    await expect(discard).resolves.toBe(false);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
  });

  it('keeps acknowledgement authoritative over a conflicting discard tombstone', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-ack-terminal', title: 'ack terminal' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'ack-terminal-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    const acknowledged = deferred<boolean>();
    const resumeAcknowledgement = deferred<boolean>();
    const acknowledgement = acknowledgeRelayClaim(
      claim,
      {
        issueNumber: 1479,
        receiptId: 'receipt-ack-terminal',
        requestId: persisted.requestId,
        state: 'filed',
      },
      {
        faults: {
          afterAck: async () => {
            acknowledged.resolve(true);
            await resumeAcknowledgement.promise;
          },
        },
      },
    );

    await acknowledged.promise;
    const directory = path.dirname(claim.path);
    writeFileSync(
      path.join(directory, `${persisted.requestId}.discarded.json`),
      JSON.stringify({ requestId: persisted.requestId, version: 1 }),
    );
    resumeAcknowledgement.resolve(true);

    await expect(acknowledgement).resolves.toBe(true);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
    expect(
      readdirSync(directory).filter(filename => filename.startsWith(persisted.requestId)),
    ).toEqual([]);
  });

  it('retains acknowledged source identity after expiry takeover and discard', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-ack-takeover', title: 'ack takeover' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const oldClaim = await claimRelayRequest(project, {
      claimId: 'old-ack-owner',
      leaseMs: 1,
      now: 0,
    });
    if (oldClaim === undefined) throw new Error('missing relay claim');
    const ownershipChecked = deferred<boolean>();
    const resumeAcknowledgement = deferred<boolean>();
    const tombstoned = deferred<boolean>();
    const resumeDiscard = deferred<boolean>();
    const acknowledgement = acknowledgeRelayClaim(
      oldClaim,
      {
        issueNumber: 1479,
        receiptId: 'receipt-ack-takeover',
        requestId: persisted.requestId,
        state: 'filed',
      },
      {
        faults: {
          afterOwnershipCheck: async () => {
            ownershipChecked.resolve(true);
            await resumeAcknowledgement.promise;
          },
        },
      },
    );
    await ownershipChecked.promise;
    await recoverRelaySpool(project, 2);
    const discard = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterTombstone: async () => {
          tombstoned.resolve(true);
          await resumeDiscard.promise;
        },
      },
    });
    await tombstoned.promise;
    resumeAcknowledgement.resolve(true);
    await expect(acknowledgement).resolves.toBe(true);
    resumeDiscard.resolve(true);

    await expect(discard).resolves.toBe(true);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
  });

  it('compacts an acknowledged source to one immutable tombstone file', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-single-tombstone', title: 'single tombstone' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const claim = await claimRelayRequest(project, {
      claimId: 'single-tombstone-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');

    await expect(
      acknowledgeRelayClaim(claim, {
        issueNumber: 1479,
        receiptId: 'receipt-single-tombstone',
        requestId: persisted.requestId,
        state: 'filed',
      }),
    ).resolves.toBe(true);

    const sourceFiles = readdirSync(path.dirname(claim.path)).filter(filename =>
      filename.startsWith('source-'),
    );
    expect(sourceFiles).toHaveLength(1);
    expect(sourceFiles[0]).toMatch(/^source-[\da-f]{64}\.acknowledged\.json$/u);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
  });

  it('cancels a crashed discard intent so a foreign expired claim can recover', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-intent-recovery', title: 'intent recovery' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const now = Date.now();
    const foreignClaim = await claimRelayRequest(project, {
      claimId: 'foreign-expiring-owner',
      leaseMs: 60_000,
      now,
    });
    if (foreignClaim === undefined) throw new Error('missing relay claim');

    await expect(
      discardRelayRequest(project, persisted.requestId, {
        faults: { afterClaims: () => Promise.reject(new Error('simulated discard crash')) },
      }),
    ).rejects.toThrow('simulated discard crash');
    await recoverRelaySpool(project, now + 120_000);
    expect(
      readdirSync(path.dirname(foreignClaim.path)).filter(filename =>
        filename.startsWith(persisted.requestId),
      ),
    ).toEqual([`${persisted.requestId}.json`]);

    const recovered = await claimRelayRequest(project, {
      claimId: 'recovered-owner',
      leaseMs: 60_000,
      now: now + 120_000,
    });
    expect(recovered).toMatchObject({ requestId: persisted.requestId });
  });

  it('does not recover a live discard intent before its ownership lease expires', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-live-intent', title: 'live intent' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const paused = deferred<boolean>();
    const resume = deferred<boolean>();
    const discard = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterClaims: async () => {
          paused.resolve(true);
          await resume.promise;
        },
      },
    });
    await paused.promise;

    await recoverRelaySpool(project, Date.now());
    const requestFiles = readdirSync(
      path.join(project, '.safeword', 'retro-drafts', 'relay'),
    ).filter(filename => filename.startsWith(persisted.requestId));
    expect(requestFiles).toContainEqual(expect.stringContaining('.discarding.'));
    expect(requestFiles).not.toContain(`${persisted.requestId}.discarded.json`);

    resume.resolve(true);
    await expect(discard).resolves.toBe(true);
    await expect(listRelayRequests(project)).resolves.toEqual([]);
  });

  it('converges when recovery commits a discard after its ownership lease expires', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-expired-intent', title: 'expired intent' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const paused = deferred<boolean>();
    const resume = deferred<boolean>();
    const discard = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterClaims: async () => {
          paused.resolve(true);
          await resume.promise;
        },
      },
    });
    await paused.promise;

    await recoverRelaySpool(project, Date.now() + 120_000);
    resume.resolve(true);

    await expect(discard).resolves.toBe(true);
    await expect(listRelayRequests(project)).resolves.toEqual([]);
    await expect(discardRelayRequest(project, persisted.requestId)).resolves.toBe(false);
  });

  it('does not let stale cancellation remove a replacement discard intent', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-intent-aba', title: 'intent ABA' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const foreignClaim = await claimRelayRequest(project, {
      claimId: 'foreign-aba-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (foreignClaim === undefined) throw new Error('missing relay claim');
    const firstPause = deferred<boolean>();
    const firstResume = deferred<boolean>();
    const secondPause = deferred<boolean>();
    const secondResume = deferred<boolean>();
    const first = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterClaims: async () => {
          firstPause.resolve(true);
          await firstResume.promise;
        },
      },
    });
    await firstPause.promise;
    const second = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterClaims: async () => {
          secondPause.resolve(true);
          await secondResume.promise;
        },
      },
    });
    await secondPause.promise;
    firstResume.resolve(true);
    await expect(first).rejects.toThrow('relay request is actively claimed');
    expect(
      readdirSync(path.dirname(foreignClaim.path)).filter(filename =>
        filename.includes('.discarding.'),
      ),
    ).toHaveLength(1);
    await expect(persistRelayDraft(project, draft)).resolves.toMatchObject({
      requestId: persisted.requestId,
    });
    expect(readdirSync(path.dirname(foreignClaim.path))).toContain(
      path.basename(foreignClaim.path),
    );
    secondResume.resolve(true);
    await expect(second).rejects.toThrow('relay request is actively claimed');
  });

  it('does not recreate a primary after delivery claims the snapshotted request', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-claim-race', title: 'claim race' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const snapshotted = deferred<boolean>();
    const resumePersist = deferred<boolean>();
    const persistence = persistRelayDraft(project, draft, {
      faults: {
        afterStateSnapshot: async () => {
          snapshotted.resolve(true);
          await resumePersist.promise;
        },
      },
    });
    await snapshotted.promise;
    const claim = await claimRelayRequest(project, {
      claimId: 'delivery-race-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    if (claim === undefined) throw new Error('missing relay claim');
    resumePersist.resolve(true);

    await expect(persistence).resolves.toMatchObject({ requestId: persisted.requestId });
    const requestFiles = readdirSync(path.dirname(claim.path)).filter(filename =>
      filename.startsWith(persisted.requestId),
    );
    expect(requestFiles).toEqual([path.basename(claim.path)]);
    await expect(
      acknowledgeRelayClaim(claim, {
        issueNumber: 1479,
        receiptId: 'receipt-claim-race',
        requestId: persisted.requestId,
        state: 'filed',
      }),
    ).resolves.toBe(true);
    await expect(listRelayRequests(project)).resolves.toEqual([]);
  });

  it('repairs an existing source reservation through a claimable materializing state', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-missing-state', title: 'missing state' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const primary = activeRequestPath(project, persisted.requestId);
    rmSync(primary);

    await expect(persistRelayDraft(project, draft)).resolves.toMatchObject({
      requestId: persisted.requestId,
    });
    const claim = await claimRelayRequest(project, {
      claimId: 'materializing-owner',
      leaseMs: 60_000,
      now: Date.now(),
    });
    expect(claim).toMatchObject({ requestId: persisted.requestId });
  });

  it('does not resurrect materializing state after concurrent discard removes its reservation', async () => {
    const project = temporaryProject();
    const draft = request({
      sourceKey: 'source-discard-materialize',
      title: 'discard materialize',
    });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    rmSync(activeRequestPath(project, persisted.requestId));
    const snapshotted = deferred<boolean>();
    const resumePersistence = deferred<boolean>();
    const persistence = persistRelayDraft(project, draft, {
      faults: {
        afterStateSnapshot: async () => {
          snapshotted.resolve(true);
          await resumePersistence.promise;
        },
      },
    });

    await snapshotted.promise;
    await expect(discardRelayRequest(project, persisted.requestId)).resolves.toBe(true);
    resumePersistence.resolve(true);

    await expect(persistence).resolves.toBeUndefined();
    await expect(listRelayRequests(project)).resolves.toEqual([]);
  });

  it('blocks late materialization after discard completes its conflict check', async () => {
    const project = temporaryProject();
    const draft = request({
      sourceKey: 'source-discard-conflict-window',
      title: 'discard conflict window',
    });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    rmSync(activeRequestPath(project, persisted.requestId));
    const persistencePaused = deferred<boolean>();
    const resumePersistence = deferred<boolean>();
    const conflictChecked = deferred<boolean>();
    const resumeDiscard = deferred<boolean>();
    const persistence = persistRelayDraft(project, draft, {
      faults: {
        afterStateSnapshot: async () => {
          persistencePaused.resolve(true);
          await resumePersistence.promise;
        },
      },
    });
    await persistencePaused.promise;
    const discard = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterConflictCheck: async () => {
          conflictChecked.resolve(true);
          await resumeDiscard.promise;
        },
      },
    });
    await conflictChecked.promise;
    resumePersistence.resolve(true);

    await expect(persistence).resolves.toBeUndefined();
    await expect(
      claimRelayRequest(project, {
        claimId: 'late-delivery',
        leaseMs: 60_000,
        now: Date.now(),
      }),
    ).resolves.toBeUndefined();
    resumeDiscard.resolve(true);

    await expect(discard).resolves.toBe(true);
    await expect(listRelayRequests(project)).resolves.toEqual([]);
  });

  it('keeps discard terminal when its owned claim expires before cleanup', async () => {
    const project = temporaryProject();
    const draft = request({
      sourceKey: 'source-expired-discard',
      title: 'expired discard',
    });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const tombstoned = deferred<boolean>();
    const resumeDiscard = deferred<boolean>();
    const discard = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterTombstone: async () => {
          tombstoned.resolve(true);
          await resumeDiscard.promise;
        },
      },
    });

    await tombstoned.promise;
    await recoverRelaySpool(project, Date.now() + 120_000);
    resumeDiscard.resolve(true);

    await expect(discard).resolves.toBe(true);
    await expect(listRelayRequests(project)).resolves.toEqual([]);
    await expect(listRelayDeadLetters(project)).resolves.toEqual([]);
    await expect(discardRelayRequest(project, persisted.requestId)).resolves.toBe(false);
    expect(
      readdirSync(path.join(project, '.safeword', 'retro-drafts', 'relay')).filter(filename =>
        filename.startsWith(persisted.requestId),
      ),
    ).toEqual([`${persisted.requestId}.discarded.json`]);
    const replacement = await persistRelayDraft(project, draft);
    expect(replacement).toBeUndefined();
  });

  it('does not let direct persistence revive a discarded request identity', async () => {
    const project = temporaryProject();
    const persisted = await persistRelayDraft(
      project,
      request({ sourceKey: 'source-direct-discard', title: 'direct discard' }),
    );
    if (persisted === undefined) throw new Error('missing relay request');
    await discardRelayRequest(project, persisted.requestId);

    await expect(persistRelayRequest(project, persisted)).rejects.toThrow(
      'relay request identity was discarded',
    );
    await expect(listRelayRequests(project)).resolves.toEqual([]);
  });

  it('does not report direct persistence success when discard commits during its write', async () => {
    const project = temporaryProject();
    const persisted = await persistRelayDraft(
      project,
      request({ sourceKey: 'source-direct-race', title: 'direct race' }),
    );
    if (persisted === undefined) throw new Error('missing relay request');
    const checked = deferred<boolean>();
    const resumePersistence = deferred<boolean>();
    const persistence = persistRelayRequest(project, persisted, {
      faults: {
        afterDiscardCheck: async () => {
          checked.resolve(true);
          await resumePersistence.promise;
        },
      },
    });

    await checked.promise;
    await discardRelayRequest(project, persisted.requestId);
    resumePersistence.resolve(true);

    await expect(persistence).rejects.toThrow('relay request identity was discarded');
    await expect(listRelayRequests(project)).resolves.toEqual([]);
  });

  it('does not let a cancelable discard intent delete a directly persisted request', async () => {
    const project = temporaryProject();
    const direct = createRelayRequest(
      request({ sourceKey: 'source-direct-intent-race', title: 'direct intent race' }),
    );
    const checked = deferred<boolean>();
    const resumePersistence = deferred<boolean>();
    const persistence = persistRelayRequest(project, direct, {
      faults: {
        afterDiscardCheck: async () => {
          checked.resolve(true);
          await resumePersistence.promise;
        },
      },
    });
    await checked.promise;
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    const token = randomUUID();
    const now = Date.now();
    writeFileSync(
      path.join(directory, `${direct.requestId}.discarding.${token}.json`),
      JSON.stringify({
        claimId: 'cancelable-discard',
        expiresAt: now + 60_000,
        requestId: direct.requestId,
        startedAt: new Date(now).toISOString(),
        token,
        version: 1,
      }),
    );
    resumePersistence.resolve(true);

    const persisted = await persistence;
    const active = activeRequestPath(project, direct.requestId);
    expect(persisted.path).toBe(active);
    expect(readFileSync(active)).toEqual(Buffer.from(JSON.stringify(direct), 'utf8'));
  });

  it('refuses to discard a dead letter while recovery owns it', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-recovering', title: 'recovering' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const primary = activeRequestPath(project, persisted.requestId);
    renameSync(primary, deadLetterRequestPath(project, persisted.requestId));
    const response = deferred<Response>();
    const started = deferred<boolean>();
    let recoveryHeaders: Headers | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      recoveryHeaders = new Headers(init?.headers);
      started.resolve(true);
      return await response.promise;
    });

    const recovery = recoverRelayDeadLetter(project, persisted.requestId, {
      credential: 'swc_client_secret',
      fetch,
      relayUrl: 'https://relay.example.test',
    });
    await started.promise;
    expect(recoveryHeaders?.get('x-safeword-relay-api-version')).toBe('1');
    await expect(discardRelayRequest(project, persisted.requestId)).rejects.toThrow(
      'relay request is actively claimed',
    );
    await expect(persistRelayDraft(project, draft)).resolves.toMatchObject({
      requestId: persisted.requestId,
    });
    response.resolve(
      Response.json({
        issueNumber: 1479,
        receiptId: 'receipt-recovered',
        requestId: persisted.requestId,
        state: 'filed',
      }),
    );

    await expect(recovery).resolves.toBe(true);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
    await expect(listRelayRequests(project)).resolves.toEqual([]);
  });

  it('does not submit a structurally invalid dead letter during recovery', async () => {
    const project = temporaryProject();
    const requestId = randomUUID();
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, `${requestId}.dead-letter.json`),
      JSON.stringify({ requestId, title: 'missing required fields' }),
    );
    const fetch = vi.fn<typeof globalThis.fetch>();

    await expect(
      recoverRelayDeadLetter(project, requestId, {
        credential: 'swc_client_secret',
        fetch,
        relayUrl: 'https://relay.example.test',
      }),
    ).resolves.toBe(false);

    expect(fetch).not.toHaveBeenCalled();
    expect(readFileSync(deadLetterRequestPath(project, requestId), 'utf8')).toContain(
      'missing required fields',
    );
  });

  it('versions operator recovery and rejects an invalid recovered receipt shape', async () => {
    const project = temporaryProject();
    const persisted = await persistRelayDraft(
      project,
      request({ sourceKey: 'source-invalid-recovered-receipt', title: 'invalid receipt' }),
    );
    if (persisted === undefined) throw new Error('missing relay request');
    renameSync(
      activeRequestPath(project, persisted.requestId),
      deadLetterRequestPath(project, persisted.requestId),
    );
    let recoveryHeaders: Headers | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      await Promise.resolve();
      if (fetch.mock.calls.length === 1) {
        return Response.json({
          receiptId: 'ambiguous-receipt',
          requestId: persisted.requestId,
          state: 'ambiguous',
        });
      }
      recoveryHeaders = new Headers(init?.headers);
      return Response.json({
        issueNumber: 'not-a-number',
        receiptId: 'ambiguous-receipt',
        requestId: persisted.requestId,
        state: 'filed',
      });
    });

    await expect(
      recoverRelayDeadLetter(project, persisted.requestId, {
        credential: 'swc_client_secret',
        fetch,
        operatorCredential: 'swc_operator_secret',
        relayUrl: 'https://relay.example.test',
      }),
    ).resolves.toBe(false);

    expect(recoveryHeaders?.get('x-safeword-relay-api-version')).toBe('1');
    await expect(listRelayDeadLetters(project)).resolves.toHaveLength(1);
  });

  it('does not advance the reservation before a renewed recovery is accepted', async () => {
    const project = temporaryProject();
    const draft = request({
      createdAt: new Date(0).toISOString(),
      retryDeadlineAt: new Date(1).toISOString(),
      sourceKey: 'source-renewal-rollback',
      title: 'renewal rollback',
    });
    const persisted = await persistRelayDraft(project, draft, {
      requestDependencies: {
        now: () => 0,
        randomUUID,
        retryDeadlineAt: () => new Date(1).toISOString(),
      },
    });
    if (persisted === undefined) throw new Error('missing relay request');
    const primary = activeRequestPath(project, persisted.requestId);
    renameSync(primary, deadLetterRequestPath(project, persisted.requestId));
    const renewedStarted = deferred<boolean>();
    const renewedResponse = deferred<Response>();
    let attempt = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      attempt += 1;
      if (attempt === 1) {
        return Response.json(
          { error: 'invalid relay filing request', reason: 'retry-deadline-elapsed' },
          { status: 400 },
        );
      }
      renewedStarted.resolve(true);
      return await renewedResponse.promise;
    });

    const recovery = recoverRelayDeadLetter(project, persisted.requestId, {
      credential: 'swc_client_secret',
      fetch,
      relayUrl: 'https://relay.example.test',
    });
    await renewedStarted.promise;
    const observed = await persistRelayDraft(project, draft);
    expect(observed?.requestId).toBe(persisted.requestId);
    expect(Date.parse(observed?.retryDeadlineAt ?? '')).toBeGreaterThan(
      Date.parse(persisted.retryDeadlineAt),
    );
    renewedResponse.resolve(
      Response.json(
        { error: 'invalid relay filing request', reason: 'invalid-request' },
        { status: 400 },
      ),
    );

    await expect(recovery).resolves.toBe(false);
    await expect(persistRelayDraft(project, draft)).resolves.toMatchObject({
      requestId: persisted.requestId,
      retryDeadlineAt: persisted.retryDeadlineAt,
    });
  });

  it('owns a dead letter atomically before discard removes its reservation', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-discarding', title: 'discarding' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const primary = activeRequestPath(project, persisted.requestId);
    renameSync(primary, deadLetterRequestPath(project, persisted.requestId));
    const claimed = deferred<boolean>();
    const continueDiscard = deferred<boolean>();
    const discard = discardRelayRequest(project, persisted.requestId, {
      faults: {
        afterClaims: async () => {
          claimed.resolve(true);
          await continueDiscard.promise;
        },
      },
    });

    await claimed.promise;
    await expect(
      recoverRelayDeadLetter(project, persisted.requestId, {
        credential: 'swc_client_secret',
        fetch: vi.fn<typeof globalThis.fetch>(),
        relayUrl: 'https://relay.example.test',
      }),
    ).resolves.toBe(false);
    continueDiscard.resolve(true);
    await expect(discard).resolves.toBe(true);
    await expect(listRelayDeadLetters(project)).resolves.toEqual([]);
    const {
      createdAt: _createdAt,
      requestId: _requestId,
      retryDeadlineAt: _deadline,
      ...replay
    } = draft;
    await expect(persistRelayDraft(project, replay)).resolves.not.toMatchObject({
      requestId: persisted.requestId,
    });
  });

  it('restores renewed bytes from an expired recovery claim and reconciles its reservation', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-crashed-recovery', title: 'crashed recovery' });
    const original = await persistRelayDraft(project, draft);
    if (original === undefined) throw new Error('missing relay request');
    const primary = activeRequestPath(project, original.requestId);
    const recoveryClaim = path.join(
      path.dirname(primary),
      `${original.requestId}.recovery-claim.crashed-owner.1.json`,
    );
    const renewed = {
      ...original,
      retryDeadlineAt: new Date(Date.parse(original.retryDeadlineAt) + 86_400_000).toISOString(),
    };
    writeFileSync(recoveryClaim, JSON.stringify(renewed));
    rmSync(primary);

    await recoverRelaySpool(project, 2);

    const replay = await persistRelayDraft(project, draft);
    expect(replay).toMatchObject({
      requestId: original.requestId,
      retryDeadlineAt: renewed.retryDeadlineAt,
    });
    const deadLetters = await listRelayDeadLetters(project);
    expect(deadLetters).toHaveLength(1);
    expect(JSON.parse(deadLetters[0]?.bytes.toString('utf8') ?? '{}')).toMatchObject(renewed);
  });

  it('removes an expired recovery-claim duplicate before acknowledgement can resurrect it', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-rearm-crash', title: 'rearm crash' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    const primary = activeRequestPath(project, persisted.requestId);
    const recoveryClaim = path.join(
      directory,
      `${persisted.requestId}.recovery-claim.rearm-crash.1.json`,
    );
    writeFileSync(recoveryClaim, readFileSync(primary));

    await recoverRelaySpool(project, 2);
    expect(readdirSync(directory)).not.toContain(path.basename(recoveryClaim));
    const claim = await claimRelayRequest(project, {
      claimId: 'post-crash-owner',
      leaseMs: 60_000,
      now: 2,
    });
    if (claim === undefined) throw new Error('missing post-crash claim');
    await expect(
      acknowledgeRelayClaim(claim, {
        issueNumber: 1479,
        receiptId: 'receipt-rearm-crash',
        requestId: persisted.requestId,
        state: 'filed',
      }),
    ).resolves.toBe(true);
    await recoverRelaySpool(project, 120_000);
    await expect(listRelayDeadLetters(project)).resolves.toEqual([]);
    await expect(listRelayRequests(project)).resolves.toEqual([]);
  });

  it('lets a durable acknowledgement clean up a stranded recovery claim', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-ack-recovery-claim', title: 'ack recovery-claim' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const active = activeRequestPath(project, persisted.requestId);
    const activeStem = active.replace(/(?:\.materializing)?\.json$/u, '');
    const stranded = `${activeStem}.recovery-claim.crashed-recovery.1.json`;
    renameSync(active, stranded);
    const claim = {
      bytes: Buffer.from(JSON.stringify(persisted), 'utf8'),
      path: stranded,
      requestId: persisted.requestId,
    };

    await expect(
      acknowledgeRelayClaim(
        claim,
        {
          issueNumber: 1479,
          receiptId: 'receipt-recovery-claim',
          requestId: persisted.requestId,
          state: 'filed',
        },
        { faults: { afterAck: () => Promise.reject(new Error('cleanup crash')) } },
      ),
    ).rejects.toThrow('cleanup crash');
    await recoverRelaySpool(project, 2);

    await expect(listRelayDeadLetters(project)).resolves.toEqual([]);
    await expect(listRelayRequests(project)).resolves.toEqual([]);
    await expect(persistRelayDraft(project, draft)).resolves.toBeUndefined();
  });

  it('restores expired recovery claims before listing operator dead letters', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-expired-list', title: 'expired list' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing relay request');
    const active = activeRequestPath(project, persisted.requestId);
    renameSync(
      active,
      active.replace(/(?:\.materializing)?\.json$/u, '.recovery-claim.expired-list.1.json'),
    );

    await expect(listRelayDeadLetters(project)).resolves.toEqual([
      expect.objectContaining({ requestId: persisted.requestId }),
    ]);
  });

  it.each(['delivery', 'recovery'] as const)(
    'tolerates concurrent cleanup of duplicate expired %s claims',
    async claimKind => {
      const project = temporaryProject();
      const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
      const persisted = await persistRelayDraft(
        project,
        request({
          sourceKey: `source-expired-race-${claimKind}`,
          title: `expired race ${claimKind}`,
        }),
      );
      if (persisted === undefined) throw new Error('missing relay request');
      const active = activeRequestPath(project, persisted.requestId);
      const claim =
        claimKind === 'delivery'
          ? `${persisted.requestId}.claim.duplicate.1.json`
          : `${persisted.requestId}.recovery-claim.duplicate.1.json`;
      writeFileSync(path.join(directory, claim), readFileSync(active));

      await expect(
        recoverRelaySpool(project, 2, {
          faults: {
            beforeDuplicateRead: claimPath => {
              rmSync(claimPath);
              return Promise.resolve();
            },
          },
        }),
      ).resolves.toBeUndefined();
      await expect(listRelayRequests(project)).resolves.toHaveLength(1);
    },
  );

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
      const active = activeRequestPath(project, original.requestId);

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
      else await expect(repeated).rejects.toThrow('corrupt durable identity');
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
    writeFileSync(activeRequestPath(project, poisoned.requestId), '{"requestId":');

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

  it('[ORR-037] does not report persistence success when file synchronization fails', async () => {
    const project = temporaryProject();
    const original = request();

    await expect(
      persistRelayRequest(project, original, {
        faults: { beforeFileSync: () => Promise.reject(new Error('simulated fsync failure')) },
      }),
    ).rejects.toThrow('simulated fsync failure');
  });

  it('[ORR-037] does not report persistence success when directory synchronization fails', async () => {
    const project = temporaryProject();
    const original = request();

    await expect(
      persistRelayRequest(project, original, {
        faults: {
          beforeDirectorySync: () => Promise.reject(new Error('simulated directory fsync failure')),
        },
      }),
    ).rejects.toThrow('simulated directory fsync failure');
    expect(readdirSync(path.join(project, '.safeword', 'retro-drafts', 'relay'))).toHaveLength(0);
    await expect(persistRelayRequest(project, original)).resolves.toMatchObject({
      bytes: Buffer.from(JSON.stringify(original), 'utf8'),
    });
  });

  it('synchronizes a concurrent winner before accepting its existing durable target', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request({ sourceKey: 'directory-seed' }));
    const original = request();
    const winnerAtSync = deferred<undefined>();
    const winnerCanSync = deferred<undefined>();
    const winner = persistRelayRequest(project, original, {
      faults: {
        beforeDirectorySync: async () => {
          winnerAtSync.resolve(undefined);
          await winnerCanSync.promise;
        },
      },
    });
    await winnerAtSync.promise;
    const loserDirectorySync = vi.fn<() => Promise<void>>(() => Promise.resolve());

    try {
      await expect(
        persistRelayRequest(project, original, {
          faults: { beforeDirectorySync: loserDirectorySync },
        }),
      ).resolves.toMatchObject({ bytes: Buffer.from(JSON.stringify(original), 'utf8') });
      expect(loserDirectorySync).toHaveBeenCalledOnce();
    } finally {
      winnerCanSync.resolve(undefined);
      await winner;
    }
  });

  it('[ORR-005] An active spool claim excludes another session', async () => {
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
  });

  it('[ORR-006] An expired spool claim is rearmed without changing the request', async () => {
    const project = temporaryProject();
    const original = request();
    await persistRelayRequest(project, original);
    const first = await claimRelayRequest(project, {
      claimId: 'first',
      leaseMs: 100,
      now: 1000,
    });
    const successor = await claimRelayRequest(project, {
      claimId: 'second',
      leaseMs: 100,
      now: 1101,
    });
    if (first === undefined || successor === undefined) throw new Error('expected both claims');
    expect(successor?.requestId).toBe(original.requestId);
    expect(successor?.bytes).toEqual(first?.bytes);
  });

  it('prevents an expired claimant from acknowledging its successor', async () => {
    const project = temporaryProject();
    const original = request();
    await persistRelayRequest(project, original);
    const first = await claimRelayRequest(project, {
      claimId: 'first',
      leaseMs: 100,
      now: 1000,
    });
    const successor = await claimRelayRequest(project, {
      claimId: 'second',
      leaseMs: 100,
      now: 1101,
    });
    if (first === undefined || successor === undefined) throw new Error('expected both claims');

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

  it('[ORR-008] uses ack as the authoritative commit and recovers crash-before-cleanup', async () => {
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
        { faults: { afterAck: () => Promise.reject(new Error('crash')) } },
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

  it('[ORR-007] cannot lose a concurrent request while another request is acknowledged', async () => {
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

  it.each(['ambiguous', 'future-state'])(
    'keeps a request queued when a successful relay response reports %s ownership',
    async state => {
      const project = temporaryProject();
      const original = request();
      await persistRelayRequest(project, original);

      const outcome = await deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: () =>
          Promise.resolve(
            Response.json(
              {
                receiptId: `receipt-${state}`,
                requestId: original.requestId,
                state,
              },
              { status: 201 },
            ),
          ),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      });

      expect(outcome).toMatchObject({ accepted: 0, retryable: 1 });
      expect(await listRelayRequests(project)).toHaveLength(1);
    },
  );

  it.each([
    'accepted',
    'claimed',
    'dispatching',
    'filed',
    'retryable',
    'dead-letter',
    'rejected',
    'tombstone',
  ])('acknowledges the relay ownership state %s', async state => {
    const project = temporaryProject();
    const original = request();
    await persistRelayRequest(project, original);

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: () =>
        Promise.resolve(
          Response.json(
            {
              receiptId: `receipt-${state}`,
              requestId: original.requestId,
              state,
            },
            { status: 201 },
          ),
        ),
      now: Date.now,
      relayUrl: 'https://relay.invalid',
    });

    expect(outcome).toMatchObject({
      accepted: 1,
      retryable: 0,
      ...(['dead-letter', 'rejected', 'tombstone'].includes(state) && {
        serverReportedTerminalReceipts: [
          {
            receiptId: `receipt-${state}`,
            requestId: original.requestId,
            state,
          },
        ],
      }),
    });
    expect(await listRelayRequests(project)).toHaveLength(0);
  });

  it.each([
    ['dead-letter', undefined],
    ['rejected', undefined],
    ['tombstone', 1479],
  ] as const)(
    'returns operator-addressable details when durable ownership ends in %s',
    async (state, issueNumber) => {
      const project = temporaryProject();
      const original = request();
      await persistRelayRequest(project, original);

      const outcome = await deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: () =>
          Promise.resolve(
            Response.json(
              {
                ...(issueNumber !== undefined && { issueNumber }),
                receiptId: `receipt-${state}`,
                requestId: original.requestId,
                state,
              },
              { status: 200 },
            ),
          ),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      });

      expect(outcome).toMatchObject({
        accepted: 1,
        serverReportedTerminalReceipts: [
          {
            ...(issueNumber !== undefined && { issueNumber }),
            receiptId: `receipt-${state}`,
            requestId: original.requestId,
            state,
          },
        ],
      });
    },
  );

  it('sends the stable relay API version on submissions', async () => {
    const project = temporaryProject();
    const original = request();
    await persistRelayRequest(project, original);
    let observedHeaders: Headers | undefined;

    await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: (_input, init) => {
        observedHeaders = new Headers(init?.headers);
        return Promise.resolve(
          Response.json(
            {
              receiptId: 'receipt-versioned',
              requestId: original.requestId,
              state: 'accepted',
            },
            { status: 202 },
          ),
        );
      },
      now: Date.now,
      relayUrl: 'https://relay.invalid',
    });

    expect(observedHeaders?.get('x-safeword-relay-api-version')).toBe('1');
  });

  it('attempts the earliest retry deadline before lexical UUID order', async () => {
    const project = temporaryProject();
    const requests = [
      request({
        createdAt: '2026-07-30T00:00:00.000Z',
        requestId: '00000000-0000-4000-8000-000000000001',
        retryDeadlineAt: '2099-01-03T00:00:00.000Z',
        sourceKey: 'deadline-latest',
      }),
      request({
        createdAt: '2026-07-30T00:00:00.000Z',
        requestId: '00000000-0000-4000-8000-000000000002',
        retryDeadlineAt: '2099-01-02T00:00:00.000Z',
        sourceKey: 'deadline-middle',
      }),
      request({
        createdAt: '2026-07-30T00:00:00.000Z',
        requestId: '00000000-0000-4000-8000-000000000003',
        retryDeadlineAt: '2099-01-01T00:00:00.000Z',
        sourceKey: 'deadline-earliest',
      }),
    ];
    for (const candidate of requests) await persistRelayRequest(project, candidate);
    const attempted: string[] = [];

    await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: acceptedRelayFetch(submitted => {
        attempted.push(submitted.requestId);
      }),
      now: Date.now,
      overallDeadlineMs: 1000,
      relayUrl: 'https://relay.invalid',
    });

    expect(attempted).toEqual([
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
    ]);
  });

  it('dead-letters shape-invalid JSON before deadline ordering and continues the drain', async () => {
    const project = temporaryProject();
    const corrupt = request({
      requestId: '00000000-0000-4000-8000-000000000001',
      sourceKey: 'shape-invalid',
    });
    const healthy = request({
      requestId: '00000000-0000-4000-8000-000000000002',
      sourceKey: 'shape-valid',
    });
    await persistRelayRequest(project, corrupt);
    await persistRelayRequest(project, healthy);
    writeFileSync(activeRequestPath(project, corrupt.requestId), '{}');

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: acceptedRelayFetch(),
      now: Date.now,
      overallDeadlineMs: 1000,
      relayUrl: 'https://relay.invalid',
    });

    expect(outcome).toMatchObject({
      accepted: 1,
      deadLetterBacklog: 1,
      deadLetteredThisRun: 1,
      retryable: 0,
    });
    await expect(listRelayDeadLetters(project)).resolves.toHaveLength(1);
  });

  it('fails closed when an unreserved corrupt record cannot prove its source identity', async () => {
    const project = temporaryProject();
    const healthy = request({
      requestId: '00000000-0000-4000-8000-000000000010',
      sourceKey: 'healthy-before-corruption',
    });
    await persistRelayRequest(project, healthy);
    const directory = path.join(project, '.safeword', 'retro-drafts', 'relay');
    const corruptId = '00000000-0000-4000-8000-000000000011';
    writeFileSync(path.join(directory, `${corruptId}.json`), '{}');

    await expect(
      persistRelayDraft(
        project,
        request({ sourceKey: 'unrelated-after-corruption', title: 'unrelated durable draft' }),
      ),
    ).rejects.toThrow(`corrupt durable identity: ${corruptId}`);
    expect(readdirSync(directory)).toContain(`${corruptId}.json`);
  });

  it('uses the remaining aggregate budget after reserving cleanup time', async () => {
    const project = temporaryProject();
    const poison = request({
      requestId: '00000000-0000-4000-8000-000000000012',
      retryDeadlineAt: '2099-01-01T00:00:00.000Z',
      sourceKey: 'poison-earliest',
    });
    const healthy = request({
      requestId: '00000000-0000-4000-8000-000000000013',
      retryDeadlineAt: '2099-01-02T00:00:00.000Z',
      sourceKey: 'healthy-later',
    });
    await persistRelayRequest(project, poison);
    await persistRelayRequest(project, healthy);
    const attempted: string[] = [];
    let elapsed = 0;
    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 500,
      fetch: (_input, init) => {
        const submitted = JSON.parse(
          Buffer.from(init?.body as Uint8Array).toString('utf8'),
        ) as RelayDraftRequest;
        attempted.push(submitted.requestId);
        if (submitted.requestId === poison.requestId) {
          elapsed = 500;
          return Promise.resolve(new Response(undefined, { status: 503 }));
        }
        return Promise.resolve(
          Response.json({
            receiptId: 'receipt-healthy',
            requestId: healthy.requestId,
            state: 'accepted',
          }),
        );
      },
      monotonicNow: () => elapsed,
      now: Date.now,
      overallDeadlineMs: 750,
      relayUrl: 'https://relay.invalid',
    });

    expect(attempted).toEqual([poison.requestId, healthy.requestId]);
    expect(outcome).toMatchObject({ accepted: 1, retryable: 1 });
  });

  it('defers two timed-out poison requests so a healthy request runs on a later bounded invocation', async () => {
    const project = temporaryProject();
    const poisonOne = request({
      requestId: '00000000-0000-4000-8000-000000000014',
      retryDeadlineAt: '2099-01-01T00:00:00.000Z',
      sourceKey: 'poison-one',
    });
    const poisonTwo = request({
      requestId: '00000000-0000-4000-8000-000000000015',
      retryDeadlineAt: '2099-01-02T00:00:00.000Z',
      sourceKey: 'poison-two',
    });
    const healthy = request({
      requestId: '00000000-0000-4000-8000-000000000016',
      retryDeadlineAt: '2099-01-03T00:00:00.000Z',
      sourceKey: 'healthy-after-poisons',
    });
    await Promise.all([
      persistRelayRequest(project, poisonOne),
      persistRelayRequest(project, poisonTwo),
      persistRelayRequest(project, healthy),
    ]);
    let elapsed = 0;
    const attempts: string[] = [];
    const options = {
      credential: 'swc_client_secret',
      fetch: ((_input: string | URL | Request, init?: RequestInit) => {
        const submitted = JSON.parse(
          Buffer.from(init?.body as Uint8Array).toString('utf8'),
        ) as RelayDraftRequest;
        attempts.push(submitted.requestId);
        if (submitted.requestId !== healthy.requestId) {
          elapsed += 500;
          return Promise.resolve(new Response(undefined, { status: 503 }));
        }
        return Promise.resolve(
          Response.json({
            receiptId: 'receipt-healthy-after-poisons',
            requestId: healthy.requestId,
            state: 'accepted',
          }),
        );
      }) as typeof fetch,
      deadlineMs: 500,
      monotonicNow: () => elapsed,
      now: () => 0,
      overallDeadlineMs: 750,
      relayUrl: 'https://relay.invalid',
    };

    await deliverRelayRequests(project, options);
    elapsed = 0;
    const secondOutcome = await deliverRelayRequests(project, options);
    elapsed = 0;
    const outcome = await deliverRelayRequests(project, options);

    expect(attempts).toEqual([poisonOne.requestId, poisonTwo.requestId, healthy.requestId]);
    expect(secondOutcome).toMatchObject({ accepted: 1 });
    expect(outcome).toMatchObject({ accepted: 0 });
  });

  it('rearms an incompatible relay-version response rather than dead-lettering it', async () => {
    const project = temporaryProject();
    const original = request({ sourceKey: 'version-mismatch' });
    await persistRelayRequest(project, original);

    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: () => Promise.resolve(Response.json({ supportedVersion: '2' }, { status: 400 })),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({ deadLetteredThisRun: 0, retryable: 1 });
  });

  it('rearms malformed successful relay receipts instead of acknowledging them', async () => {
    const project = temporaryProject();
    const original = request({ sourceKey: 'malformed-success-receipt' });
    await persistRelayRequest(project, original);

    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: () =>
          Promise.resolve(
            Response.json({
              issueNumber: 'not-a-number',
              receiptId: 'receipt-malformed',
              requestId: original.requestId,
              state: 'accepted',
            }),
          ),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({ accepted: 0, retryable: 1 });
  });

  it('[ORR-003] preserves the draft without delaying the session when the relay is unavailable', async () => {
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
      deadLetteredThisRun: 0,
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
      deadLetteredThisRun: 1,
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
      deadLetteredThisRun: 0,
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
    ).resolves.toMatchObject({
      deadLetterBacklog: 1,
      deadLetteredThisRun: 1,
      retryable: 0,
    });
    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: send,
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({
      deadLetterBacklog: 1,
      deadLetteredThisRun: 0,
      retryable: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('removes stale atomic-write temporaries without touching a live writer', async () => {
    const project = temporaryProject();
    const persisted = await persistRelayRequest(project, request());
    const stale = `${persisted.path}.tmp.00000000-0000-4000-8000-000000000001`;
    const live = `${persisted.path}.tmp.00000000-0000-4000-8000-000000000002`;
    writeFileSync(stale, 'stale');
    writeFileSync(live, 'live');
    utimesSync(stale, new Date(0), new Date(0));
    const now = 120_000;

    await recoverRelaySpool(project, now);

    expect(readdirSync(path.dirname(persisted.path))).not.toContain(path.basename(stale));
    expect(readFileSync(live, 'utf8')).toBe('live');
  });

  it('keeps a durable target successful when best-effort temporary cleanup fails', async () => {
    const project = temporaryProject();
    const relayRequest = request({ sourceKey: 'best-effort-temp-cleanup' });

    const persisted = await persistRelayRequest(project, relayRequest, {
      faults: {
        beforeTemporaryUnlink: () => Promise.reject(new Error('temporary unlink failed')),
      },
    });

    expect(readFileSync(persisted.path)).toEqual(persisted.bytes);
    const directory = path.dirname(persisted.path);
    expect(readdirSync(directory).filter(filename => filename.includes('.tmp.'))).toHaveLength(1);
    await recoverRelaySpool(project, Date.now() + 60_001);
    expect(readdirSync(directory).filter(filename => filename.includes('.tmp.'))).toEqual([]);
  });

  it('persists a batch without rescanning every queued payload for each finding', async () => {
    const project = temporaryProject();
    for (let index = 0; index < 500; index += 1) {
      const queued = request({
        requestId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        sourceKey: `queued-${index}`,
        title: `Queued ${index}`,
      });
      await persistRelayRequest(project, queued);
    }
    const drafts = Array.from({ length: 50 }, (_value, index) => ({
      body: `New body ${index}`,
      canonicalKey: `canonical:new-${index}`,
      installationId: 42,
      labels: ['retro'],
      legacySignature: `retro:new-${index}`,
      repository: 'arcadeai/safeword',
      sourceKey: `new-${index}`,
      title: `New ${index}`,
    }));
    // A wall-clock ceiling is not a stable complexity proof in Node. One shared
    // snapshot is: rescanning the 500 queued files for each of 50 drafts would
    // have to invoke this seam once per draft.
    const stateSnapshot = vi.fn();
    const outcomes = await persistRelayDraftBatch(project, drafts, {
      faults: {
        afterStateSnapshot: () => {
          stateSnapshot();
          return Promise.resolve();
        },
      },
    });

    expect(stateSnapshot).toHaveBeenCalledOnce();
    expect(outcomes).toHaveLength(50);
    expect(outcomes.every(outcome => outcome.status === 'fulfilled')).toBe(true);
  });

  it('materializes when a snapshotted discard intent is canceled before resolution', async () => {
    const project = temporaryProject();
    const draft = request({ sourceKey: 'source-canceled-intent', title: 'Canceled intent' });
    const persisted = await persistRelayDraft(project, draft);
    if (persisted === undefined) throw new Error('missing persisted request');
    const active = activeRequestPath(project, persisted.requestId);
    rmSync(active);
    const token = '00000000-0000-4000-8000-000000000099';
    const intent = path.join(
      path.dirname(active),
      `${persisted.requestId}.discarding.${token}.json`,
    );
    writeFileSync(
      intent,
      JSON.stringify({
        claimId: 'canceled-intent-owner',
        expiresAt: Date.now() + 60_000,
        requestId: persisted.requestId,
        startedAt: new Date().toISOString(),
        token,
        version: 1,
      }),
    );

    await expect(
      persistRelayDraft(project, draft, {
        faults: {
          afterStateSnapshot: () => {
            rmSync(intent);
            return Promise.resolve();
          },
        },
      }),
    ).resolves.toMatchObject({ requestId: persisted.requestId });
    await expect(listRelayRequests(project)).resolves.toHaveLength(1);
  });

  it('settles every draft when the coordinated state snapshot fails', async () => {
    const project = temporaryProject();
    const drafts = [
      request({ sourceKey: 'snapshot-failure-a', title: 'Snapshot failure A' }),
      request({ sourceKey: 'snapshot-failure-b', title: 'Snapshot failure B' }),
    ];

    await expect(
      persistRelayDraftBatch(project, drafts, {
        faults: { afterStateSnapshot: () => Promise.reject(new Error('snapshot failed')) },
      }),
    ).resolves.toEqual([
      { reason: expect.objectContaining({ message: 'snapshot failed' }), status: 'rejected' },
      { reason: expect.objectContaining({ message: 'snapshot failed' }), status: 'rejected' },
    ]);
  });

  it('rejects the whole persistence batch for an unreserved active corrupt request', async () => {
    const project = temporaryProject();
    const corrupt = request({
      sourceKey: 'unreserved-corrupt',
      title: 'Unreserved corrupt request',
    });
    const persistedCorrupt = await persistRelayRequest(project, corrupt);
    writeFileSync(persistedCorrupt.path, '{"requestId":');
    const drafts = [
      request({ sourceKey: 'after-corrupt-a', title: 'After corrupt A' }),
      request({ sourceKey: 'after-corrupt-b', title: 'After corrupt B' }),
    ];

    const outcomes = await persistRelayDraftBatch(project, drafts);

    expect(outcomes).toEqual([
      { reason: expect.objectContaining({ requestIds: [corrupt.requestId] }), status: 'rejected' },
      { reason: expect.objectContaining({ requestIds: [corrupt.requestId] }), status: 'rejected' },
    ]);
    expect(readFileSync(persistedCorrupt.path, 'utf8')).toBe('{"requestId":');
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
    ).resolves.toMatchObject({
      deadLetterBacklog: 1,
      deadLetteredThisRun: 1,
      retryable: 0,
    });
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
    ).resolves.toMatchObject({
      deadLetterBacklog: 0,
      deadLetteredThisRun: 0,
      retryable: 1,
    });
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
    ).resolves.toMatchObject({ deadLetteredThisRun: 0, retryable: 1 });
    expect(await listRelayRequests(project)).toHaveLength(1);
    expect(await listRelayDeadLetters(project)).toHaveLength(0);
  });

  it('rejects an invalid relay URL without claiming or scheduling durable work', async () => {
    const project = temporaryProject();
    const original = request({ sourceKey: 'invalid-relay-url' });
    const persisted = await persistRelayRequest(project, original);
    const fetch = vi.fn<typeof globalThis.fetch>();

    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch,
        now: Date.now,
        relayUrl: 'not a URL',
      }),
    ).rejects.toThrow('invalid relay URL');

    expect(fetch).not.toHaveBeenCalled();
    expect(readFileSync(persisted.path, 'utf8')).toBe(JSON.stringify(original));
    expect(readdirSync(path.dirname(persisted.path))).not.toContain(
      `${original.requestId}.retry-schedule.json`,
    );
  });

  it.each([
    ['invalid JSON', '{not-json'],
    ['negative attempt count', JSON.stringify({ attemptCount: -1, nextAttemptAt: 0, version: 1 })],
    ['negative next attempt', JSON.stringify({ attemptCount: 1, nextAttemptAt: -1, version: 1 })],
  ])('self-heals a retry schedule with %s before delivery', async (_case, serialized) => {
    const project = temporaryProject();
    const original = request({ sourceKey: 'malformed-schedule' });
    const persisted = await persistRelayRequest(project, original);
    writeFileSync(retrySchedulePath(project, original.requestId), serialized);

    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: acceptedRelayFetch(),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).resolves.toMatchObject({ accepted: 1, retryable: 0 });

    expect(readdirSync(path.dirname(persisted.path))).not.toContain(
      `${original.requestId}.retry-schedule.json`,
    );
  });

  it.skipIf(
    process.platform === 'win32' ||
      (typeof process.getuid === 'function' && process.getuid() === 0),
  )('surfaces retry schedule filesystem errors without deleting the schedule', async () => {
    const project = temporaryProject();
    const original = request({ sourceKey: 'unreadable-schedule' });
    const persisted = await persistRelayRequest(project, original);
    const schedule = retrySchedulePath(project, original.requestId);
    writeFileSync(schedule, JSON.stringify({ attemptCount: 1, nextAttemptAt: 0, version: 1 }));
    chmodSync(schedule, 0o000);

    await expect(
      deliverRelayRequests(project, {
        credential: 'swc_client_secret',
        deadlineMs: 25,
        fetch: acceptedRelayFetch(),
        now: Date.now,
        relayUrl: 'https://relay.invalid',
      }),
    ).rejects.toMatchObject({ code: 'EACCES' });

    expect(readdirSync(path.dirname(persisted.path))).toContain(path.basename(schedule));
    chmodSync(schedule, 0o600);
  });

  it('removes a retry schedule when the request is discarded', async () => {
    const project = temporaryProject();
    const original = request({ sourceKey: 'discard-schedule' });
    const persisted = await persistRelayRequest(project, original);

    await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: () => Promise.resolve(new Response(undefined, { status: 503 })),
      now: Date.now,
      relayUrl: 'https://relay.invalid',
    });
    expect(readdirSync(path.dirname(persisted.path))).toContain(
      `${original.requestId}.retry-schedule.json`,
    );

    await expect(discardRelayRequest(project, original.requestId)).resolves.toBe(true);
    expect(readdirSync(path.dirname(persisted.path))).not.toContain(
      `${original.requestId}.retry-schedule.json`,
    );
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

  it('uses full attempts only when the aggregate budget includes cleanup reserve', async () => {
    const project = temporaryProject();
    for (const [index, title] of ['first', 'second', 'third'].entries()) {
      await persistRelayRequest(
        project,
        request({
          requestId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          sourceKey: `source-bounded-${index}`,
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
      deadlineMs: 100,
      overallDeadlineMs: 1000,
      fetch: send,
      monotonicNow: () => now,
      now: () => now,
      relayUrl: 'https://relay.invalid',
    });

    expect(send).toHaveBeenCalledTimes(3);
    expect(outcome.accepted).toBe(3);
    expect(await listRelayRequests(project)).toHaveLength(0);
  });

  it('normalizes the configured relay origin before submitting', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request());
    const observedUrls: string[] = [];
    const send = vi.fn<typeof fetch>((input, init) => {
      let observedUrl: string;
      if (typeof input === 'string') observedUrl = input;
      else if (input instanceof URL) observedUrl = input.href;
      else observedUrl = input.url;
      observedUrls.push(observedUrl);
      const submitted = JSON.parse(
        Buffer.from(init?.body as Uint8Array).toString('utf8'),
      ) as RelayDraftRequest;
      return Promise.resolve(
        Response.json(
          {
            receiptId: 'receipt-normalized-url',
            requestId: submitted.requestId,
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

  it('rearms a claim when the relay receipt belongs to another request', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request());

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 500,
      fetch: () =>
        Promise.resolve(
          Response.json({
            receiptId: 'receipt-wrong-request',
            requestId: '00000000-0000-4000-8000-000000000000',
            state: 'filed',
          }),
        ),
      now: Date.now,
      relayUrl: 'https://relay.invalid',
    });

    expect(outcome.accepted).toBe(0);
    expect(outcome.retryable).toBe(1);
    await expect(listRelayRequests(project)).resolves.toHaveLength(1);
  });

  it('does not start an HTTP attempt without its full deadline plus cleanup reserve', async () => {
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

  it('does not extend the default drain beyond the session budget after durable overhead', async () => {
    const project = temporaryProject();
    await persistRelayRequest(project, request());
    const send = vi.fn<typeof fetch>((_input, init) => {
      const sent = JSON.parse(
        Buffer.from(init?.body as Uint8Array).toString('utf8'),
      ) as RelayDraftRequest;
      return Promise.resolve(
        Response.json(
          {
            receiptId: 'receipt-after-durable-overhead',
            requestId: sent.requestId,
            state: 'filed',
          },
          { status: 201 },
        ),
      );
    });

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 25,
      fetch: send,
      monotonicNow: sequenceClock(0, 751, 751, 751),
      now: () => 0,
      relayUrl: 'https://relay.invalid',
    });

    expect(send).not.toHaveBeenCalled();
    expect(outcome.accepted).toBe(0);
    expect(outcome.retryable).toBe(1);
  });

  it('[ORR-004] A multi-draft drain shares one aggregate latency budget', async () => {
    const project = temporaryProject();
    for (const [index, title] of ['first', 'second', 'third'].entries()) {
      await persistRelayRequest(
        project,
        request({
          requestId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          sourceKey: `source-budget-${index}`,
          title,
        }),
      );
    }
    let elapsed = 0;
    const attemptStartedAt: number[] = [];
    const send = vi.fn<typeof fetch>(() => {
      attemptStartedAt.push(elapsed);
      elapsed += 500;
      return Promise.reject(new Error('simulated relay blackhole'));
    });

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 500,
      fetch: send,
      monotonicNow: () => elapsed,
      now: () => 0,
      relayUrl: 'https://relay.invalid',
    });

    expect(attemptStartedAt).toEqual([0, 500]);
    expect(attemptStartedAt.every(startedAt => startedAt < 1000)).toBe(true);
    expect(outcome.retryable).toBe(3);
  });

  it('bounds a multi-draft blackhole below 1.5 seconds in wall-clock time', async () => {
    const project = temporaryProject();
    for (const [index, title] of ['first', 'second', 'third'].entries()) {
      await persistRelayRequest(
        project,
        request({
          requestId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          sourceKey: `source-blackhole-${index}`,
          title,
        }),
      );
    }
    const send = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('simulated relay blackhole'));
          });
        }),
    );
    const startedAt = performance.now();

    const outcome = await deliverRelayRequests(project, {
      credential: 'swc_client_secret',
      deadlineMs: 500,
      fetch: send,
      now: Date.now,
      relayUrl: 'https://relay.invalid',
    });

    // Keep CI scheduler jitter outside the production budget assertion. The
    // delivery loop still receives its unchanged 500 ms request deadline and
    // 250 ms aggregate headroom; this ceiling only bounds wall-clock overhead.
    expect(performance.now() - startedAt).toBeLessThan(1500);
    // Scheduler and durable-I/O overhead decide whether the aggregate budget
    // can fit a partial second attempt; both outcomes preserve the deadline.
    expect(send.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(send.mock.calls.length).toBeLessThanOrEqual(2);
    expect(outcome.retryable).toBe(3);
  });
});

describe('relay readiness provenance', () => {
  it('keeps the checked-in public route disabled', () => {
    expect(CHECKED_IN_RELAY_READINESS).toEqual({ enabled: false, version: 1 });
  });

  it('accepts only fresh evidence reachable from the immutable build', async () => {
    const manifest = validManifest();
    const result = await validateRelayReadiness(manifest, validReadinessDependencies(manifest));
    expect(result).toEqual({ enabled: true });
  });

  it('accepts versioned drain evidence that records its timing configuration', async () => {
    const manifest = validManifest();
    const content = JSON.stringify({
      measuredAt: manifest.measurements.drainThroughput.measuredAt,
      metric: 'drainThroughput',
      repository: 'ArcadeAI/safeword',
      result: {
        acceptedCount: 2,
        backlogSize: 300,
        durationMs: 700,
        overallDeadlineMs: 750,
        relayLatencyMs: 80,
        requestDeadlineMs: 500,
      },
      sampleSize: 300,
      version: 2,
    });
    const result = await validateRelayReadiness(
      manifest,
      validReadinessDependencies(manifest, {
        readArtifactAtCommit: (_commit, artifactPath) =>
          Promise.resolve(
            artifactPath === manifest.measurements.drainThroughput.path
              ? { content, sha256: manifest.measurements.drainThroughput.sha256 }
              : measurementArtifact(manifest, artifactPath),
          ),
      }),
    );

    expect(result).toEqual({ enabled: true });
  });

  it('rejects legacy drain evidence and v2 evidence with non-production budgets', async () => {
    const manifest = validManifest();
    const drainArtifact = manifest.measurements.drainThroughput;
    const invalidContents = [
      JSON.stringify({
        measuredAt: drainArtifact.measuredAt,
        metric: 'drainThroughput',
        repository: 'ArcadeAI/safeword',
        result: { acceptedCount: 2, backlogSize: 300, durationMs: 700, relayLatencyMs: 80 },
        sampleSize: 300,
        version: 1,
      }),
      JSON.stringify({
        measuredAt: drainArtifact.measuredAt,
        metric: 'drainThroughput',
        repository: 'ArcadeAI/safeword',
        result: {
          acceptedCount: 2,
          backlogSize: 300,
          durationMs: 700,
          overallDeadlineMs: 700,
          relayLatencyMs: 80,
          requestDeadlineMs: 500,
        },
        sampleSize: 300,
        version: 2,
      }),
    ];
    for (const content of invalidContents) {
      await expect(
        validateRelayReadiness(
          manifest,
          validReadinessDependencies(manifest, {
            isAncestor: () => Promise.resolve(true),
            readArtifactAtCommit: (_commit, artifactPath) =>
              Promise.resolve(
                artifactPath === drainArtifact.path
                  ? { content, sha256: drainArtifact.sha256 }
                  : measurementArtifact(manifest, artifactPath),
              ),
          }),
        ),
      ).resolves.toEqual({ enabled: false });
    }
  });

  it('requires hash-attested bounded drain-throughput evidence before enabling relay routing', async () => {
    const manifest = validManifest();
    delete (manifest.measurements as unknown as Record<string, unknown>).drainThroughput;

    const result = await validateRelayReadiness(
      manifest,
      validReadinessDependencies(manifest, {
        isAncestor: () => Promise.resolve(true),
        readArtifactAtCommit: (_commit, artifactPath) => {
          const artifact = Object.values(manifest.measurements).find(
            candidate => candidate.path === artifactPath,
          );
          return Promise.resolve(
            artifact === undefined
              ? undefined
              : {
                  content: measurementContent(manifest, artifactPath),
                  sha256: artifact.sha256,
                },
          );
        },
      }),
    );

    expect(result).toEqual({ enabled: false });
  });

  it.each([
    ['accepted count', 'acceptedCount', 1],
    ['backlog size', 'backlogSize', 299],
    ['duration', 'durationMs', 1000],
    ['relay latency', 'relayLatencyMs', 79],
  ])(
    'fails closed when drain-throughput %s misses its readiness floor',
    async (_name, key, value) => {
      const manifest = validManifest();

      const result = await validateRelayReadiness(
        manifest,
        validReadinessDependencies(manifest, {
          isAncestor: () => Promise.resolve(true),
          readArtifactAtCommit: (_commit, artifactPath) => {
            const artifact = measurementArtifact(manifest, artifactPath);
            if (artifactPath !== manifest.measurements.drainThroughput.path) {
              return Promise.resolve(artifact);
            }
            const evidence = JSON.parse(artifact.content) as {
              result: Record<string, number>;
            };
            evidence.result[key] = value;
            return Promise.resolve({ content: JSON.stringify(evidence), sha256: artifact.sha256 });
          },
        }),
      );

      expect(result).toEqual({ enabled: false });
    },
  );

  it('[ORR-035] fails closed when a hash-attested measurement has an empty sample', async () => {
    const manifest = validManifest();
    manifest.measurements.spooledNeverFiled.sampleSize = 0;

    const result = await validateRelayReadiness(
      manifest,
      validReadinessDependencies(manifest, {
        isAncestor: () => Promise.resolve(true),
        readArtifactAtCommit: (_commit, artifactPath) =>
          Promise.resolve({
            content: measurementContent(manifest, artifactPath),
            sha256: measurementArtifact(manifest, artifactPath).sha256,
          }),
      }),
    );

    expect(result).toEqual({ enabled: false });
  });

  it.each(['sameSignatureCollisions', 'spooledNeverFiled'] as const)(
    'fails closed when %s records any failure',
    async metric => {
      const manifest = validManifest();
      const result = await validateRelayReadiness(
        manifest,
        validReadinessDependencies(manifest, {
          isAncestor: () => Promise.resolve(true),
          readArtifactAtCommit: (_commit, artifactPath) => {
            const artifact = measurementArtifact(manifest, artifactPath);
            if (artifactPath !== manifest.measurements[metric].path) {
              return Promise.resolve(artifact);
            }
            const evidence = JSON.parse(artifact.content) as { result: { count: number } };
            evidence.result.count = 1;
            const content = JSON.stringify(evidence);
            const sha256 = createHash('sha256').update(content).digest('hex');
            manifest.measurements[metric].sha256 = sha256;
            return Promise.resolve({ content, sha256 });
          },
        }),
      );

      expect(result).toEqual({ enabled: false });
    },
  );

  it('[ORR-035] fails closed when hash-attested content describes the wrong measurement', async () => {
    const manifest = validManifest();

    const result = await validateRelayReadiness(
      manifest,
      validReadinessDependencies(manifest, {
        isAncestor: () => Promise.resolve(true),
        readArtifactAtCommit: (_commit, artifactPath) => {
          const artifact = measurementArtifact(manifest, artifactPath);
          const evidence = JSON.parse(artifact.content) as { metric: string };
          evidence.metric =
            evidence.metric === 'sameSignatureCollisions'
              ? 'spooledNeverFiled'
              : 'sameSignatureCollisions';
          const content = JSON.stringify(evidence);
          const sha256 = createHash('sha256').update(content).digest('hex');
          const measurement = Object.values(manifest.measurements).find(
            candidate => candidate.path === artifactPath,
          );
          if (measurement === undefined) throw new Error('missing readiness measurement');
          measurement.sha256 = sha256;
          return Promise.resolve({ content, sha256 });
        },
      }),
    );

    expect(result).toEqual({ enabled: false });
  });

  it.each([
    [
      'an extra prerequisite',
      (manifest: RelayReadinessManifest) => {
        manifest.prerequisites.push({ ...manifest.prerequisites[1] });
      },
    ],
    [
      'a review timestamp before its evidence',
      (manifest: RelayReadinessManifest) => {
        manifest.reviewedAt = '2026-07-24T12:00:00.000Z';
      },
    ],
  ])('fails closed for %s', async (_description, mutate) => {
    const manifest = validManifest();
    mutate(manifest);

    await expect(
      validateRelayReadiness(
        manifest,
        validReadinessDependencies(manifest, {
          isAncestor: () => Promise.resolve(true),
          readArtifactAtCommit: (_commit, artifactPath) =>
            Promise.resolve(measurementArtifact(manifest, artifactPath)),
        }),
      ),
    ).resolves.toEqual({ enabled: false });
  });

  it('[ORR-011] uses build-embedded evidence without consulting the customer repository', async () => {
    const manifest = validManifest();
    const result = await validateBuildAttestedRelayReadiness(
      manifest,
      buildAttestation(manifest),
      READINESS_NOW,
    );

    expect(result).toEqual({ enabled: true });
  });

  it('refuses a disabled build attestation even when its evidence is populated', async () => {
    const manifest = validManifest();

    const result = await validateBuildAttestedRelayReadiness(
      manifest,
      buildAttestation(manifest, {
        ancestorPairs: [],
        artifacts: {},
        enabled: false,
      }),
      READINESS_NOW,
    );

    expect(result).toEqual({ enabled: false });
  });

  it.each([
    ['ORR-013', 'unlanded prerequisite', (value: RelayReadinessManifest) => value],
    [
      'ORR-013',
      'wrong repository',
      (value: RelayReadinessManifest) => {
        value.prerequisites[0].url = 'https://github.com/other/repo/issues/1474';
        return value;
      },
    ],
    [
      'ORR-014',
      'other build',
      (value: RelayReadinessManifest) => {
        value.evidenceCommit = 'e'.repeat(40);
        return value;
      },
    ],
    [
      'ORR-012',
      'stale measurement',
      (value: RelayReadinessManifest) => {
        value.measurements.sameSignatureCollisions.measuredAt = '2026-01-01T00:00:00.000Z';
        return value;
      },
    ],
    [
      'ORR-012',
      'malformed artifact',
      (value: RelayReadinessManifest) => {
        value.measurements.sameSignatureCollisions.sha256 = 'not-a-sha256';
        return value;
      },
    ],
    ['readiness-hash-mismatch', 'hash mismatch', (value: RelayReadinessManifest) => value],
    [
      'readiness-future-measurement',
      'future measurement',
      (value: RelayReadinessManifest) => {
        value.measurements.sameSignatureCollisions.measuredAt = '2026-07-27T00:00:00.000Z';
        return value;
      },
    ],
  ])('[%s] fails closed for %s evidence', async (_proofId, kind, mutate) => {
    const manifest = mutate(validManifest());
    const result = await validateRelayReadiness(
      manifest,
      validReadinessDependencies(manifest, {
        isAncestor: ancestor =>
          Promise.resolve(
            (kind !== 'unlanded prerequisite' || ancestor !== 'c'.repeat(40)) &&
              (kind !== 'other build' || ancestor !== 'e'.repeat(40)),
          ),
        readArtifactAtCommit: (_commit, artifactPath) => {
          let sha256 = measurementArtifact(manifest, artifactPath).sha256;
          if (kind === 'hash mismatch') sha256 = '3'.repeat(64);
          return Promise.resolve({ content: measurementContent(manifest, artifactPath), sha256 });
        },
      }),
    );
    expect(result.enabled).toBe(false);
  });
});

describe('headless extraction credential boundary', () => {
  it('[ORR-015] constructs a minimal child environment without filing credentials', async () => {
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
      await extract(JSON.stringify({ message: { role: 'user', content: 'transcript' } }));
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
