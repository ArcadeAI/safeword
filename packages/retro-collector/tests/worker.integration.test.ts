import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { startPublicRetroCollector } from '../src/index.js';
import { runRetroTransferWorker, transferOneRetro } from '../src/worker.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) rmSync(directory, { force: true, recursive: true });
  directories.length = 0;
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
      response.end();
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
