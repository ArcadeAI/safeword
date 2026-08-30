import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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

const RELEASED_V0796_ENVELOPE =
  '{"version":"v1","finding":"released fixture finding","source":{"harness":"claude-code","hostClass":"local","projectUUID":"018f0f2e-abcd-7def-8abc-def012345678","safewordCliVersion":"0.79.6","repository":"github.com/arcadeai/safeword","agentVersion":"1.2.3","model":"claude-fixture","safewordPluginVersion":"0.79.6","osFamily":"darwin","userIdentity":"legacy-user-fixture"},"sessionScope":"6666666666666666666666666666666666666666666666666666666666666666"}';

function fixtureRequest(): { body: Uint8Array; requestId: string } {
  return {
    body: new TextEncoder().encode(JSON.stringify(fixtureEnvelope())),
    requestId: '01911111-2222-7333-8444-55555555555a',
  };
}

function fixtureBatchRequestBody(): Record<string, unknown> {
  return {
    version: 'v2',
    findings: ['first sanitized finding', 'second sanitized finding'],
    source: fixtureEnvelope().source,
    sessionScope: '8'.repeat(64),
  };
}

function fixtureBatchRequest(): { body: Uint8Array; requestId: string } {
  return {
    body: new TextEncoder().encode(JSON.stringify(fixtureBatchRequestBody())),
    requestId: '01911111-2222-7333-8444-55555555555e',
  };
}

function fixtureServerOwnedRequest(): { body: Uint8Array; requestId: string } {
  return {
    body: encoded({
      version: 'v3',
      findings: ['server-owned sanitized finding'],
      source: {
        harness: 'cursor',
        hostClass: 'local',
        projectUUID: '018f0f2e-abcd-4def-8abc-def012345678',
        safewordCliVersion: '0.82.1',
      },
      sessionScope: '9'.repeat(64),
    }),
    requestId: '11111111-2222-4333-8444-555555555555',
  };
}

function sessionScope(harness: string, projectUUID: string, sessionId: string): string {
  return createHash('sha256')
    .update('safeword-retro-session-scope:v1\0')
    .update(harness)
    .update('\0')
    .update(projectUUID)
    .update('\0')
    .update(sessionId)
    .digest('hex');
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

it('exposes anonymous liveness without collection metadata', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });

  const response = await fetch(`${runtime.url}/health`);
  await runtime.close();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

it('persists the public intake quota across collector restarts', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, 'collector.sqlite');
  const firstRuntime = await startPublicRetroCollector({
    databasePath,
    intakeLimitPerMinute: 1,
  });
  const first = await submit(firstRuntime.url, fixtureServerOwnedRequest());
  await firstRuntime.close();

  const secondRuntime = await startPublicRetroCollector({
    databasePath,
    intakeLimitPerMinute: 1,
  });
  const secondRequest = fixtureServerOwnedRequest();
  secondRequest.requestId = '22222222-2222-4222-8222-222222222222';
  secondRequest.body = encoded({
    ...JSON.parse(new TextDecoder().decode(secondRequest.body)),
    sessionScope: 'a'.repeat(64),
  });
  const rejected = await submit(secondRuntime.url, secondRequest);
  const duplicate = await submit(secondRuntime.url, fixtureServerOwnedRequest());
  await secondRuntime.close();

  expect(first.status).toBe(201);
  expect(rejected.status).toBe(429);
  expect(await rejected.json()).toEqual({ error: 'intake_quota_exhausted' });
  expect(duplicate.status).toBe(200);
});

