import { getEventListeners } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  CredentialRegistry,
  GitHubRestClient,
  RelayStore,
  startRelayServer,
} from '../../retro-relay/src/index.js';
import { startPublicRetroCollector } from '../src/index.js';
import { PublicRetroStore } from '../src/store.js';
import { runRetroTransferWorker, transferOneRetro, waitForWorkerPoll } from '../src/worker.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) rmSync(directory, { force: true, recursive: true });
  directories.length = 0;
});

it('releases the abort listener after every ordinary worker pause', async () => {
  const signal = new AbortController().signal;

  for (let index = 0; index < 20; index += 1) await waitForWorkerPoll(0, signal);

  expect(getEventListeners(signal, 'abort')).toHaveLength(0);
});

it('transfers collector acceptance through the real relay contract', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-worker-relay-'));
  directories.push(directory);
  const collectorAcceptedAt = new Date('2026-08-28T20:00:00.000Z');
  const relayAcceptedAt = new Date('2026-08-29T20:00:00.000Z');
  const collectorStore = new PublicRetroStore(path.join(directory, 'collector.sqlite'), {
    now: () => collectorAcceptedAt.getTime(),
  });
  const collector = await startPublicRetroCollector(
    {
      databasePath: path.join(directory, 'collector.sqlite'),
      collectorWorkerCredential: 'collector-secret',
    },
    collectorStore,
  );
  let createdIssues = 0;
  const github = createServer((request, response) => {
    if (request.method === 'GET' && request.url?.includes('/issues')) {
      response.setHeader('content-type', 'application/json');
      response.end('[]');
      return;
    }
    if (request.method === 'POST' && request.url?.endsWith('/issues')) {
      createdIssues += 1;
      response.statusCode = 201;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ number: 3514 }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>(resolve => github.listen(0, '127.0.0.1', resolve));
  const githubAddress = github.address();
  if (githubAddress === null || typeof githubAddress === 'string') {
    throw new Error('GitHub fixture did not bind');
  }
  const credentials = new CredentialRegistry('worker-relay-pepper');
  const relayCredential = credentials.issue({
    credentialId: 'collector-worker-integration',
    harness: 'collector-worker',
    installationId: 42,
    repository: 'arcadeai/safeword',
    roles: ['ingest'],
    secret: 'e'.repeat(64),
    subject: 'collector-worker-integration',
    tenantId: 'tenant-1',
  });
  const relayStore = RelayStore.open(path.join(directory, 'relay.sqlite'), {
    now: () => relayAcceptedAt,
  });
  const relay = await startRelayServer({
    allowUnlockedForTests: true,
    credentials,
    github: new GitHubRestClient({
      baseUrl: `http://127.0.0.1:${githubAddress.port}`,
      installationToken: () => Promise.resolve('github-installation-token'),
    }),
    now: () => relayAcceptedAt,
    payloadKey: Buffer.alloc(32, 7),
    store: relayStore,
  });
  const requestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const findings = [
    ...Array.from({ length: 15 }, (_, index) => `${index}:`.padEnd(3990, 'x')),
    'largest accepted relay boundary'.padEnd(45, 'y'),
  ];
  expect(Buffer.byteLength(findings.join('\n\n---\n\n'), 'utf8')).toBe(60_000);
  const bytes = Buffer.from(
    JSON.stringify({
      version: 'v3',
      findings,
      source: {
        harness: 'codex',
        hostClass: 'local',
        projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        safewordCliVersion: '0.82.1',
      },
      sessionScope: 'a'.repeat(64),
    }),
  );

  try {
    const accepted = await fetch(`${collector.url}/v1/public-retros`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-safeword-request-id': requestId,
      },
      body: bytes,
    });
    expect(accepted.status).toBe(201);

    await expect(
      transferOneRetro({
        collectorCredential: 'collector-secret',
        collectorUrl: collector.url,
        relayCredential,
        relayUrl: relay.url,
      }),
    ).resolves.toBe('transferred');

    const stored = relayStore.load({
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId,
      tenantId: 'tenant-1',
    });
    expect(createdIssues).toBe(1);
    expect(stored?.acceptedAt).toBe(relayAcceptedAt.toISOString());
    expect(stored?.retryDeadlineAt).toBe('2026-08-30T20:00:00.000Z');
  } finally {
    await collector.close();
    relay.server.closeAllConnections();
    await new Promise<void>(resolve =>
      relay.server.close(() => {
        resolve();
      }),
    );
    await new Promise<void>(resolve =>
      github.close(() => {
        resolve();
      }),
    );
    relayStore.close();
  }
});

