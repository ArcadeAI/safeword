import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { startPublicRetroCollector } from '../src/index.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
  temporaryDirectories.length = 0;
});

function fixtureRequest(): { body: Uint8Array; requestId: string } {
  const envelope = {
    version: 'v1',
    finding: 'fixture finding',
    source: {
      harness: 'claude-code',
      hostClass: 'local',
      projectUUID: '018f0f2e-abcd-7def-8abc-def012345678',
      safewordCliVersion: '0.79.0',
    },
    sessionScope: '7'.repeat(64),
  };
  return {
    body: new TextEncoder().encode(JSON.stringify(envelope)),
    requestId: '01911111-2222-7333-8444-55555555555a',
  };
}

async function submit(url: string, request: ReturnType<typeof fixtureRequest>): Promise<Response> {
  return fetch(`${url}/v1/public-retros`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-safeword-request-id': request.requestId,
    },
    body: request.body,
  });
}

it('returns the original durable receipt for an exact retry after restart', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, 'collector.sqlite');
  const request = fixtureRequest();

  const firstRuntime = await startPublicRetroCollector({ databasePath });
  const firstResponse = await submit(firstRuntime.url, request);
  const firstReceipt = (await firstResponse.json()) as { receipt: string; requestId: string };
  await firstRuntime.close();

  const restartedRuntime = await startPublicRetroCollector({ databasePath });
  const retryResponse = await submit(restartedRuntime.url, request);
  const retryReceipt = (await retryResponse.json()) as { receipt: string; requestId: string };
  await restartedRuntime.close();

  expect(firstResponse.status).toBe(201);
  expect(retryResponse.status).toBe(200);
  expect(retryReceipt).toEqual(firstReceipt);
  expect(retryReceipt).toEqual({
    receipt: expect.any(String),
    requestId: request.requestId,
  });
});

it('rejects an invalid envelope without consuming its request identity', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const validRequest = fixtureRequest();
  const invalidRequest = {
    ...validRequest,
    body: new TextEncoder().encode(JSON.stringify({ sessionScope: '7'.repeat(64) })),
  };

  const invalidResponse = await submit(runtime.url, invalidRequest);
  const validResponse = await submit(runtime.url, validRequest);
  await runtime.close();

  expect(invalidResponse.status).toBe(400);
  expect(validResponse.status).toBe(201);
});