it('persists global and per-project filing reservations across restarts', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, 'collector.sqlite');
  const options = {
    collectorWorkerCredential: 'worker-secret',
    databasePath,
    filingLimitPerHour: 2,
    projectFilingLimitPerHour: 1,
  };
  const requestFor = (requestId: string, projectUUID: string, scope: string) => {
    const fixture = fixtureServerOwnedRequest();
    const envelope = JSON.parse(new TextDecoder().decode(fixture.body)) as Record<string, unknown>;
    envelope.source = { ...(envelope.source as object), projectUUID };
    envelope.sessionScope = scope.repeat(64);
    return { body: encoded(envelope), requestId };
  };
  const firstRuntime = await startPublicRetroCollector(options);
  await submit(
    firstRuntime.url,
    requestFor('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '1'),
  );
  await submit(
    firstRuntime.url,
    requestFor('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2'),
  );
  await submit(
    firstRuntime.url,
    requestFor('33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '3'),
  );
  const workerHeaders = { authorization: 'Bearer worker-secret' };
  const firstClaim = await fetch(`${firstRuntime.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: workerHeaders,
  });
  const firstLease = (await firstClaim.json()) as { leaseToken: string; requestId: string };
  await fetch(`${firstRuntime.url}/v1/private/retro-claims/${firstLease.requestId}`, {
    method: 'PUT',
    headers: { ...workerHeaders, 'x-safeword-lease-token': firstLease.leaseToken },
  });
  const secondClaim = await fetch(`${firstRuntime.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: workerHeaders,
  });
  const secondLease = (await secondClaim.json()) as { leaseToken: string; requestId: string };
  await fetch(`${firstRuntime.url}/v1/private/retro-claims/${secondLease.requestId}`, {
    method: 'PUT',
    headers: { ...workerHeaders, 'x-safeword-lease-token': secondLease.leaseToken },
  });
  await firstRuntime.close();

  const restarted = await startPublicRetroCollector(options);
  const exhausted = await fetch(`${restarted.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: workerHeaders,
  });
  await restarted.close();

  expect(firstLease.requestId).toBe('11111111-1111-4111-8111-111111111111');
  expect(secondLease.requestId).toBe('33333333-3333-4333-8333-333333333333');
  expect(exhausted.status).toBe(204);
});

it('keeps lifecycle inspection payload-free and audits separate payload principals', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, 'collector.sqlite');
  const runtime = await startPublicRetroCollector({
    breakGlassCredential: 'break-glass-secret',
    collectorWorkerCredential: 'worker-secret',
    databasePath,
    operatorCredential: 'operator-secret',
  });
  const request = fixtureServerOwnedRequest();
  await submit(runtime.url, request);

  const lifecycle = await fetch(`${runtime.url}/v1/private/retros`, {
    headers: { authorization: 'Bearer operator-secret' },
  });
  const lifecycleText = await lifecycle.text();
  const operatorPayload = await fetch(
    `${runtime.url}/v1/private/retros/${request.requestId}/payload`,
    { headers: { authorization: 'Bearer operator-secret' } },
  );
  const breakGlassPayload = await fetch(
    `${runtime.url}/v1/private/retros/${request.requestId}/payload`,
    { headers: { authorization: 'Bearer break-glass-secret' } },
  );
  const workerClaim = await fetch(`${runtime.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: { authorization: 'Bearer worker-secret' },
  });
  await runtime.close();
  const database = new DatabaseSync(databasePath);
  const audit = database
    .prepare('SELECT principal FROM payload_access_audit ORDER BY id')
    .all() as unknown as { principal: string }[];
  database.close();

  expect(lifecycle.status).toBe(200);
  expect(lifecycleText).not.toContain('server-owned sanitized finding');
  expect(operatorPayload.status).toBe(404);
  expect(new Uint8Array(await breakGlassPayload.arrayBuffer())).toEqual(request.body);
  expect(workerClaim.status).toBe(200);
  expect(audit).toEqual([{ principal: 'break-glass' }, { principal: 'collector-worker' }]);
});

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
  });
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

it('accepts the released v0.79.6 envelope and returns its bytes unchanged', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });
  const body = new TextEncoder().encode(RELEASED_V0796_ENVELOPE);
  const accepted = await submit(runtime.url, {
    body,
    requestId: '01911111-2222-7333-8444-55555555555b',
  });
  const { receipt } = (await accepted.json()) as { receipt: string };
  const inspected = await fetch(`${runtime.url}/v1/public-retros/${receipt}`, {
    headers: { authorization: 'Bearer operator-fixture-credential' },
  });
  const inspectedBody = new Uint8Array(await inspected.arrayBuffer());
  await runtime.close();

  expect(accepted.status).toBe(201);
  expect(inspected.status).toBe(200);
  expect(inspectedBody).toEqual(body);
});

it('accepts an exact v2 batch and returns its bytes unchanged', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });
  const request = fixtureBatchRequest();

  const accepted = await submit(runtime.url, request);
  const { receipt } = (await accepted.json()) as { receipt: string };
  const inspected = await fetch(`${runtime.url}/v1/public-retros/${receipt}`, {
    headers: { authorization: 'Bearer operator-fixture-credential' },
  });
  const inspectedBody = new Uint8Array(await inspected.arrayBuffer());
  await runtime.close();

  expect(accepted.status).toBe(201);
  expect(inspected.status).toBe(200);
  expect(inspectedBody).toEqual(request.body);
});