it('hands exact claimed bytes to the relay and completes collector ownership', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-worker-'));
  directories.push(directory);
  const collector = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    collectorWorkerCredential: 'collector-secret',
  });
  const bytes = Buffer.from(
    JSON.stringify({
      version: 'v3',
      findings: ['worker fixture'],
      source: {
        harness: 'codex',
        hostClass: 'local',
        projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        safewordCliVersion: '0.82.1',
      },
      sessionScope: 'a'.repeat(64),
    }),
  );
  await fetch(`${collector.url}/v1/public-retros`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-safeword-request-id': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    },
    body: bytes,
  });
  let observedBody = Buffer.alloc(0);
  const relay = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', chunk => {
      chunks.push(Buffer.from(chunk));
    });
    request.on('end', () => {
      observedBody = Buffer.concat(chunks);
      response.statusCode = 202;
      response.end(JSON.stringify({ state: 'accepted' }));
    });
  });
  await new Promise<void>(resolve => relay.listen(0, '127.0.0.1', resolve));
  const address = relay.address();
  if (address === null || typeof address === 'string') throw new Error('relay did not bind');

  const result = await transferOneRetro({
    collectorCredential: 'collector-secret',
    collectorUrl: collector.url,
    relayCredential: 'relay-secret',
    relayUrl: `http://127.0.0.1:${address.port}`,
  });
  const empty = await fetch(`${collector.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: { authorization: 'Bearer collector-secret' },
  });
  await collector.close();
  await new Promise<void>(resolve =>
    relay.close(() => {
      resolve();
    }),
  );

  expect(result).toBe('transferred');
  expect(observedBody).toEqual(bytes);
  expect(empty.status).toBe(204);
});

it.each([401, 403, 404])('retains accepted work when the relay returns %i', async status => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-worker-'));
  directories.push(directory);
  const collector = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    collectorWorkerCredential: 'collector-secret',
    operatorCredential: 'operator-secret',
  });
  const body = JSON.stringify({
    version: 'v3',
    findings: ['retained fixture'],
    source: {
      harness: 'codex',
      hostClass: 'local',
      projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      safewordCliVersion: '0.82.1',
    },
    sessionScope: 'c'.repeat(64),
  });
  await fetch(`${collector.url}/v1/public-retros`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-safeword-request-id': 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa',
    },
    body,
  });
  const relay = createServer((_request, response) => {
    response.statusCode = status;
    response.end();
  });
  await new Promise<void>(resolve => relay.listen(0, '127.0.0.1', resolve));
  const address = relay.address();
  if (address === null || typeof address === 'string') throw new Error('relay did not bind');

  const result = await transferOneRetro({
    collectorCredential: 'collector-secret',
    collectorUrl: collector.url,
    relayCredential: 'relay-secret',
    relayUrl: `http://127.0.0.1:${address.port}`,
  });
  const lifecycle = await fetch(`${collector.url}/v1/private/retros`, {
    headers: { authorization: 'Bearer operator-secret' },
  });
  const records = (await lifecycle.json()) as { retros: { state: string }[] };
  await collector.close();
  await new Promise<void>(resolve =>
    relay.close(() => {
      resolve();
    }),
  );

  expect(result).toBe('retained');
  expect(records.retros).toEqual([expect.objectContaining({ state: 'queued' })]);
});

