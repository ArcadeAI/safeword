import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { afterEach, describe, expect, it } from 'vitest';

import { GitHubCreateError } from '../src/github.js';
import type { RelayServerFaults } from '../src/http-server.js';
import {
  CredentialRegistry,
  type FileRetroDraftRequest,
  GitHubAppTokenProvider,
  GitHubRestClient,
  RelayStore,
  startRelayServer,
} from '../src/index.js';
import { createHarnessAdapters } from './support/harness-client.js';

const { privateKey: githubAppPrivateKey, publicKey: githubAppPublicKey } = generateKeyPairSync(
  'rsa',
  {
    modulusLength: 2048,
  },
);
const githubAppPrivateKeyPem = githubAppPrivateKey.export({
  format: 'pem',
  type: 'pkcs8',
});

const directories: string[] = [];
const servers: Server[] = [];
const stores: RelayStore[] = [];

function databaseFiles(directory: string): Buffer[] {
  return readdirSync(directory)
    .filter(name => name === 'relay.sqlite' || name.startsWith('relay.sqlite-'))
    .map(name => readFileSync(path.join(directory, name)));
}

function expectValidGitHubAppJwt(authorization: string | undefined): void {
  expect(authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/u);
  const token = authorization?.slice('Bearer '.length) ?? '';
  const [encodedHeader = '', encodedPayload = '', encodedSignature = ''] = token.split('.', 3);
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
    exp: number;
    iat: number;
    iss: string;
  };
  expect(payload.iss).toBe('1234');
  expect(payload.exp - payload.iat).toBeGreaterThan(0);
  expect(payload.exp - payload.iat).toBeLessThanOrEqual(10 * 60);
  expect(
    verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      githubAppPublicKey,
      Buffer.from(encodedSignature, 'base64url'),
    ),
  ).toBe(true);
}

afterEach(async () => {
  const openServers = [...servers];
  servers.length = 0;
  await Promise.all(
    openServers.map(
      server =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          if (!server.listening) {
            resolve();
            return;
          }
          server.close(error => {
            if (error === undefined) resolve();
            else reject(error);
          });
        }),
    ),
  );
  const openStores = [...stores];
  stores.length = 0;
  for (const store of openStores) {
    try {
      store.close();
    } catch {
      // A test may have closed its store explicitly before simulating restart.
    }
  }
  for (const directory of directories) {
    rmSync(directory, { force: true, recursive: true });
  }
  directories.length = 0;
});

function draft(overrides: Partial<FileRetroDraftRequest> = {}): FileRetroDraftRequest {
  const request = {
    requestId: 'request-1479',
    retryDeadlineAt: '2099-01-01T00:00:00.000Z',
    installationId: 42,
    repository: 'arcadeai/safeword',
    canonicalKey: 'canonical:abc123',
    legacySignature: 'retro:def456',
    title: 'Retry-safe retro filing',
    body: 'The filing path lost its response.',
    labels: ['retro'],
    ...overrides,
  };
  const digest = createHash('sha256').update(request.requestId).digest('hex');
  request.requestId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(
    13,
    16,
  )}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return request;
}

function expectedAuthorityBody(request: FileRetroDraftRequest, requestMarker: string): string {
  return [
    request.body,
    `<!-- safeword-retro-signature: ${request.legacySignature} -->`,
    `<!-- safeword-retro-canonical: ${request.canonicalKey} -->`,
    requestMarker,
  ].join('\n');
}

async function startGitHubFixture(
  options: {
    afterCreate?: () => void;
    afterToken?: () => void;
    appendRawBodyAfterFirstPage?: string;
    createDelayMs?: number;
    createHeaders?: Record<string, string>;
    createMessage?: string;
    createStatus?: number;
    failSecondPage?: boolean;
    failToken?: boolean;
    installationToken?: string;
    rawBodies?: string[];
    scanStatus?: number;
    tokenDelayMs?: number;
  } = {},
): Promise<{
  baseUrl: string;
  createBodies: string[];
  authorizationHeaders: string[];
  rawAcceptHeaders: string[];
  rawIssueUrls: string[];
  tokenRequests: { authorization: string; body: Record<string, unknown> }[];
  maximumConcurrentCreates: () => number;
}> {
  const createdBodies: string[] = [];
  const authorizationHeaders: string[] = [];
  const rawAcceptHeaders: string[] = [];
  const rawIssueUrls: string[] = [];
  let activeCreates = 0;
  let maximumConcurrentCreates = 0;
  const tokenRequests: { authorization: string; body: Record<string, unknown> }[] = [];
  const rawBodies = options.rawBodies ?? [];
  // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- The fake collaborator exposes pagination, token, and create boundaries in one server.
  const handleRequest = async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method === 'POST' && request.url === '/app/installations/42/access_tokens') {
      if (options.failToken === true) {
        response.statusCode = 500;
        response.end();
        return;
      }
      let body = '';
      for await (const chunk of request) body += String(chunk);
      if (options.tokenDelayMs !== undefined) await delay(options.tokenDelayMs);
      tokenRequests.push({
        authorization: request.headers.authorization ?? '',
        body: JSON.parse(body) as Record<string, unknown>,
      });
      response.statusCode = 201;
      response.setHeader('content-type', 'application/json');
      const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
      options.afterToken?.();
      response.end(
        JSON.stringify({
          token: options.installationToken ?? 'ghs_installation_secret',
          expires_at: expiresAt,
          permissions: { issues: 'write' },
        }),
      );
      return;
    }
    if (request.method === 'GET' && request.url?.includes('/issues')) {
      rawAcceptHeaders.push(request.headers.accept ?? '');
      rawIssueUrls.push(request.url);
      if (options.scanStatus !== undefined) {
        response.statusCode = options.scanStatus;
        response.end();
        return;
      }

      const pageParameter = new URL(request.url, 'https://github.invalid').searchParams.get('page');
      if (pageParameter === null) {
        response.statusCode = 400;
        response.end();
        return;
      }
      const page = Number(pageParameter);
      if (page > 1 && options.failSecondPage === true) {
        response.statusCode = 500;
        response.end();
        return;
      }
      if (page === 1 && options.appendRawBodyAfterFirstPage !== undefined) {
        rawBodies.push(options.appendRawBodyAfterFirstPage);
      }
      const pageBodies = rawBodies.slice((page - 1) * 100, page * 100);
      if (page * 100 < rawBodies.length) {
        response.setHeader(
          'link',
          `<https://api.github.invalid/issues?page=${page + 1}>; rel="next"`,
        );
      }
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify(
          pageBodies.map((body, index) => ({
            number: 700 + (page - 1) * 100 + index,
            body,
          })),
        ),
      );
      return;
    }
    if (request.method === 'POST' && request.url?.endsWith('/issues')) {
      activeCreates += 1;
      maximumConcurrentCreates = Math.max(maximumConcurrentCreates, activeCreates);
      authorizationHeaders.push(request.headers.authorization ?? '');
      let body = '';
      for await (const chunk of request) body += String(chunk);
      createdBodies.push(JSON.parse(body).body as string);
      options.afterCreate?.();
      if (options.createStatus !== undefined) {
        response.statusCode = options.createStatus;
        const responseHeaders = options.createHeaders ?? {};
        for (const [name, value] of Object.entries(responseHeaders)) {
          response.setHeader(name, value);
        }
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ message: options.createMessage ?? 'create failed' }));
        activeCreates -= 1;
        return;
      }
      if (options.createDelayMs !== undefined) {
        await delay(options.createDelayMs);
      }
      response.statusCode = 201;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ number: 900 + createdBodies.length }));
      activeCreates -= 1;
      return;
    }
    response.statusCode = 404;
    response.end();
  };
  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('missing fixture address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    createBodies: createdBodies,
    authorizationHeaders,
    rawAcceptHeaders,
    rawIssueUrls,
    tokenRequests,
    maximumConcurrentCreates: () => maximumConcurrentCreates,
  };
}