it('accepts released local classification with legacy user identity', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const body = new TextEncoder().encode(RELEASED_V0796_ENVELOPE);

  const response = await submit(runtime.url, {
    body,
    requestId: '01911111-2222-7333-8444-55555555555c',
  });
  await runtime.close();

  expect(response.status).toBe(201);
});

it('rejects legacy user identity on a Cursor envelope', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const request = {
    ...fixtureRequest(),
    body: new TextEncoder().encode(
      RELEASED_V0796_ENVELOPE.replace('"harness":"claude-code"', '"harness":"cursor"').replace(
        '"hostClass":"local"',
        '"hostClass":"unknown"',
      ),
    ),
  };

  const response = await submit(runtime.url, request);
  await runtime.close();

  expect(response.status).toBe(400);
});

it.each([
  ['missing', undefined],
  ['empty', ['']],
  ['duplicated', ['Bearer operator-fixture-credential', 'Bearer operator-fixture-credential']],
  ['malformed', ['operator-fixture-credential']],
  ['invalid', ['Bearer invalid-credential']],
  ['private filing', ['Bearer private-filing-credential']],
] as const)('reveals no record to a %s operator credential', async (_name, credentials) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });
  const accepted = await submit(runtime.url, fixtureRequest());
  const { receipt } = (await accepted.json()) as { receipt: string };
  const headers = new Headers();
  const suppliedCredentials = credentials ?? [];
  for (const credential of suppliedCredentials) headers.append('authorization', credential);

  const inspected = await fetch(`${runtime.url}/v1/public-retros/${receipt}`, { headers });
  await runtime.close();

  expect(inspected.status).toBe(404);
  expect(inspected.headers.get('x-safeword-receipt')).toBeNull();
  expect(await inspected.json()).toEqual({ error: 'not_found' });
});

it('treats a non-ASCII lookalike operator credential as not found', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });

  const response = await fetch(
    `${runtime.url}/v1/public-retros/01911111-2222-7333-8444-55555555555a`,
    { headers: { authorization: 'Bearer operator-fixture-credentiaé' } },
  );
  await runtime.close();

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'not_found' });
});

it('keeps operator reads disabled when the configured credential is blank', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: ' '.repeat(3),
  });
  const accepted = await submit(runtime.url, fixtureRequest());
  const { receipt } = (await accepted.json()) as { receipt: string };

  const inspected = await fetch(`${runtime.url}/v1/public-retros/${receipt}`, {
    headers: { authorization: 'Bearer ' },
  });
  await runtime.close();

  expect(inspected.status).toBe(404);
});

it('returns a bounded failure when an operator read cannot reach the store', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const failingStore = {
    accept: () => {
      throw new Error('unexpected accept');
    },
    close: () => {},
    read: () => {
      throw new Error('injected read failure');
    },
  };
  const runtime = await startPublicRetroCollector(
    {
      databasePath: path.join(directory, 'unused.sqlite'),
      operatorCredential: 'operator-fixture-credential',
    },
    failingStore,
  );

  const response = await fetch(
    `${runtime.url}/v1/public-retros/01911111-2222-7333-8444-55555555555a`,
    {
      headers: { authorization: 'Bearer operator-fixture-credential' },
      signal: AbortSignal.timeout(500),
    },
  );
  await runtime.close();

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'store_unavailable' });
});

it('does not expose record or collection metadata to anonymous callers', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });
  const first = fixtureRequest();
  const second = {
    body: encoded({ ...fixtureEnvelope(), sessionScope: '8'.repeat(64) }),
    requestId: '01911111-2222-7333-8444-55555555555b',
  };
  const accepted = await Promise.all([submit(runtime.url, first), submit(runtime.url, second)]);
  const receipts = await Promise.all(
    accepted.map(async response => ((await response.json()) as { receipt: string }).receipt),
  );

  const anonymousReads = await Promise.all([
    fetch(`${runtime.url}/v1/public-retros`),
    fetch(`${runtime.url}/v1/public-retros/${receipts[0]}`),
    fetch(`${runtime.url}/v1/public-retros/${receipts[1]}`),
    fetch(`${runtime.url}/v1/public-retros/01911111-2222-7333-8444-55555555555c`),
  ]);
  const bodies = await Promise.all(anonymousReads.map(async response => response.json()));
  await runtime.close();

  expect(anonymousReads.map(response => response.status)).toEqual([404, 404, 404, 404]);
  expect(anonymousReads.every(response => !response.headers.has('x-safeword-receipt'))).toBe(true);
  expect(bodies).toEqual(Array.from({ length: 4 }, () => ({ error: 'not_found' })));
});

