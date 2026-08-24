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

function fixtureEnvelope(): Record<string, unknown> {
  return {
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
}

function fixtureRequest(): { body: Uint8Array; requestId: string } {
  return {
    body: new TextEncoder().encode(JSON.stringify(fixtureEnvelope())),
    requestId: '01911111-2222-7333-8444-55555555555a',
  };
}

async function submit(
  url: string,
  request: ReturnType<typeof fixtureRequest>,
  contentType: string | false = 'application/json; charset=utf-8',
  requestIdentity: string | false | readonly string[] = request.requestId,
  extraHeaders?: Readonly<Record<string, string>>,
): Promise<Response> {
  const headers = new Headers(extraHeaders);
  if (typeof requestIdentity === 'string') {
    headers.set('x-safeword-request-id', requestIdentity);
  } else if (requestIdentity !== false) {
    for (const value of requestIdentity) headers.append('x-safeword-request-id', value);
  }
  if (contentType !== false) headers.set('content-type', contentType);
  return fetch(`${url}/v1/public-retros`, {
    method: 'POST',
    headers,
    body: request.body,
  });
}

it.each([
  ['authorization', 'Bearer fixture'],
  ['cookie', 'session=fixture'],
  ['x-api-key', 'fixture'],
])('rejects credential-bearing public submissions via %s', async (header, value) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const request = fixtureRequest();

  const rejected = await submit(runtime.url, request, undefined, undefined, { [header]: value });
  const accepted = await submit(runtime.url, request);
  await runtime.close();

  expect(rejected.status).toBe(404);
  expect(accepted.status).toBe(201);
});

it('returns byte-identical quarantine bytes to an authorized operator', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  } as Parameters<typeof startPublicRetroCollector>[0]);
  const request = fixtureRequest();
  const accepted = await submit(runtime.url, request);
  const { receipt } = (await accepted.json()) as { receipt: string };

  const inspected = await fetch(`${runtime.url}/v1/public-retros/${receipt}`, {
    headers: { authorization: 'Bearer operator-fixture-credential' },
  });
  const inspectedBody = new Uint8Array(await inspected.arrayBuffer());
  await runtime.close();

  expect(inspected.status).toBe(200);
  expect(inspected.headers.get('x-safeword-receipt')).toBe(receipt);
  expect(inspectedBody).toEqual(request.body);
});

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function withSource(change: Record<string, unknown>): Record<string, unknown> {
  const envelope = fixtureEnvelope();
  return { ...envelope, source: { ...(envelope.source as object), ...change } };
}

function nonUtf8Envelope(): Uint8Array {
  const bytes = Buffer.from(JSON.stringify({ ...fixtureEnvelope(), finding: 'fixture § finding' }));
  const marker = bytes.indexOf(Buffer.from('§'));
  return Buffer.concat([
    bytes.subarray(0, marker),
    Buffer.from([0xff]),
    bytes.subarray(marker + 2),
  ]);
}

function sizedEnvelope(byteLength: number, multibyte: boolean): Uint8Array {
  const emptyLength = encoded({ ...fixtureEnvelope(), finding: '' }).byteLength;
  const contentBytes = byteLength - emptyLength;
  let finding = 'a'.repeat(contentBytes);
  if (multibyte) {
    const trailingAscii = contentBytes % 2 === 0 ? '' : 'a';
    finding = `${'é'.repeat(Math.floor(contentBytes / 2))}${trailingAscii}`;
  }
  return encoded({ ...fixtureEnvelope(), finding });
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

it('converges concurrent first submissions on one receipt', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const request = fixtureRequest();

  const responses = await Promise.all([submit(runtime.url, request), submit(runtime.url, request)]);
  const receipts = await Promise.all(
    responses.map(
      async response => (await response.json()) as { receipt: string; requestId: string },
    ),
  );
  await runtime.close();

  expect(
    responses.map(response => response.status).toSorted((left, right) => left - right),
  ).toEqual([200, 201]);
  expect(receipts[1]).toEqual(receipts[0]);
  expect(receipts[0]).toEqual({ receipt: expect.any(String), requestId: request.requestId });
});