function postCreateCrashFaults(): RelayServerFaults {
  return {
    afterGitHubCreate: () => {
      throw new Error('simulated crash');
    },
  };
}

async function fixture(
  options: {
    afterCreate?: () => void;
    afterToken?: () => void;
    createDelayMs?: number;
    createHeaders?: Record<string, string>;
    createMessage?: string;
    createStatus?: number;
    failSecondPage?: boolean;
    failToken?: boolean;
    faults?: RelayServerFaults;
    githubRequestTimeoutMs?: number;
    installationToken?: string;
    rawBodies?: string[];
    scanStatus?: number;
    tokenDelayMs?: number;
    now?: () => Date;
  } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-integration-'));
  directories.push(directory);
  const githubFixture = await startGitHubFixture(options);
  const registry = new CredentialRegistry('deployment-pepper');
  const issueCredential = (
    harness: 'claude' | 'codex' | 'cursor' | 'operator' | 'collector-worker',
    secretCharacter: string,
    roles: ('file' | 'ingest' | 'operate' | 'reconcile')[] = ['file'],
  ) =>
    registry.issue({
      credentialId: `${harness}-integration`,
      harness,
      installationId: 42,
      repository: 'arcadeai/safeword',
      roles,
      secret: secretCharacter.repeat(64),
      subject: `${harness}-subject`,
      tenantId: 'tenant-1',
    });
  const credentials = {
    claude: issueCredential('claude', 'a'),
    codex: issueCredential('codex', 'b'),
    cursor: issueCredential('cursor', 'c'),
    operator: issueCredential('operator', 'd', ['reconcile', 'operate']),
    collectorWorker: issueCredential('collector-worker', 'e', ['ingest']),
  };
  const credential = credentials.claude;
  const store = RelayStore.open(path.join(directory, 'relay.sqlite'), {
    ...(options.now !== undefined && { now: options.now }),
  });
  stores.push(store);
  const tokenProvider = new GitHubAppTokenProvider({
    appId: '1234',
    baseUrl: githubFixture.baseUrl,
    privateKey: githubAppPrivateKeyPem,
  });
  const serverOptions = {
    credentials: registry,
    github: new GitHubRestClient({
      baseUrl: githubFixture.baseUrl,
      invalidateInstallationToken: (installationId, repo) => {
        tokenProvider.invalidate(installationId, repo);
      },
      installationToken: (installationId, repo) => tokenProvider.token(installationId, repo),
      ...(options.githubRequestTimeoutMs !== undefined && {
        requestTimeoutMs: options.githubRequestTimeoutMs,
      }),
    }),
    lockPath: path.join(directory, 'relay.lock'),
    payloadKey: Buffer.alloc(32, 7),
    store,
    ...(options.faults !== undefined && { faults: options.faults }),
    ...(options.now !== undefined && { now: options.now }),
  };
  const relay = await startRelayServer(serverOptions);
  servers.push(relay.server);
  return { ...githubFixture, credential, credentials, directory, registry, relay, store };
}