it('does not acknowledge a submission when the quarantine store fails', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  let acceptCalls = 0;
  const failingStore = {
    accept: () => {
      acceptCalls += 1;
      throw new Error('injected store failure');
    },
    close: () => {},
    read: () => {
      throw new Error('unexpected read');
    },
  };
  const runtime = await startPublicRetroCollector(
    { databasePath: path.join(directory, 'unused.sqlite') },
    failingStore,
  );

  const response = await submit(runtime.url, fixtureRequest());
  await runtime.close();

  expect(response.status).toBe(500);
  expect(response.headers.get('x-safeword-receipt')).toBeNull();
  expect(await response.json()).toEqual({ error: 'store_unavailable' });
  expect(acceptCalls).toBe(1);
});

it.each(['PUT', 'DELETE'])('does not let the public route mutate records with %s', async method => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });
  const request = fixtureRequest();
  const accepted = await submit(runtime.url, request);
  const { receipt } = (await accepted.json()) as { receipt: string };

  const mutation = await fetch(`${runtime.url}/v1/public-retros/${receipt}`, {
    body: method === 'PUT' ? encoded({ ...fixtureEnvelope(), finding: 'overwritten' }) : undefined,
    headers: method === 'PUT' ? { 'content-type': 'application/json; charset=utf-8' } : undefined,
    method,
  });
  const inspected = await fetch(`${runtime.url}/v1/public-retros/${receipt}`, {
    headers: { authorization: 'Bearer operator-fixture-credential' },
  });
  const inspectedBody = new Uint8Array(await inspected.arrayBuffer());
  await runtime.close();

  expect(mutation.status).toBe(404);
  expect(inspected.status).toBe(200);
  expect(inspectedBody).toEqual(request.body);
});

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function withSource(change: Record<string, unknown>): Record<string, unknown> {
  const envelope = fixtureEnvelope();
  return { ...envelope, source: { ...(envelope.source as object), ...change } };
}

it.each([
  ['claude-code', 'local'],
  ['codex', 'local'],
  ['claude-code', 'unknown'],
  ['codex', 'unknown'],
  ['cursor', 'unknown'],
] as const)('accepts the %s/%s source compatibility row', async (harness, hostClass) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const request = {
    ...fixtureRequest(),
    body: encoded(withSource({ harness, hostClass })),
  };

  const response = await submit(runtime.url, request);
  await runtime.close();

  expect(response.status).toBe(201);
});

it('preserves a released 257-byte optional source value unchanged', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });
  const model = `a${'é'.repeat(128)}`;
  const request = { ...fixtureRequest(), body: encoded(withSource({ model })) };

  const accepted = await submit(runtime.url, request);
  const { receipt } = (await accepted.json()) as { receipt: string };
  const inspected = await fetch(`${runtime.url}/v1/public-retros/${receipt}`, {
    headers: { authorization: 'Bearer operator-fixture-credential' },
  });
  const envelope = (await inspected.json()) as { source: { model?: string } };
  await runtime.close();

  expect(accepted.status).toBe(201);
  expect(inspected.status).toBe(200);
  expect(Buffer.byteLength(model)).toBe(257);
  expect(envelope.source.model).toBe(model);
});

function nonUtf8Envelope(): Uint8Array {
  const bytes = Buffer.from(JSON.stringify({ ...fixtureEnvelope(), finding: 'fixture § finding' }));
  const marker = bytes.indexOf(Buffer.from('§'));
  return Buffer.concat([
    bytes.subarray(0, marker),
    Buffer.from([0xff]),
    bytes.subarray(marker + 2),
  ]);
}