it('records a terminal relay dead letter as rejected instead of completed', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-worker-'));
  directories.push(directory);
  const collector = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    collectorWorkerCredential: 'collector-secret',
    operatorCredential: 'operator-secret',
  });
  await fetch(`${collector.url}/v1/public-retros`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-safeword-request-id': 'dddddddd-eeee-4fff-8aaa-bbbbbbbbbbbb',
    },
    body: JSON.stringify({
      version: 'v3',
      findings: ['terminal fixture'],
      source: {
        harness: 'codex',
        hostClass: 'local',
        projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        safewordCliVersion: '0.82.1',
      },
      sessionScope: 'd'.repeat(64),
    }),
  });
  const relay = createServer((_request, response) => {
    response.statusCode = 202;
    response.end(JSON.stringify({ state: 'dead-letter' }));
  });
  await new Promise<void>(resolve => relay.listen(0, '127.0.0.1', resolve));
  const address = relay.address();
  if (address === null || typeof address === 'string') throw new Error('relay did not bind');

  const result = await transferOneRetro({
    collectorCredential: 'collector-secret',
    collectorUrl: collector.url,
    relayCredential: 'relay-secret',
    relayUrl: `http://127.0.0.1:${address.port}`,
  });
  const lifecycle = await fetch(`${collector.url}/v1/private/retros`, {
    headers: { authorization: 'Bearer operator-secret' },
  });
  const records = (await lifecycle.json()) as { retros: { state: string }[] };
  await collector.close();
  await new Promise<void>(resolve => {
    relay.close(() => {
      resolve();
    });
  });

  expect(result).toBe('rejected');
  expect(records.retros).toEqual([expect.objectContaining({ state: 'dead-lettered' })]);
});

it('dead-letters a permanent relay rejection and transfers the next retro', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-worker-'));
  directories.push(directory);
  const collector = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    collectorWorkerCredential: 'collector-secret',
  });
  const envelope = (finding: string, sessionScope: string) =>
    JSON.stringify({
      version: 'v3',
      findings: [finding],
      source: {
        harness: 'codex',
        hostClass: 'local',
        projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        safewordCliVersion: '0.82.1',
      },
      sessionScope,
    });
  for (const [requestId, finding, sessionScope] of [
    ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'poisoned fixture', 'a'.repeat(64)],
    ['bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', 'healthy fixture', 'b'.repeat(64)],
  ]) {
    await fetch(`${collector.url}/v1/public-retros`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-safeword-request-id': requestId,
      },
      body: envelope(finding, sessionScope),
    });
  }
  let relayRequests = 0;
  const relay = createServer((_request, response) => {
    relayRequests += 1;
    response.statusCode = relayRequests === 1 ? 400 : 202;
    response.end(relayRequests === 1 ? undefined : JSON.stringify({ state: 'accepted' }));
  });
  await new Promise<void>(resolve => relay.listen(0, '127.0.0.1', resolve));
  const address = relay.address();
  if (address === null || typeof address === 'string') throw new Error('relay did not bind');
  const options = {
    collectorCredential: 'collector-secret',
    collectorUrl: collector.url,
    relayCredential: 'relay-secret',
    relayUrl: `http://127.0.0.1:${address.port}`,
  };

  const rejected = await transferOneRetro(options);
  const transferred = await transferOneRetro(options);
  const empty = await fetch(`${collector.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: { authorization: 'Bearer collector-secret' },
  });
  await collector.close();
  await new Promise<void>(resolve =>
    relay.close(() => {
      resolve();
    }),
  );

  expect(rejected).toBe('rejected');
  expect(transferred).toBe('transferred');
  expect(relayRequests).toBe(2);
  expect(empty.status).toBe(204);
});

it('keeps the worker alive across an unavailable collector', async () => {
  const controller = new AbortController();
  let waits = 0;

  await runRetroTransferWorker(
    {
      collectorCredential: 'collector-secret',
      collectorUrl: 'http://127.0.0.1:1',
      relayCredential: 'relay-secret',
      relayUrl: 'http://127.0.0.1:2',
    },
    controller.signal,
    {
      wait: () => {
        waits += 1;
        controller.abort();
        return Promise.resolve();
      },
    },
  );

  expect(waits).toBe(1);
});