describe('retry-safe retro relay', () => {
  it('accepts exact collector bytes only through the ingest principal', async () => {
    let now = new Date('2026-08-29T20:00:00.000Z');
    const setup = await fixture({ now: () => now });
    const body = Buffer.from(
      JSON.stringify({
        version: 'v3',
        findings: [
          'Collector-owned finding\n\nThe worker preserved exact bytes.',
          'Second finding\n\nThe whole batch remained intact.',
        ],
        source: {
          harness: 'codex',
          hostClass: 'local',
          projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          repository: 'github.com/customer/example',
          safewordCliVersion: '0.82.1',
        },
        sessionScope: 'a'.repeat(64),
      }),
    );
    const response = await fetch(`${setup.relay.url}/v1/collector-retros`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${setup.credentials.collectorWorker}`,
        'content-type': 'application/json; charset=utf-8',
        'x-safeword-accepted-at': '2026-08-28T20:00:00Z',
        'x-safeword-envelope-digest': createHash('sha256').update(body).digest('hex'),
        'x-safeword-request-id': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      body,
    });
    now = new Date('2026-08-29T21:00:00.000Z');
    const duplicate = await fetch(`${setup.relay.url}/v1/collector-retros`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${setup.credentials.collectorWorker}`,
        'content-type': 'application/json; charset=utf-8',
        'x-safeword-accepted-at': '2026-08-28T20:00:00Z',
        'x-safeword-envelope-digest': createHash('sha256').update(body).digest('hex'),
        'x-safeword-request-id': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      body,
    });

    expect(response.status).toBe(201);
    expect(duplicate.status).toBe(201);
    expect(setup.createBodies).toHaveLength(1);
    expect(setup.createBodies[0]).toContain('The worker preserved exact bytes.');
    expect(setup.createBodies[0]).toContain('The whole batch remained intact.');
    const stored = setup.store.load({
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      tenantId: 'tenant-1',
    });
    expect(stored?.acceptedAt).toBe('2026-08-28T20:00:00Z');
    expect(stored?.retryDeadlineAt).toBe('2026-08-30T20:00:00.000Z');
  });

  it.each([
    ['claude', ['file'], 'fa'],
    ['codex', ['file'], 'fb'],
    ['cursor', ['file'], 'fc'],
    ['operator', ['reconcile', 'operate'], 'fd'],
  ] as const)(
    'denies the %s principal at collector ingest before GitHub access',
    async (harness, roles, secretCharacter) => {
      const setup = await fixture();
      const credential = setup.registry.issue({
        credentialId: `${harness}-without-ingest`,
        harness,
        installationId: 42,
        repository: 'arcadeai/safeword',
        roles: [...roles],
        secret: secretCharacter.repeat(32),
        subject: `${harness}-without-ingest`,
        tenantId: 'tenant-1',
      });
      const body = Buffer.from(
        JSON.stringify({
          version: 'v3',
          findings: ['Unauthorized collector ingest'],
          source: {
            harness: 'codex',
            hostClass: 'local',
            projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            safewordCliVersion: '0.82.1',
          },
          sessionScope: 'b'.repeat(64),
        }),
      );

      const response = await fetch(`${setup.relay.url}/v1/collector-retros`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${credential}`,
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-accepted-at': '2026-08-28T20:00:00Z',
          'x-safeword-envelope-digest': createHash('sha256').update(body).digest('hex'),
          'x-safeword-request-id': 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
        },
        body,
      });

      expect(response.status).toBe(403);
      expect(setup.createBodies).toHaveLength(0);
    },
  );

  it('denies the ingest-only collector worker at the harness filing route', async () => {
    const setup = await fixture();

    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${setup.credentials.collectorWorker}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(draft()),
    });

    expect(response.status).toBe(403);
    expect(setup.createBodies).toHaveLength(0);
  });

  it('accepts the largest relay-compatible collector batch without truncating its body', async () => {
    const setup = await fixture();
    const findings = Array.from({ length: 50 }, (_, index) => {
      const prefix = `${String(index).padStart(2, '0')}:${'t'.repeat(300)}\n`;
      return prefix + String(index % 10).repeat(1000 - prefix.length);
    });
    const body = Buffer.from(
      JSON.stringify({
        version: 'v3',
        findings,
        source: {
          harness: 'codex',
          hostClass: 'local',
          projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          repository: 'github.com/customer/example',
          safewordCliVersion: '0.82.1',
        },
        sessionScope: 'a'.repeat(64),
      }),
    );

    const response = await fetch(`${setup.relay.url}/v1/collector-retros`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${setup.credentials.collectorWorker}`,
        'content-type': 'application/json; charset=utf-8',
        'x-safeword-accepted-at': '2026-08-28T20:00:00.000Z',
        'x-safeword-envelope-digest': createHash('sha256').update(body).digest('hex'),
        'x-safeword-request-id': 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
      },
      body,
    });

    expect(response.status).toBe(201);
    expect(setup.createBodies).toHaveLength(1);
    expect(setup.createBodies[0]).toContain(findings[0]);
    expect(setup.createBodies[0]).toContain(findings.at(-1));
  });

  it('rejects a collector batch whose rendered issue body exceeds 60 KB', async () => {
    const setup = await fixture();
    const body = Buffer.from(
      JSON.stringify({
        version: 'v3',
        findings: Array.from({ length: 16 }, () => 'x'.repeat(4000)),
      }),
    );
    const response = await fetch(`${setup.relay.url}/v1/collector-retros`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${setup.credentials.collectorWorker}`,
        'content-type': 'application/json; charset=utf-8',
        'x-safeword-accepted-at': '2026-08-28T20:00:00.000Z',
        'x-safeword-envelope-digest': createHash('sha256').update(body).digest('hex'),
        'x-safeword-request-id': 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa',
      },
      body,
    });

    expect(response.status).toBe(400);
    expect(setup.createBodies).toHaveLength(0);
  });

  it('coalesces concurrent installation-token minting for the same repository scope', async () => {
    const github = await startGitHubFixture({ tokenDelayMs: 25 });
    const provider = new GitHubAppTokenProvider({
      appId: '1234',
      baseUrl: github.baseUrl,
      privateKey: githubAppPrivateKeyPem,
    });

    await expect(
      Promise.all([
        provider.token(42, 'arcadeai/safeword'),
        provider.token(42, 'arcadeai/safeword'),
      ]),
    ).resolves.toEqual(['ghs_installation_secret', 'ghs_installation_secret']);
    expect(github.tokenRequests).toHaveLength(1);
  });

  it('reports the open SQLite schema and replica identity without authentication', async () => {
    const setup = await fixture();

    const response = await fetch(`${setup.relay.url}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      schemaVersion: 4,
      replicaId: 'local',
      bootId: 'local',
    });
  });

  it('fails health closed when SQLite is unavailable', async () => {
    const setup = await fixture();
    setup.store.close();

    const response = await fetch(`${setup.relay.url}/health`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: 'unavailable' });
  });

  it('freezes the v1 receipt vocabulary and rejects unsupported API versions before filing', async () => {
    const setup = await fixture();

    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(draft({ requestId: 'unsupported-relay-version' })),
      headers: {
        authorization: `Bearer ${setup.credentials.claude}`,
        'content-type': 'application/json',
        'x-safeword-relay-api-version': '2',
      },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'unsupported relay API version',
      supportedVersion: '1',
    });
    expect(setup.createBodies).toHaveLength(0);
    expect(setup.store.operations().counts).toMatchObject({
      accepted: 0,
      ambiguous: 0,
      'dead-letter': 0,
      filed: 0,
      rejected: 0,
      retryable: 0,
    });
  });

  it('treats a headerless submit as legacy v1 and identifies the response version', async () => {
    const setup = await fixture();

    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(draft({ requestId: 'legacy-v1-submit' })),
      headers: {
        authorization: `Bearer ${setup.credentials.claude}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('x-safeword-relay-api-version')).toBe('1');
    await expect(response.json()).resolves.toMatchObject({ state: 'filed' });
  });

  it('uses one request identity across Claude, Codex, and Cursor', async () => {
    const setup = await fixture();
    const adapters = createHarnessAdapters(setup.relay.url, setup.credentials);

    const receipts = await Promise.all([
      adapters.claude.file(draft()),
      adapters.codex.file(draft()),
      adapters.cursor.file(draft()),
    ]);

    expect(receipts.map(receipt => receipt.issueNumber)).toEqual([901, 901, 901]);
    expect(setup.createBodies).toHaveLength(1);
    expect(
      setup.relay.observability.logs
        .map(log => log.harness)
        .toSorted((left, right) => String(left).localeCompare(String(right))),
    ).toEqual(['claude', 'codex', 'cursor']);
  });

  it.each([
    ['title', { title: 'changed' }],
    ['body', { body: 'changed' }],
    ['label order', { labels: ['security', 'retro'] as string[] }],
    ['duplicate labels', { labels: ['retro', 'retro'] as string[] }],
  ] as const)('[ORR-002] rejects a changed %s under the same identity', async (_field, change) => {
    const setup = await fixture();
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
    await adapter.file(draft({ labels: ['retro', 'security'] }));

    await expect(
      adapter.file(draft({ labels: ['retro', 'security'], ...change })),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(setup.createBodies).toHaveLength(1);
  });

  it('[ORR-030] [ORR-031] immediately returns the original filed result after 30-day payload compaction', async () => {
    const start = new Date();
    const setup = await fixture({ now: () => start });
    const adapters = createHarnessAdapters(setup.relay.url, setup.credentials, {
      pollBudgetMs: 0,
    });
    const original = await adapters.claude.file(draft());
    setup.store.maintain(new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000 + 10_000));

    const replay = await adapters.codex.file(draft());

    expect(replay).toEqual({
      issueNumber: original.issueNumber,
      receiptId: original.receiptId,
      requestId: original.requestId,
      state: 'tombstone',
    });
    expect(setup.createBodies).toHaveLength(1);
    await expect(
      adapters.cursor.file(draft({ body: 'changed after tombstone' })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('[ORR-030] does not start a dispatch when token acquisition crosses the 24-hour deadline', async () => {
    const acceptedAt = new Date();
    let current = acceptedAt;
    const setup = await fixture({
      afterToken: () => {
        current = new Date(acceptedAt.getTime() + 24 * 60 * 60 * 1000);
      },
      now: () => current,
    });

    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(draft({ requestId: 'crossed-retry-deadline' })),
      headers: {
        authorization: `Bearer ${setup.credentials.claude}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(setup.createBodies).toHaveLength(0);
    expect(setup.store.operations(current).counts['dead-letter']).toBe(1);
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credentials, {
        pollBudgetMs: 0,
      }).codex.file(draft({ requestId: 'crossed-retry-deadline' })),
    ).resolves.toMatchObject({ state: 'dead-letter' });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credentials).cursor.file(
        draft({ body: 'changed after dead letter', requestId: 'crossed-retry-deadline' }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('replays an existing exact receipt after its submitted deadline has elapsed', async () => {
    let current = new Date('2026-07-27T00:00:00.000Z');
    const setup = await fixture({ now: () => current });
    const original = draft({ retryDeadlineAt: '2026-07-27T00:01:00.000Z' });
    const filed = await createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(
      original,
    );
    current = new Date('2026-07-27T00:02:00.000Z');

    await expect(
      createHarnessAdapters(setup.relay.url, setup.credentials).codex.file(original),
    ).resolves.toEqual(filed);
    expect(setup.createBodies).toHaveLength(1);
  });

  it('cannot commit a filed result when GitHub work crosses the one-hour grace', async () => {
    const acceptedAt = new Date();
    let current = acceptedAt;
    const setup = await fixture({
      afterCreate: () => {
        current = new Date(acceptedAt.getTime() + 25 * 60 * 60 * 1000);
      },
      now: () => current,
    });

    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(draft({ requestId: 'crossed-grace-deadline' })),
      headers: {
        authorization: `Bearer ${setup.credentials.claude}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(503);
    expect(setup.store.operations(current).counts.ambiguous).toBe(1);
    expect(setup.store.pendingAlerts()).toEqual([expect.objectContaining({ state: 'ambiguous' })]);
  });

  it('[ORR-023] bounds request size fields timeouts and per-principal filing rate', async () => {
    const fixedNow = new Date('2026-07-27T00:00:00.000Z');
    const setup = await fixture({ now: () => fixedNow });
    expect(setup.relay.server.requestTimeout).toBe(10_000);
    expect(setup.relay.server.headersTimeout).toBe(10_000);

    const oversizedBody = 'x'.repeat(300_000);
    const oversized = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(draft({ body: oversizedBody })),
      headers: {
        authorization: `Bearer ${setup.credentials.claude}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    expect(oversized.status).toBe(413);

    const oversizedTitle = 'x'.repeat(300);
    const invalidField = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(draft({ requestId: 'bounded-fields', title: oversizedTitle })),
      headers: {
        authorization: `Bearer ${setup.credentials.codex}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });
    expect(invalidField.status).toBe(400);

    const statuses = await Promise.all(
      Array.from({ length: 61 }, async (_, index) => {
        const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
          body: JSON.stringify(draft({ requestId: `rate-${index}` })),
          headers: {
            authorization: `Bearer ${setup.credentials.cursor}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        });
        return response.status;
      }),
    );
    expect(statuses.filter(status => status === 201)).toHaveLength(60);
    expect(statuses.filter(status => status === 429)).toHaveLength(1);
  }, 15_000);

  it('reuses the filed receipt after response delivery is lost', async () => {
    let responseDropped = false;
    const setup = await fixture({
      faults: {
        afterReceiptCommit: () => {
          if (responseDropped) return;
          responseDropped = true;
          throw new Error('drop response');
        },
      },
    });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
    await expect(adapter.file(draft())).rejects.toThrow();

    await expect(adapter.file(draft())).resolves.toMatchObject({
      issueNumber: 901,
      state: 'filed',
    });
    expect(setup.createBodies).toHaveLength(1);
  });

  it('keeps token acquisition failure retryable before dispatch', async () => {
    const setup = await fixture({ failToken: true });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
    expect(setup.createBodies).toHaveLength(0);
    expect(
      setup.store.load({
        tenantId: 'tenant-1',
        installationId: 42,
        repository: 'arcadeai/safeword',
        requestId: draft().requestId,
      })?.state,
    ).toBe('retryable');
  });

  it('rejects non-canonical uppercase request identities at the HTTP boundary', async () => {
    const setup = await fixture();
    const request = draft();
    request.requestId = request.requestId.toUpperCase();

    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(request),
      headers: {
        authorization: `Bearer ${setup.credentials.claude}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    expect(setup.createBodies).toHaveLength(0);
  });

  it('quarantines a GitHub 5xx because the create outcome is ambiguous', async () => {
    const setup = await fixture({ createStatus: 500 });
    const request = draft();

    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(request),
      headers: {
        authorization: `Bearer ${setup.credentials.claude}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      receiptId: expect.any(String),
      requestId: request.requestId,
      state: 'ambiguous',
    });
    expect(setup.createBodies).toHaveLength(1);
    expect(
      setup.store.load({
        tenantId: 'tenant-1',
        installationId: 42,
        repository: 'arcadeai/safeword',
        requestId: request.requestId,
      })?.state,
    ).toBe('ambiguous');
  });

  it('aborts a stalled GitHub create and quarantines its uncertain outcome', async () => {
    const setup = await fixture({ createDelayMs: 1000, githubRequestTimeoutMs: 250 });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
    expect(setup.createBodies).toHaveLength(1);
    expect(
      setup.store.receipt({
        tenantId: 'tenant-1',
        installationId: 42,
        repository: 'arcadeai/safeword',
        requestId: draft().requestId,
      }),
    ).toMatchObject({ state: 'ambiguous' });
  });

  it('bounds concurrent GitHub creates at the outbound boundary', async () => {
    const github = await startGitHubFixture({ createDelayMs: 25 });
    const client = new GitHubRestClient({
      baseUrl: github.baseUrl,
      installationToken: () => Promise.resolve('unused'),
      maxConcurrentRequests: 1,
    });
    const create = (title: string) =>
      client.createIssue({
        installationId: 42,
        repository: 'arcadeai/safeword',
        title,
        body: title,
        labels: ['retro'],
        installationToken: 'ghs_installation_secret',
      });

    await Promise.all([create('first'), create('second')]);

    expect(github.maximumConcurrentCreates()).toBe(1);
  });

  it('[ORR-038] classifies documented create failures independently of response prose', () => {
    const validation = new GitHubCreateError({
      message: 'Validation Failed',
      status: 422,
    });
    const changedProse = new GitHubCreateError({
      message: 'The endpoint has been spammed',
      status: 422,
    });

    expect(validation.outcome).toBe('retryable');
    expect(changedProse.outcome).toBe(validation.outcome);
  });

  it.each([400, 404, 410])(
    'records GitHub %i as a certain terminal rejection',
    async statusCode => {
      const setup = await fixture({ createStatus: statusCode });
      const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

      await expect(adapter.file(draft())).resolves.toMatchObject({ state: 'rejected' });
      await expect(adapter.file(draft())).resolves.toMatchObject({ state: 'rejected' });
      expect(setup.createBodies).toHaveLength(1);
    },
  );

  it.each([401, 403, 429])(
    'keeps GitHub %i retryable because no issue was created',
    async status => {
      const setup = await fixture({ createStatus: status });
      const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

      await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
      expect(
        setup.store.load({
          tenantId: 'tenant-1',
          installationId: 42,
          repository: 'arcadeai/safeword',
          requestId: draft().requestId,
        })?.state,
      ).toBe('retryable');
    },
  );

  it.each(['Validation Failed', 'The endpoint has been spammed'])(
    'keeps GitHub 422 retryable without interpreting message %s',
    async message => {
      const setup = await fixture({ createMessage: message, createStatus: 422 });
      const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

      await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
      expect(
        setup.store.load({
          tenantId: 'tenant-1',
          installationId: 42,
          repository: 'arcadeai/safeword',
          requestId: draft().requestId,
        })?.state,
      ).toBe('retryable');
      expect(setup.createBodies).toHaveLength(1);
    },
  );

  it.each(['Resource not accessible by integration', 'You have exceeded a secondary rate limit'])(
    'keeps GitHub 403 retryable without interpreting message %s',
    async message => {
      const setup = await fixture({ createMessage: message, createStatus: 403 });

      await expect(
        createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft()),
      ).rejects.toMatchObject({ status: 503 });
      expect(
        setup.store.load({
          tenantId: 'tenant-1',
          installationId: 42,
          repository: 'arcadeai/safeword',
          requestId: draft().requestId,
        })?.state,
      ).toBe('retryable');
    },
  );

  it('honors GitHub Retry-After when scheduling a retry', async () => {
    const now = new Date('2026-07-27T00:00:00.000Z');
    const setup = await fixture({
      createHeaders: { 'retry-after': '600' },
      createMessage: 'secondary rate limit',
      createStatus: 403,
      now: () => now,
    });

    await expect(
      createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft()),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      setup.store.load({
        tenantId: 'tenant-1',
        installationId: 42,
        repository: 'arcadeai/safeword',
        requestId: draft().requestId,
      })?.nextAttemptAt,
    ).toBe('2026-07-27T00:10:00.000Z');
  });

  it('ignores a rate-limit reset while GitHub reports remaining capacity', () => {
    const error = new GitHubCreateError({
      rateLimitRemaining: '1',
      rateLimitReset: '1785111000',
      status: 401,
    });

    expect(error.retryNotBefore(new Date('2026-07-27T00:00:00.000Z'))).toBeUndefined();
  });

  it('invalidates a cached installation token after GitHub returns 401', async () => {
    let now = new Date('2026-07-27T00:00:00.000Z');
    const setup = await fixture({ createStatus: 401, now: () => now });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential);

    await expect(adapter.claude.file(draft())).rejects.toMatchObject({ status: 503 });
    now = new Date('2026-07-27T00:01:00.000Z');
    await expect(adapter.codex.file(draft())).rejects.toMatchObject({ status: 503 });

    expect(setup.tokenRequests).toHaveLength(2);
  });

  it('invalidates a cached installation token when a raw marker scan returns 401', async () => {
    const github = await startGitHubFixture({ scanStatus: 401 });
    const invalidations: [number, string][] = [];
    const client = new GitHubRestClient({
      baseUrl: github.baseUrl,
      installationToken: () => Promise.resolve('ghs_revoked'),
      invalidateInstallationToken: (installationId, repo) => {
        invalidations.push([installationId, repo]);
      },
    });

    await expect(
      client.scanExactMarker({
        installationId: 42,
        marker: '<!-- request -->',
        repository: 'arcadeai/safeword',
      }),
    ).resolves.toEqual({ complete: false, matches: [] });
    expect(invalidations).toEqual([[42, 'arcadeai/safeword']]);
  });

  it('rate-limits operator reconciliation independently of filing credentials', async () => {
    const fixedNow = new Date('2026-07-27T00:00:00.000Z');
    const setup = await fixture({ now: () => fixedNow });
    const statuses: number[] = [];
    for (let index = 0; index < 61; index += 1) {
      const response = await fetch(`${setup.relay.url}/v1/retro-filings/missing/reconcile`, {
        headers: { authorization: `Bearer ${setup.credentials.operator}` },
        method: 'POST',
      });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 60).every(status => status === 404)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it('maps malformed receipt escapes to 400 instead of an internal error', async () => {
    const setup = await fixture();
    const response = await fetch(`${setup.relay.url}/v1/retro-filings/%/reconcile`, {
      headers: { authorization: `Bearer ${setup.credentials.operator}` },
      method: 'POST',
    });

    expect(response.status).toBe(400);
  });

  it('rejects non-UUID request identities before durable or GitHub access', async () => {
    const setup = await fixture();
    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${setup.credential}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...draft(), requestId: 'session-private-text' }),
    });

    expect(response.status).toBe(400);
    expect(setup.createBodies).toHaveLength(0);
    expect(setup.store.operations().counts.accepted).toBe(0);
  });

  it('rejects unapproved request fields before durable or GitHub access', async () => {
    const setup = await fixture();
    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${setup.credential}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...draft(), privateSessionData: 'must-not-persist' }),
    });

    expect(response.status).toBe(400);
    expect(setup.createBodies).toHaveLength(0);
    expect(setup.store.operations().counts.accepted).toBe(0);
  });

  it('elects one creator across concurrent database connections', async () => {
    const setup = await fixture({ createDelayMs: 50 });
    const secondStore = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const secondRelay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: setup.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKeyring: {
        activeKeyId: 'rotated',
        keys: new Map([
          ['legacy', Buffer.alloc(32, 7)],
          ['rotated', Buffer.alloc(32, 8)],
        ]),
      },
      store: secondStore,
    });
    servers.push(secondRelay.server);

    const [first, second] = await Promise.all([
      createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(draft()),
      createHarnessAdapters(secondRelay.url, setup.credentials).codex.file(draft()),
    ]);

    expect(first.issueNumber).toBe(second.issueNumber);
    expect(setup.createBodies).toHaveLength(1);
    secondStore.close();
  });

  it('returns the latest stable receipt when the configured polling budget expires', async () => {
    const setup = await fixture({ createDelayMs: 100 });
    const creator = createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(draft());
    while (setup.createBodies.length === 0) {
      await new Promise<void>(resolve => setImmediate(resolve));
    }

    await expect(
      createHarnessAdapters(setup.relay.url, setup.credentials, {
        pollBudgetMs: 0,
      }).codex.file(draft()),
    ).rejects.toMatchObject({
      status: 202,
      details: {
        latestReceipt: {
          requestId: draft().requestId,
          state: 'dispatching',
        },
      },
    });
    await expect(creator).resolves.toMatchObject({ state: 'filed', issueNumber: 901 });
  });

  it('recovers a post-create crash as ambiguous and reconciles from raw REST', async () => {
    const setup = await fixture({
      faults: postCreateCrashFaults(),
    });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
    expect(setup.createBodies).toHaveLength(1);
    const marker = setup.createBodies[0]?.split('\n').at(-1);
    expect(marker).toMatch(/^<!-- safeword-retro-request-v1: [a-f\d]{64} -->$/);

    setup.store.close();
    setup.relay.server.close();
    const github = await startGitHubFixture({ rawBodies: [setup.createBodies[0] ?? ''] });
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKeyring: {
        activeKeyId: 'rotated',
        keys: new Map([
          ['legacy', Buffer.alloc(32, 7)],
          ['rotated', Buffer.alloc(32, 8)],
        ]),
      },
      store: reopened,
    });
    servers.push(relay.server);

    const durableBeforeReconcile = reopened.load({
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: draft().requestId,
      tenantId: 'tenant-1',
    });
    if (durableBeforeReconcile === undefined) throw new Error('missing ambiguous request');
    const receipt = await createHarnessAdapters(
      relay.url,
      setup.credentials,
    ).operator.reconcileReceipt(durableBeforeReconcile.receiptId);
    expect(receipt).toMatchObject({ issueNumber: 700, state: 'filed' });
    expect(reopened.reconciliationAudit(receipt.receiptId)).toEqual([
      {
        actorSubject: 'operator-subject',
        disposition: 'adopted',
        matchCount: 1,
      },
    ]);
    expect(relay.observability.metrics).toContainEqual({
      metric: 'retro_reconciliation_outcome',
      disposition: 'adopted',
    });
    expect(github.createBodies).toHaveLength(0);
    reopened.close();
  });

  it('retries a due durable request once across process restart', async () => {
    const setup = await fixture({ failToken: true });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft()),
    ).rejects.toMatchObject({ status: 503 });
    const retryable = setup.store.load({
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: draft().requestId,
      tenantId: 'tenant-1',
    });
    expect(retryable?.state).toBe('retryable');
    if (retryable === undefined) throw new Error('missing retryable request');

    setup.store.close();
    setup.relay.server.close();
    const github = await startGitHubFixture();
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKeyring: {
        activeKeyId: 'rotated',
        keys: new Map([
          ['legacy', Buffer.alloc(32, 7)],
          ['rotated', Buffer.alloc(32, 8)],
        ]),
      },
      store: reopened,
    });
    servers.push(relay.server);

    const dueAt = new Date(new Date(retryable.nextAttemptAt ?? retryable.acceptedAt).getTime() + 1);
    await relay.maintain(dueAt);

    expect(github.createBodies).toHaveLength(1);
    expect(reopened.receipt(retryable.scope)).toMatchObject({
      issueNumber: 901,
      state: 'filed',
    });
    reopened.close();
  });

  it.each([0, 2])(
    'keeps an ambiguous request quarantined for %i raw request-marker matches',
    async matchCount => {
      const setup = await fixture({
        faults: postCreateCrashFaults(),
      });
      const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
      await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
      const marker = setup.createBodies[0]?.split('\n').at(-1) ?? '';

      setup.store.close();
      setup.relay.server.close();
      const github = await startGitHubFixture({
        rawBodies: Array.from({ length: matchCount }, () => marker),
      });
      const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
      const relay = await startRelayServer({
        allowUnlockedForTests: true,
        credentials: setup.registry,
        github: new GitHubRestClient({
          baseUrl: github.baseUrl,
          installationToken: () => Promise.resolve('ghs_installation_secret'),
        }),
        payloadKey: Buffer.alloc(32, 7),
        store: reopened,
      });
      servers.push(relay.server);

      const durable = reopened.load({
        tenantId: 'tenant-1',
        installationId: 42,
        repository: 'arcadeai/safeword',
        requestId: draft().requestId,
      });
      if (durable === undefined) throw new Error('missing ambiguous request');
      await expect(
        createHarnessAdapters(relay.url, setup.credentials).operator.reconcileReceipt(
          durable.receiptId,
        ),
      ).rejects.toMatchObject({ status: 503 });
      expect(reopened.reconciliationAudit(durable.receiptId)).toEqual([
        {
          actorSubject: 'operator-subject',
          disposition: matchCount === 0 ? 'zero' : 'multiple',
          matchCount,
        },
      ]);
      expect(relay.observability.logs).toContainEqual(
        expect.objectContaining({
          alert: true,
          disposition: matchCount === 0 ? 'zero' : 'multiple',
          event: 'retro_reconciliation',
        }),
      );
      expect(github.createBodies).toHaveLength(0);
      reopened.close();
    },
  );

  it('keeps a sole request-marker match quarantined when its raw evidence conflicts', async () => {
    const setup = await fixture({
      faults: postCreateCrashFaults(),
    });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft()),
    ).rejects.toMatchObject({ status: 503 });
    const marker = setup.createBodies[0]?.split('\n').at(-1) ?? '';

    setup.store.close();
    setup.relay.server.close();
    const github = await startGitHubFixture({
      rawBodies: [
        [
          '<!-- safeword-retro-signature: retro:wrong -->',
          '<!-- safeword-retro-canonical: canonical:wrong -->',
          marker,
        ].join('\n'),
      ],
    });
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store: reopened,
    });
    servers.push(relay.server);
    const durable = reopened.load({
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: draft().requestId,
    });
    if (durable === undefined) throw new Error('missing ambiguous request');
    const operator = createHarnessAdapters(relay.url, setup.credentials).operator;

    await expect(operator.reconcileReceipt(durable.receiptId)).rejects.toMatchObject({
      status: 503,
    });
    await expect(operator.recoverReceipt(durable.receiptId)).rejects.toMatchObject({
      status: 503,
    });
    expect(reopened.reconciliationAudit(durable.receiptId)).toEqual([
      {
        actorSubject: 'operator-subject',
        disposition: 'conflict',
        matchCount: 1,
      },
      {
        actorSubject: 'operator-subject',
        disposition: 'conflict',
        matchCount: 1,
      },
    ]);
    expect(reopened.receipt(durable.scope)).toMatchObject({ state: 'ambiguous' });
    reopened.close();
  });

  it('lets only an operator recover a complete zero-match with the reserved request marker', async () => {
    const setup = await fixture({ createStatus: 500 });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(draft()),
    ).rejects.toMatchObject({ status: 503 });
    const durable = setup.store.load({
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: draft().requestId,
    });
    if (durable === undefined) throw new Error('missing ambiguous request');
    setup.store.close();
    setup.relay.server.close();

    const github = await startGitHubFixture({ rawBodies: [] });
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store: reopened,
    });
    servers.push(relay.server);
    const adapters = createHarnessAdapters(relay.url, setup.credentials);

    await expect(adapters.claude.recoverReceipt(durable.receiptId)).rejects.toMatchObject({
      status: 403,
    });
    await expect(adapters.operator.recoverReceipt(durable.receiptId)).resolves.toMatchObject({
      issueNumber: 901,
      state: 'filed',
    });
    expect(github.createBodies).toHaveLength(1);
    expect(github.createBodies[0]).toBe(expectedAuthorityBody(draft(), durable.requestMarker));
    expect(reopened.reconciliationAudit(durable.receiptId)).toEqual([
      {
        actorSubject: 'operator-subject',
        disposition: 'manual-create-attempted',
        matchCount: 0,
      },
      {
        actorSubject: 'operator-subject',
        disposition: 'manual-created',
        matchCount: 0,
      },
    ]);
    reopened.close();
  });

  it('lets an operator recover a deadline dead letter under the original request identity', async () => {
    let current = new Date('2026-07-27T00:00:00.000Z');
    const original = draft({ retryDeadlineAt: '2026-07-27T00:01:00.000Z' });
    const setup = await fixture({ failToken: true, now: () => current });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(original),
    ).rejects.toMatchObject({ status: 503 });
    current = new Date('2026-07-27T00:02:00.000Z');
    setup.store.maintain(current);
    const durable = setup.store.load({
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: original.requestId,
    });
    if (durable === undefined) throw new Error('missing dead-letter request');
    expect(setup.store.receipt(durable.scope)).toMatchObject({ state: 'dead-letter' });
    expect(setup.store.beginManualRecovery(durable.scope, current)).toBe(true);
    setup.store.close();
    setup.relay.server.close();

    const github = await startGitHubFixture({ rawBodies: [] });
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'), {
      now: () => current,
    });
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store: reopened,
      now: () => current,
    });
    servers.push(relay.server);
    expect(reopened.receipt(durable.scope)).toMatchObject({ state: 'dead-letter' });

    await expect(
      createHarnessAdapters(relay.url, setup.credentials).operator.recoverReceipt(
        durable.receiptId,
      ),
    ).resolves.toMatchObject({
      issueNumber: 901,
      requestId: original.requestId,
      state: 'filed',
    });
    expect(github.createBodies).toEqual([expectedAuthorityBody(original, durable.requestMarker)]);
    expect(reopened.reconciliationAudit(durable.receiptId)).toEqual([
      {
        actorSubject: 'operator-subject',
        disposition: 'manual-create-attempted',
        matchCount: 0,
      },
      {
        actorSubject: 'operator-subject',
        disposition: 'manual-created',
        matchCount: 0,
      },
    ]);
    reopened.close();
  });

  it('reports dead-letter state when operator recovery cannot create', async () => {
    let current = new Date('2026-07-27T00:00:00.000Z');
    const original = draft({ retryDeadlineAt: '2026-07-27T00:01:00.000Z' });
    const setup = await fixture({ failToken: true, now: () => current });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(original),
    ).rejects.toMatchObject({ status: 503 });
    current = new Date('2026-07-27T00:02:00.000Z');
    setup.store.maintain(current);
    const durable = setup.store.load({
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: original.requestId,
    });
    if (durable === undefined) throw new Error('missing dead-letter request');
    setup.store.close();
    setup.relay.server.close();

    const github = await startGitHubFixture({ createStatus: 500, rawBodies: [] });
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'), {
      now: () => current,
    });
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store: reopened,
      now: () => current,
    });
    servers.push(relay.server);

    await expect(
      createHarnessAdapters(relay.url, setup.credentials).operator.recoverReceipt(
        durable.receiptId,
      ),
    ).rejects.toMatchObject({ details: { state: 'dead-letter' }, status: 503 });
    reopened.close();
  });

  it('serializes simultaneous operator recovery attempts to one GitHub create', async () => {
    const setup = await fixture({ createStatus: 500 });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(draft()),
    ).rejects.toMatchObject({ status: 503 });
    const durable = setup.store.load({
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: draft().requestId,
    });
    if (durable === undefined) throw new Error('missing ambiguous request');
    setup.store.close();
    setup.relay.server.close();

    const github = await startGitHubFixture({ createDelayMs: 25, rawBodies: [] });
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store: reopened,
    });
    servers.push(relay.server);
    const operator = createHarnessAdapters(relay.url, setup.credentials).operator;

    const outcomes = await Promise.allSettled([
      operator.recoverReceipt(durable.receiptId),
      operator.recoverReceipt(durable.receiptId),
    ]);

    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
    expect(github.createBodies).toHaveLength(1);
    expect(reopened.receipt(durable.scope)).toMatchObject({ issueNumber: 901, state: 'filed' });
    reopened.close();
  });

  it('serializes simultaneous reconciliation to one adoption and one audit row', async () => {
    const setup = await fixture({ faults: postCreateCrashFaults() });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft()),
    ).rejects.toMatchObject({ status: 503 });
    const durable = setup.store.load({
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: draft().requestId,
    });
    if (durable === undefined) throw new Error('missing ambiguous request');
    const createdBody = setup.createBodies[0] ?? '';
    setup.store.close();
    setup.relay.server.close();

    const github = await startGitHubFixture({ rawBodies: [createdBody] });
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store: reopened,
    });
    servers.push(relay.server);
    const operator = createHarnessAdapters(relay.url, setup.credentials).operator;

    const outcomes = await Promise.allSettled([
      operator.reconcileReceipt(durable.receiptId),
      operator.reconcileReceipt(durable.receiptId),
    ]);

    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
    expect(reopened.reconciliationAudit(durable.receiptId)).toEqual([
      {
        actorSubject: 'operator-subject',
        disposition: 'adopted',
        matchCount: 1,
      },
    ]);
    reopened.close();
  });

  it('[ORR-018] authorizes the exact repository and rejects invalid credentials before GitHub', async () => {
    const setup = await fixture();
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft()),
    ).resolves.toMatchObject({ issueNumber: 901, state: 'filed' });
    const unauthorized = setup.registry.issue({
      credentialId: 'wrong-repository',
      harness: 'cursor',
      installationId: 99,
      repository: 'arcadeai/other',
      roles: ['file'],
      secret: 'b'.repeat(64),
      subject: 'integration',
      tenantId: 'tenant-1',
    });

    for (const credential of [
      '',
      'malformed',
      `swc_unknown-${'c'.repeat(8)}_${'c'.repeat(64)}`,
      unauthorized,
    ]) {
      await expect(
        createHarnessAdapters(setup.relay.url, credential).cursor.file(
          draft({ requestId: `unauthorized-${credential.length}` }),
        ),
      ).rejects.toMatchObject({ status: credential === unauthorized ? 403 : 401 });
    }
    expect(setup.createBodies).toHaveLength(1);
  });

  it('keeps receipt lookup non-enumerating and requires the reconcile role', async () => {
    const setup = await fixture();
    const receipt = await createHarnessAdapters(setup.relay.url, setup.credential).claude.file(
      draft(),
    );
    const wrongScope = setup.registry.issue({
      credentialId: 'wrong-scope-status',
      harness: 'cursor',
      installationId: 99,
      repository: 'arcadeai/other',
      roles: ['file'],
      secret: 'e'.repeat(64),
      subject: 'wrong-scope',
      tenantId: 'tenant-1',
    });
    const hidden = await fetch(`${setup.relay.url}/v1/retro-filings/${receipt.receiptId}`, {
      headers: { authorization: `Bearer ${wrongScope}` },
    });
    expect(hidden.status).toBe(404);

    const ambiguous = await fixture();
    await expect(
      createHarnessAdapters(ambiguous.relay.url, ambiguous.credential).operator.reconcileReceipt(
        'missing',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('[ORR-019] denies harness principals access to operator lifecycle operations', async () => {
    const setup = await fixture();
    await createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(draft());

    const denied = await fetch(`${setup.relay.url}/v1/operations/retro-filings`, {
      headers: { authorization: `Bearer ${setup.credentials.claude}` },
    });
    expect(denied.status).toBe(403);
  });

  it('[ORR-032] exposes payload-free lifecycle operations to the operator through the real HTTP route', async () => {
    const fixedNow = new Date('2026-07-27T00:00:00.000Z');
    const setup = await fixture({ now: () => fixedNow });
    await createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(draft());

    const response = await fetch(`${setup.relay.url}/v1/operations/retro-filings`, {
      headers: { authorization: `Bearer ${setup.credentials.operator}` },
    });
    expect(response.status).toBe(200);
    const operations = (await response.json()) as Record<string, unknown>;
    expect(operations).toMatchObject({
      bootId: 'local',
      counts: { filed: 1 },
      schemaVersion: 4,
    });
    const observable = JSON.stringify(operations);
    expect(observable).not.toContain(draft().body);
    expect(observable).not.toContain(setup.credentials.operator);
    expect(observable).not.toContain('ghs_installation_secret');

    const statuses: number[] = [];
    for (let index = 0; index < 60; index += 1) {
      const operationsResponse = await fetch(`${setup.relay.url}/v1/operations/retro-filings`, {
        headers: { authorization: `Bearer ${setup.credentials.operator}` },
      });
      statuses.push(operationsResponse.status);
    }
    expect(statuses.slice(0, 59).every(status => status === 200)).toBe(true);
    expect(statuses[59]).toBe(429);
  });

  it('uses a server-held installation token without persisting or observing secrets', async () => {
    const setup = await fixture();
    await createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft());

    expect(setup.authorizationHeaders).toEqual(['Bearer ghs_installation_secret']);
    expect(setup.tokenRequests).toHaveLength(1);
    expectValidGitHubAppJwt(setup.tokenRequests[0]?.authorization);
    expect(setup.tokenRequests[0]?.body).toEqual({
      repositories: ['safeword'],
      permissions: { issues: 'write' },
    });
    const observable = JSON.stringify(setup.relay.observability);
    expect(observable).toContain(draft().requestId);
    expect(observable).toContain('filed');
    expect(observable).not.toContain(setup.credential);
    expect(observable).not.toContain('ghs_installation_secret');

    for (const databaseFile of databaseFiles(setup.directory)) {
      const databaseText = databaseFile.toString('utf8');
      expect(databaseText).not.toContain(setup.credential);
      expect(databaseText).not.toContain('ghs_installation_secret');
      expect(databaseText).not.toContain(draft().body);
    }
  });

  it.each(['ghs_classic_opaque', 'ghs_stateless.header.payload'])(
    '[ORR-022] treats installation token format %s as opaque',
    async installationToken => {
      const setup = await fixture({ installationToken });
      await createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft());

      expect(setup.authorizationHeaders).toEqual([`Bearer ${installationToken}`]);
      expect(JSON.stringify(setup.relay.observability)).not.toContain(installationToken);
      expect(
        readFileSync(path.join(setup.directory, 'relay.sqlite')).toString('utf8'),
      ).not.toContain(installationToken);
    },
  );

  it('fails closed when raw REST pagination is incomplete', async () => {
    const setup = await fixture({
      faults: postCreateCrashFaults(),
    });
    await expect(
      createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft()),
    ).rejects.toMatchObject({ status: 503 });
    const marker = setup.createBodies[0]?.split('\n').at(-1) ?? '';
    const ambiguous = setup.store.load({
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
      requestId: draft().requestId,
    });
    if (ambiguous === undefined) throw new Error('missing ambiguous request');

    setup.store.close();
    setup.relay.server.close();
    const github = await startGitHubFixture({
      failSecondPage: true,
      rawBodies: [marker, ...Array.from({ length: 99 }, (_, index) => `issue ${index}`)],
    });
    const reopened = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store: reopened,
    });
    servers.push(relay.server);

    await expect(
      createHarnessAdapters(relay.url, setup.credentials).operator.reconcileReceipt(
        ambiguous.receiptId,
      ),
    ).rejects.toMatchObject({
      status: 503,
      details: { disposition: 'incomplete' },
    });
    expect(github.createBodies).toHaveLength(0);
    reopened.close();
  });

  it('fails reconciliation closed when the overall raw REST page budget is exhausted', async () => {
    const github = await startGitHubFixture({
      rawBodies: Array.from({ length: 101 }, (_, index) => `issue ${index}`),
    });
    const client = new GitHubRestClient({
      baseUrl: github.baseUrl,
      installationToken: () => Promise.resolve('ghs_installation_secret'),
      reconciliationMaxPages: 1,
    });

    await expect(
      client.scanExactMarker({
        installationId: 42,
        marker: '<!-- no-match -->',
        repository: 'arcadeai/safeword',
      }),
    ).resolves.toEqual({ complete: false, matches: [] });
  });

  it('completes a raw marker scan beyond the repository current page count', async () => {
    const marker = '<!-- safeword-retro-request:late-page -->';
    const github = await startGitHubFixture({
      rawBodies: [...Array.from({ length: 1500 }, (_, index) => `issue ${index}`), marker],
    });
    const client = new GitHubRestClient({
      baseUrl: github.baseUrl,
      installationToken: () => Promise.resolve('ghs_installation_secret'),
    });

    await expect(
      client.scanExactMarker({
        installationId: 42,
        marker,
        repository: 'arcadeai/safeword',
      }),
    ).resolves.toEqual({
      complete: true,
      matches: [{ body: marker, issueNumber: 2200 }],
    });
  });

  it('keeps an ascending raw scan complete when a new issue arrives between pages', async () => {
    const marker = '<!-- safeword-retro-request:created-during-scan -->';
    const github = await startGitHubFixture({
      appendRawBodyAfterFirstPage: marker,
      rawBodies: Array.from({ length: 101 }, (_, index) => `existing issue ${index}`),
    });
    const client = new GitHubRestClient({
      baseUrl: github.baseUrl,
      installationToken: () => Promise.resolve('ghs_installation_secret'),
    });

    await expect(
      client.scanExactMarker({
        installationId: 42,
        marker,
        repository: 'arcadeai/safeword',
      }),
    ).resolves.toEqual({
      complete: true,
      matches: [{ body: marker, issueNumber: 801 }],
    });
    expect(github.rawIssueUrls).toHaveLength(2);
    for (const requested of github.rawIssueUrls) {
      const parameters = new URL(requested, github.baseUrl).searchParams;
      expect(parameters.get('state')).toBe('all');
      expect(parameters.get('sort')).toBe('created');
      expect(parameters.get('direction')).toBe('asc');
    }
  });

  it('rejects a retry deadline that already elapsed before durable acceptance', async () => {
    const setup = await fixture();

    const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
      body: JSON.stringify(draft({ retryDeadlineAt: '2020-01-01T00:00:00.000Z' })),
      headers: {
        authorization: `Bearer ${setup.credential}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid relay filing request',
      reason: 'retry-deadline-elapsed',
    });
    expect(
      Object.values(setup.store.operations().counts).reduce((sum, count) => sum + count, 0),
    ).toBe(0);
  });

  it('bounds reconciliation across delayed token minting and a saturated request queue', async () => {
    const github = await startGitHubFixture({ createDelayMs: 100 });
    const client = new GitHubRestClient({
      baseUrl: github.baseUrl,
      installationToken: async () => {
        await delay(10);
        return 'ghs_installation_secret';
      },
      maxConcurrentRequests: 1,
      reconciliationTimeoutMs: 30,
      requestTimeoutMs: 250,
    });
    const occupyingCreate = client.createIssue({
      body: 'occupy capacity',
      installationId: 42,
      installationToken: 'ghs_installation_secret',
      labels: [],
      repository: 'arcadeai/safeword',
      title: 'occupy capacity',
    });
    while (github.createBodies.length === 0) await delay(1);

    await expect(
      client.scanExactMarker({
        installationId: 42,
        marker: '<!-- no-match -->',
        repository: 'arcadeai/safeword',
      }),
    ).resolves.toEqual({ complete: false, matches: [] });
    await expect(occupyingCreate).resolves.toBeGreaterThan(0);
  });
});