function sizedEnvelope(
  byteLength: number,
  multibyte: boolean,
  version: 'v1' | 'v2' = 'v1',
): Uint8Array {
  const base =
    version === 'v1'
      ? { ...fixtureEnvelope(), finding: '' }
      : { ...fixtureBatchRequestBody(), findings: [''] };
  const emptyLength = encoded(base).byteLength;
  const contentBytes = byteLength - emptyLength;
  let finding = 'a'.repeat(contentBytes);
  if (multibyte) {
    const trailingAscii = contentBytes % 2 === 0 ? '' : 'a';
    finding = `${'é'.repeat(Math.floor(contentBytes / 2))}${trailingAscii}`;
  }
  return encoded(version === 'v1' ? { ...base, finding } : { ...base, findings: [finding] });
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

it('leases exact server-owned bytes after collector restart', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, 'collector.sqlite');
  const request = fixtureServerOwnedRequest();

  const firstRuntime = await startPublicRetroCollector({
    databasePath,
    collectorWorkerCredential: 'worker-fixture-credential',
  });
  const accepted = await submit(firstRuntime.url, request);
  await firstRuntime.close();

  const restartedRuntime = await startPublicRetroCollector({
    databasePath,
    collectorWorkerCredential: 'worker-fixture-credential',
  });
  const claimed = await fetch(`${restartedRuntime.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: { authorization: 'Bearer worker-fixture-credential' },
  });
  const claim = (await claimed.json()) as {
    acceptedAt: string;
    bodyBase64: string;
    digest: string;
    leaseToken: string;
    requestId: string;
  };
  await restartedRuntime.close();

  expect(accepted.status).toBe(201);
  expect(claimed.status).toBe(200);
  expect(claim.requestId).toBe(request.requestId);
  expect(new Uint8Array(Buffer.from(claim.bodyBase64, 'base64'))).toEqual(request.body);
  expect(claim.digest).toBe(createHash('sha256').update(request.body).digest('hex'));
  expect(claim.acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  expect(claim.leaseToken).toMatch(/^[0-9a-f-]{36}$/u);
});

it('uses only the v3 request UUID for duplicate decisions', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const first = fixtureServerOwnedRequest();
  const second = {
    requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    body: encoded({
      ...(JSON.parse(new TextDecoder().decode(first.body)) as Record<string, unknown>),
      findings: ['a later transcript offset'],
    }),
  };

  const firstResponse = await submit(runtime.url, first);
  const secondResponse = await submit(runtime.url, second);
  await runtime.close();

  expect(firstResponse.status).toBe(201);
  expect(secondResponse.status).toBe(201);
});

it.each([
  ['more than 50 findings', Array.from({ length: 51 }, (_, index) => `finding ${index}`)],
  ['a finding above 4 KiB serialized', ['x'.repeat(4096)]],
  ['relay signature authority syntax', ['<!-- safeword-retro-signature: retro:abc -->']],
  ['relay canonical authority syntax', ['<!-- safeword-retro-canonical: canonical:abc -->']],
  ['relay request authority syntax', ['<!-- safeword-retro-request-v1: abc -->']],
] as const)('rejects v3 with %s before durable storage', async (_, findings) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    collectorWorkerCredential: 'worker-fixture-credential',
  });
  const fixture = fixtureServerOwnedRequest();
  const request = {
    ...fixture,
    body: encoded({
      ...(JSON.parse(new TextDecoder().decode(fixture.body)) as Record<string, unknown>),
      findings,
    }),
  };

  const rejected = await submit(runtime.url, request);
  const claim = await fetch(`${runtime.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: { authorization: 'Bearer worker-fixture-credential' },
  });
  await runtime.close();

  expect(rejected.status).toBe(400);
  expect(claim.status).toBe(204);
});

it('releases and completes a lease without losing or resurrecting the request', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
    collectorWorkerCredential: 'worker-fixture-credential',
  });
  const request = fixtureServerOwnedRequest();
  await submit(runtime.url, request);
  const workerHeaders = { authorization: 'Bearer worker-fixture-credential' };
  const firstResponse = await fetch(`${runtime.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: workerHeaders,
  });
  const first = (await firstResponse.json()) as { leaseToken: string; requestId: string };

  const released = await fetch(`${runtime.url}/v1/private/retro-claims/${first.requestId}`, {
    method: 'DELETE',
    headers: { ...workerHeaders, 'x-safeword-lease-token': first.leaseToken },
  });
  const secondResponse = await fetch(`${runtime.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: workerHeaders,
  });
  const second = (await secondResponse.json()) as { leaseToken: string; requestId: string };
  const completed = await fetch(`${runtime.url}/v1/private/retro-claims/${second.requestId}`, {
    method: 'PUT',
    headers: { ...workerHeaders, 'x-safeword-lease-token': second.leaseToken },
  });
  const empty = await fetch(`${runtime.url}/v1/private/retro-claims`, {
    method: 'POST',
    headers: workerHeaders,
  });
  await runtime.close();

  expect(released.status).toBe(204);
  expect(second.requestId).toBe(first.requestId);
  expect(second.leaseToken).not.toBe(first.leaseToken);
  expect(completed.status).toBe(204);
  expect(empty.status).toBe(204);
});