it('accepts only one of two concurrent byte-different bodies with one request identity', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const first = fixtureRequest();
  const second = {
    ...first,
    body: encoded({ ...fixtureEnvelope(), finding: 'different fixture finding' }),
  };

  const responses = await Promise.all([submit(runtime.url, first), submit(runtime.url, second)]);
  const retries = await Promise.all([submit(runtime.url, first), submit(runtime.url, second)]);
  await runtime.close();

  expect(
    responses.map(response => response.status).toSorted((left, right) => left - right),
  ).toEqual([201, 409]);
  expect(retries.map(response => response.status)).toEqual(
    responses.map(response => (response.status === 201 ? 200 : 409)),
  );
});

it('accepts only one of two concurrent request identities with one session scope', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const first = fixtureRequest();
  const second = { ...first, requestId: '01911111-2222-7333-8444-55555555555b' };

  const responses = await Promise.all([submit(runtime.url, first), submit(runtime.url, second)]);
  const retries = await Promise.all([submit(runtime.url, first), submit(runtime.url, second)]);
  await runtime.close();

  expect(
    responses.map(response => response.status).toSorted((left, right) => left - right),
  ).toEqual([201, 409]);
  expect(retries.map(response => response.status)).toEqual(
    responses.map(response => (response.status === 201 ? 200 : 409)),
  );
});

it('keeps distinct submissions independent', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const first = fixtureRequest();
  const second = {
    body: encoded({ ...fixtureEnvelope(), sessionScope: '8'.repeat(64) }),
    requestId: '01911111-2222-7333-8444-55555555555b',
  };

  const responses = await Promise.all([submit(runtime.url, first), submit(runtime.url, second)]);
  const receipts = await Promise.all(
    responses.map(
      async response => (await response.json()) as { receipt: string; requestId: string },
    ),
  );
  await runtime.close();

  expect(responses.map(response => response.status)).toEqual([201, 201]);
  expect(receipts.map(receipt => receipt.requestId)).toEqual([first.requestId, second.requestId]);
  expect(receipts[0]?.receipt).not.toBe(receipts[1]?.receipt);
});

it('does not let semantic JSON equivalence override accepted raw bytes', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const canonical = fixtureRequest();
  const equivalent = {
    ...canonical,
    body: new TextEncoder().encode(JSON.stringify(fixtureEnvelope(), undefined, 2)),
  };

  const accepted = await submit(runtime.url, canonical);
  const firstReceipt = await accepted.json();
  const rejected = await submit(runtime.url, equivalent);
  const retry = await submit(runtime.url, canonical);
  const retryReceipt = await retry.json();
  await runtime.close();

  expect(accepted.status).toBe(201);
  expect(rejected.status).toBeGreaterThanOrEqual(400);
  expect(retry.status).toBe(200);
  expect(retryReceipt).toEqual(firstReceipt);
});

it('rejects byte-different reuse of an accepted session scope', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const acceptedRequest = fixtureRequest();
  const conflictingRequest = {
    body: encoded({ ...fixtureEnvelope(), finding: 'different fixture finding' }),
    requestId: '01911111-2222-7333-8444-55555555555b',
  };

  const accepted = await submit(runtime.url, acceptedRequest);
  const firstReceipt = await accepted.json();
  const rejected = await submit(runtime.url, conflictingRequest);
  const retry = await submit(runtime.url, acceptedRequest);
  const retryReceipt = await retry.json();
  await runtime.close();

  expect(accepted.status).toBe(201);
  expect(rejected.status).toBe(409);
  expect(retry.status).toBe(200);
  expect(retryReceipt).toEqual(firstReceipt);
});

it.each([
  ['missing', false],
  ['empty', ''],
  ['duplicate', [fixtureRequest().requestId, fixtureRequest().requestId]],
  ['non-UUID', 'not-a-uuid'],
  ['uppercase', fixtureRequest().requestId.toUpperCase()],
  ['brace-wrapped', `{${fixtureRequest().requestId}}`],
] as const)('rejects a %s request identity without persistence', async (_, requestIdentity) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const request = fixtureRequest();

  const invalidResponse = await submit(
    runtime.url,
    request,
    'application/json; charset=utf-8',
    requestIdentity,
  );
  const validResponse = await submit(runtime.url, request);
  await runtime.close();

  expect(invalidResponse.status).toBeGreaterThanOrEqual(400);
  expect(validResponse.status).toBe(201);
});