it('returns the original durable receipt for an exact v2 retry after restart', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, 'collector.sqlite');
  const request = fixtureBatchRequest();

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

it('deduplicates two concurrent request identities with identical bytes and scope', async () => {
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
  ).toEqual([200, 201]);
  expect(retries.map(response => response.status)).toEqual([200, 200]);
});

it('reuses one receipt for byte-identical v2 retries with a new request identity', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const first = fixtureBatchRequest();
  const second = { ...first, requestId: '01911111-2222-7333-8444-55555555555f' };

  const accepted = await submit(runtime.url, first);
  const firstResult = (await accepted.json()) as { receipt: string; requestId: string };
  const duplicate = await submit(runtime.url, second);
  const secondResult = (await duplicate.json()) as { receipt: string; requestId: string };
  await runtime.close();

  expect(accepted.status).toBe(201);
  expect(duplicate.status).toBe(200);
  expect(secondResult).toEqual({ receipt: firstResult.receipt, requestId: second.requestId });
});

it.each(['harness', 'project identity', 'session identity'] as const)(
  'keeps submissions with distinct %s independent',
  async input => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
    temporaryDirectories.push(directory);
    const runtime = await startPublicRetroCollector({
      databasePath: path.join(directory, 'collector.sqlite'),
    });
    const first = fixtureRequest();
    const firstEnvelope = fixtureEnvelope();
    const source = firstEnvelope.source as Record<string, unknown>;
    const harness = input === 'harness' ? 'codex' : String(source.harness);
    const projectUUID =
      input === 'project identity'
        ? '018f0f2e-abcd-7def-8abc-def012345679'
        : String(source.projectUUID);
    const sessionId = input === 'session identity' ? 'session-fixture-2' : 'session-fixture-1';
    const secondEnvelope = {
      ...firstEnvelope,
      sessionScope: sessionScope(harness, projectUUID, sessionId),
      source: {
        ...source,
        harness,
        projectUUID,
      },
    };
    const second = {
      body: encoded(secondEnvelope),
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
  },
);

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

it('does not let a v2 batch replace a v1 body in the same session scope', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const first = fixtureRequest();
  const second = {
    body: encoded({
      version: 'v2',
      findings: ['fixture finding'],
      source: fixtureEnvelope().source,
      sessionScope: fixtureEnvelope().sessionScope,
    }),
    requestId: '01911111-2222-7333-8444-55555555555b',
  };

  const accepted = await submit(runtime.url, first);
  const rejected = await submit(runtime.url, second);
  await runtime.close();

  expect(accepted.status).toBe(201);
  expect(rejected.status).toBe(409);
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

async function expectSizedEnvelopeStatus(
  content: 'ascii' | 'multibyte',
  byteLength: number,
  expectedStatus: 201 | 413,
  version: 'v1' | 'v2',
): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const request = {
    ...fixtureRequest(),
    body: sizedEnvelope(byteLength, content === 'multibyte', version),
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
}

it.each([
  ['v1', 'ascii', 262_144],
  ['v1', 'multibyte', 262_144],
  ['v2', 'ascii', 262_144],
  ['v2', 'multibyte', 262_144],
] as const)('accepts a %s %s envelope at the 262144-byte limit', (version, content, byteLength) =>
  expectSizedEnvelopeStatus(content, byteLength, 201, version),
);

it.each([
  ['v1', 'ascii', 262_145],
  ['v1', 'multibyte', 262_145],
  ['v2', 'ascii', 262_145],
  ['v2', 'multibyte', 262_145],
] as const)(
  'rejects a %s %s envelope above the 262144-byte limit',
  (version, content, byteLength) => expectSizedEnvelopeStatus(content, byteLength, 413, version),
);

type InvalidEnvelope = readonly [string, Uint8Array, (string | false)?];

const invalidEnvelopes: readonly InvalidEnvelope[] = [
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

async function expectEnvelopeRejected(
  body: Uint8Array,
  contentType?: string | false,
): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-collector-'));
  temporaryDirectories.push(directory);
  const runtime = await startPublicRetroCollector({
    databasePath: path.join(directory, 'collector.sqlite'),
  });
  const validRequest = fixtureRequest();
  const invalidRequest = { ...validRequest, body };

  const invalidResponse = await submit(runtime.url, invalidRequest, contentType);
  const validResponse = await submit(runtime.url, validRequest);
  await runtime.close();

  expect(invalidResponse.status).toBeGreaterThanOrEqual(400);
  expect(validResponse.status).toBe(201);
}

it.each([
  ['missing version', encoded({ ...fixtureEnvelope(), version: undefined })],
  ['unknown version', encoded({ ...fixtureEnvelope(), version: 'v3' })],
] as const)('rejects the %s without consuming its request identity', (_, body) =>
  expectEnvelopeRejected(body),
);

it.each([
  ['unknown top-level field', encoded({ ...fixtureEnvelope(), extra: true })],
  ['unknown source field', encoded(withSource({ extra: true }))],
] as const)('rejects the %s without persistence', (_, body) => expectEnvelopeRejected(body));

it.each([
  ['missing required field', encoded({ sessionScope: '7'.repeat(64) })],
  ['missing source harness', encoded(withSource({ harness: undefined }))],
  ['missing source host class', encoded(withSource({ hostClass: undefined }))],
  ['missing source project UUID', encoded(withSource({ projectUUID: undefined }))],
  ['missing SafeWord CLI version', encoded(withSource({ safewordCliVersion: undefined }))],
] as const)('rejects a %s without persistence', (_, body) => expectEnvelopeRejected(body));

it.each([
  ['non-UUID source project UUID', encoded(withSource({ projectUUID: 'not-a-uuid' }))],
  [
    'uppercase source project UUID',
    encoded(withSource({ projectUUID: '018F0F2E-ABCD-7DEF-8ABC-DEF012345678' })),
  ],
  ['invalid source host class', encoded(withSource({ hostClass: 7 }))],
  ['array source host class', encoded(withSource({ hostClass: [] }))],
  // eslint-disable-next-line unicorn/no-null -- JSON null is the malformed wire value under test.
  ['invalid source harness', encoded(withSource({ harness: null }))],
  ['invalid source model', encoded(withSource({ model: 7 }))],
  ['object SafeWord CLI version', encoded(withSource({ safewordCliVersion: {} }))],
  ['wrong-typed required field', encoded({ ...fixtureEnvelope(), finding: 7 })],
] as const)('rejects malformed %s', (_, body) => expectEnvelopeRejected(body));

it.each([
  ['empty findings array', encoded({ ...fixtureBatchRequestBody(), findings: [] })],
  ['empty finding', encoded({ ...fixtureBatchRequestBody(), findings: [''] })],
  ['non-string finding', encoded({ ...fixtureBatchRequestBody(), findings: [7] })],
  ['missing findings', encoded({ ...fixtureBatchRequestBody(), findings: undefined })],
  ['mixed v1 and v2 fields', encoded({ ...fixtureBatchRequestBody(), finding: 'fixture finding' })],
  ['unknown v2 field', encoded({ ...fixtureBatchRequestBody(), extra: true })],
  [
    'legacy user identity',
    encoded({
      ...fixtureBatchRequestBody(),
      source: {
        ...(fixtureBatchRequestBody().source as Record<string, unknown>),
        userIdentity: 'legacy-user-fixture',
      },
    }),
  ],
] as const)('rejects invalid v2 envelope: %s', (_, body) => expectEnvelopeRejected(body));

it.each([
  ['unknown source harness', encoded(withSource({ harness: 'other' }))],
  ['cloud source host class', encoded(withSource({ hostClass: 'cloud' }))],
  ['hostname source host class', encoded(withSource({ hostClass: 'hostname' }))],
] as const)('rejects unsupported %s', (_, body) => expectEnvelopeRejected(body));

it.each([
  ['incompatible cursor/local source', encoded(withSource({ harness: 'cursor' }))],
] as const)('rejects the %s compatibility row', (_, body) => expectEnvelopeRejected(body));

it.each(invalidEnvelopes)('rejects malformed envelope form: %s', (_, body, type) =>
  expectEnvelopeRejected(body as Uint8Array, type as string | false | undefined),
);