it.each([
  ['ascii', 65_536, 201],
  ['ascii', 65_537, 413],
  ['multibyte', 65_536, 201],
  ['multibyte', 65_537, 413],
] as const)('handles a %s envelope of %i bytes', async (content, byteLength, expectedStatus) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const request = {
    ...fixtureRequest(),
    body: sizedEnvelope(byteLength, content === 'multibyte'),
  };

  const response = await submit(runtime.url, request);
  const result = (await response.json()) as { receipt?: string; requestId?: string };
  const validAfterRejection =
    expectedStatus === 413 ? await submit(runtime.url, fixtureRequest()) : undefined;
  await runtime.close();

  expect(request.body.byteLength).toBe(byteLength);
  expect(response.status).toBe(expectedStatus);
  if (expectedStatus === 201) {
    expect(result).toEqual({ receipt: expect.any(String), requestId: request.requestId });
  } else {
    expect(result.receipt).toBeUndefined();
    expect(validAfterRejection?.status).toBe(201);
  }
});

const invalidEnvelopes: readonly (readonly [string, Uint8Array, (string | false)?])[] = [
  ['unknown version', encoded({ ...fixtureEnvelope(), version: 'v2' })],
  ['missing required field', encoded({ sessionScope: '7'.repeat(64) })],
  ['unknown top-level field', encoded({ ...fixtureEnvelope(), extra: true })],
  ['unknown source field', encoded(withSource({ extra: true }))],
  ['missing source project UUID', encoded(withSource({ projectUUID: undefined }))],
  ['non-UUID source project UUID', encoded(withSource({ projectUUID: 'not-a-uuid' }))],
  [
    'uppercase source project UUID',
    encoded(withSource({ projectUUID: '018F0F2E-ABCD-7DEF-8ABC-DEF012345678' })),
  ],
  ['invalid source host class', encoded(withSource({ hostClass: 7 }))],
  ['cloud source host class', encoded(withSource({ hostClass: 'cloud' }))],
  ['unsupported harness', encoded(withSource({ harness: 'cursor' }))],
  ['wrong-typed required field', encoded({ ...fixtureEnvelope(), finding: 7 })],
  ['empty required field', encoded({ ...fixtureEnvelope(), finding: '' })],
  ['whitespace-only required field', encoded({ ...fixtureEnvelope(), finding: '  ' })],
  ['empty optional source field', encoded(withSource({ model: '' }))],
  ['whitespace-only optional source field', encoded(withSource({ model: '  ' }))],
  ['12-character session scope', encoded({ ...fixtureEnvelope(), sessionScope: '7'.repeat(12) })],
  ['63-character session scope', encoded({ ...fixtureEnvelope(), sessionScope: '7'.repeat(63) })],
  ['65-character session scope', encoded({ ...fixtureEnvelope(), sessionScope: '7'.repeat(65) })],
  ['uppercase session scope', encoded({ ...fixtureEnvelope(), sessionScope: 'A'.repeat(64) })],
  [
    'non-hexadecimal session scope',
    encoded({ ...fixtureEnvelope(), sessionScope: 'z'.repeat(64) }),
  ],
  ['non-JSON body', new TextEncoder().encode('not json')],
  ['JSON array body', encoded([])],
  ['JSON null body', new TextEncoder().encode('null')],
  ['empty body', new Uint8Array()],
  [
    'duplicate JSON keys',
    new TextEncoder().encode(
      JSON.stringify(fixtureEnvelope()).replace('"version":"v1"', '"version":"v1","version":"v1"'),
    ),
  ],
  ['non-UTF-8 body', nonUtf8Envelope()],
  ['missing content type', encoded(fixtureEnvelope()), false],
  ['non-JSON content type', encoded(fixtureEnvelope()), 'text/plain'],
];

it.each(invalidEnvelopes)(
  'rejects %s without consuming its request identity',
  async (_, body, contentType) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
    temporaryDirectories.push(directory);
    const runtime = await startPublicRetroCollector({
      databasePath: path.join(directory, 'collector.sqlite'),
    });
    const validRequest = fixtureRequest();
    const invalidRequest = { ...validRequest, body: body as Uint8Array };

    const invalidResponse = await submit(
      runtime.url,
      invalidRequest,
      contentType as string | false | undefined,
    );
    const validResponse = await submit(runtime.url, validRequest);
    await runtime.close();

    expect(invalidResponse.status).toBeGreaterThanOrEqual(400);
    expect(validResponse.status).toBe(201);
  },
);
