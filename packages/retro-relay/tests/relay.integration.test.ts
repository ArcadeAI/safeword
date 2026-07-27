import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CredentialRegistry,
  type FileRetroDraftRequest,
  GitHubAppTokenProvider,
  GitHubRestClient,
  RelayStore,
  startRelayServer,
} from '../src/index.js';
import { createHarnessAdapters } from './support/harness-client.js';

const { privateKey: githubAppPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const githubAppPrivateKeyPem = githubAppPrivateKey.export({
  format: 'pem',
  type: 'pkcs8',
});

const directories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  const openServers = [...servers];
  servers.length = 0;
  await Promise.all(
    openServers.map(
      server =>
        new Promise<void>((resolve, reject) => {
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

async function startGitHubFixture(
  options: {
    afterCreate?: () => void;
    afterToken?: () => void;
    createDelayMs?: number;
    createStatus?: number;
    failSecondPage?: boolean;
    failToken?: boolean;
    githubRequestTimeoutMs?: number;
    installationToken?: string;
    rawBodies?: string[];
    scanDelayMs?: number;
    sanitizedMcpBodies?: string[];
    tokenDelayMs?: number;
  } = {},
): Promise<{
  baseUrl: string;
  createBodies: string[];
  authorizationHeaders: string[];
  rawAcceptHeaders: string[];
  sanitizedMcpBodies: string[];
  tokenRequests: { authorization: string; body: Record<string, unknown> }[];
  maximumConcurrentCreates: () => number;
}> {
  const createdBodies: string[] = [];
  const authorizationHeaders: string[] = [];
  const rawAcceptHeaders: string[] = [];
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
      if (options.scanDelayMs !== undefined) await delay(options.scanDelayMs);

      const page = Number(new URL(request.url, 'https://github.invalid').searchParams.get('page'));
      if (page > 1 && options.failSecondPage === true) {
        response.statusCode = 500;
        response.end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify(
          page > 1
            ? []
            : rawBodies.map((body, index) => ({
                number: 700 + index,
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
        response.end();
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
    sanitizedMcpBodies: options.sanitizedMcpBodies ?? [],
    tokenRequests,
    maximumConcurrentCreates: () => maximumConcurrentCreates,
  };
}

async function fixture(
  options: {
    afterCreate?: () => void;
    afterToken?: () => void;
    createDelayMs?: number;
    createStatus?: number;
    failSecondPage?: boolean;
    failToken?: boolean;
    githubRequestTimeoutMs?: number;
    installationToken?: string;
    rawBodies?: string[];
    scanDelayMs?: number;
    sanitizedMcpBodies?: string[];
    tokenDelayMs?: number;
    now?: () => Date;
  } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-integration-'));
  directories.push(directory);
  const githubFixture = await startGitHubFixture(options);
  const registry = new CredentialRegistry('deployment-pepper');
  const issueCredential = (
    harness: 'claude' | 'codex' | 'cursor' | 'operator',
    secretCharacter: string,
    roles: ('file' | 'operate' | 'reconcile')[] = ['file'],
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
  };
  const credential = credentials.claude;
  const store = RelayStore.open(path.join(directory, 'relay.sqlite'), {
    ...(options.now !== undefined && { now: options.now }),
  });
  const tokenProvider = new GitHubAppTokenProvider({
    appId: '1234',
    baseUrl: githubFixture.baseUrl,
    privateKey: githubAppPrivateKeyPem,
    ...(options.githubRequestTimeoutMs !== undefined && {
      requestTimeoutMs: options.githubRequestTimeoutMs,
    }),
  });
  const serverOptions = {
    credentials: registry,
    github: new GitHubRestClient({
      baseUrl: githubFixture.baseUrl,
      installationToken: (installationId, repo) => tokenProvider.token(installationId, repo),
      ...(options.githubRequestTimeoutMs !== undefined && {
        requestTimeoutMs: options.githubRequestTimeoutMs,
      }),
    }),
    lockPath: path.join(directory, 'relay.lock'),
    payloadKey: Buffer.alloc(32, 7),
    store,
    ...(options.now !== undefined && { now: options.now }),
  };
  const relay = await startRelayServer(serverOptions);
  servers.push(relay.server);
  return { ...githubFixture, credential, credentials, directory, registry, relay, store };
}

describe('retry-safe retro relay', () => {
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
      schemaVersion: 3,
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
  ] as const)('rejects a changed %s under the same identity', async (_field, change) => {
    const setup = await fixture();
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
    await adapter.file(draft());

    await expect(adapter.file(draft(change))).rejects.toMatchObject({
      status: 409,
    });
    expect(setup.createBodies).toHaveLength(1);
  });

  it('immediately returns the original filed result after 30-day payload compaction', async () => {
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
  });

  it('does not start a dispatch when token acquisition crosses the 24-hour deadline', async () => {
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

  it('bounds request size fields timeouts and per-principal filing rate', async () => {
    const setup = await fixture();
    expect(setup.relay.server.requestTimeout).toBeLessThanOrEqual(10_000);
    expect(setup.relay.server.headersTimeout).toBeLessThanOrEqual(15_000);

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

    const statuses: number[] = [];
    for (let index = 0; index < 61; index += 1) {
      const response = await fetch(`${setup.relay.url}/v1/retro-filings`, {
        body: JSON.stringify(draft({ requestId: `rate-${index}` })),
        headers: {
          authorization: `Bearer ${setup.credentials.cursor}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 60).every(status => status === 201)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it('reuses the filed receipt after response delivery is lost', async () => {
    const setup = await fixture();
    setup.relay.faults.afterReceiptCommit = () => {
      throw new Error('drop response');
    };
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
    await expect(adapter.file(draft())).rejects.toThrow();
    setup.relay.faults.afterReceiptCommit = undefined;

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

  it('quarantines a GitHub 5xx because the create outcome is ambiguous', async () => {
    const setup = await fixture({ createStatus: 500 });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
    expect(setup.createBodies).toHaveLength(1);
    expect(
      setup.store.load({
        tenantId: 'tenant-1',
        installationId: 42,
        repository: 'arcadeai/safeword',
        requestId: draft().requestId,
      })?.state,
    ).toBe('ambiguous');
  });

  it('aborts a stalled GitHub create and quarantines its uncertain outcome', async () => {
    const setup = await fixture({ createDelayMs: 100, githubRequestTimeoutMs: 10 });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
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
        repository: 'arcadeai/safeword',
        title,
        body: title,
        labels: ['retro'],
        installationToken: 'ghs_installation_secret',
      });

    await Promise.all([create('first'), create('second')]);

    expect(github.maximumConcurrentCreates()).toBe(1);
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

  it.each([401, 403, 422, 429])(
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

  it('rate-limits operator reconciliation independently of filing credentials', async () => {
    const setup = await fixture();
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
      payloadKey: Buffer.alloc(32, 7),
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
    const setup = await fixture();
    setup.relay.faults.afterGitHubCreate = () => {
      throw new Error('simulated crash');
    };
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
    expect(setup.createBodies).toHaveLength(1);
    const marker = setup.createBodies[0]?.split('\n').at(-1);
    expect(marker).toMatch(/^<!-- safeword-retro-request-v1: [a-f\d]{64} -->$/);

    setup.store.close();
    setup.relay.server.close();
    const github = await startGitHubFixture({ rawBodies: [marker ?? ''] });
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
      payloadKey: Buffer.alloc(32, 7),
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
      const setup = await fixture();
      setup.relay.faults.afterGitHubCreate = () => {
        throw new Error('simulated crash');
      };
      const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
      await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
      const marker = setup.createBodies[0]?.split('\n').at(-1) ?? '';

      setup.store.close();
      setup.relay.server.close();
      const github = await startGitHubFixture({
        rawBodies: Array.from({ length: matchCount }, () => marker),
        ...(matchCount === 0 && { sanitizedMcpBodies: [marker] }),
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
      if (matchCount === 0) expect(github.sanitizedMcpBodies).toContain(marker);
      reopened.close();
    },
  );

  it('authorizes the exact repository and rejects invalid credentials before GitHub', async () => {
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
    ambiguous.relay.faults.afterGitHubCreate = () => {
      throw new Error('simulated crash');
    };
    await expect(
      createHarnessAdapters(ambiguous.relay.url, ambiguous.credential).operator.reconcileReceipt(
        'missing',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('exposes payload-free lifecycle operations only to the operator role', async () => {
    const setup = await fixture();
    await createHarnessAdapters(setup.relay.url, setup.credentials).claude.file(draft());

    const denied = await fetch(`${setup.relay.url}/v1/operations/retro-filings`, {
      headers: { authorization: `Bearer ${setup.credentials.claude}` },
    });
    expect(denied.status).toBe(403);

    const response = await fetch(`${setup.relay.url}/v1/operations/retro-filings`, {
      headers: { authorization: `Bearer ${setup.credentials.operator}` },
    });
    expect(response.status).toBe(200);
    const operations = (await response.json()) as Record<string, unknown>;
    expect(operations).toMatchObject({
      bootId: 'local',
      counts: { filed: 1 },
      schemaVersion: 3,
    });
    const observable = JSON.stringify(operations);
    expect(observable).not.toContain(draft().body);
    expect(observable).not.toContain(setup.credentials.operator);
    expect(observable).not.toContain('ghs_installation_secret');
  });

  it('uses a server-held installation token without persisting or observing secrets', async () => {
    const setup = await fixture();
    await createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft());

    expect(setup.authorizationHeaders).toEqual(['Bearer ghs_installation_secret']);
    expect(setup.tokenRequests).toHaveLength(1);
    expect(setup.tokenRequests[0]?.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/u);
    expect(setup.tokenRequests[0]?.body).toEqual({
      repositories: ['safeword'],
      permissions: { issues: 'write' },
    });
    const observable = JSON.stringify(setup.relay.observability);
    expect(observable).toContain(draft().requestId);
    expect(observable).toContain('filed');
    expect(observable).not.toContain(setup.credential);
    expect(observable).not.toContain('ghs_installation_secret');

    const databaseText = readFileSync(path.join(setup.directory, 'relay.sqlite')).toString('utf8');
    expect(databaseText).not.toContain(setup.credential);
    expect(databaseText).not.toContain('ghs_installation_secret');
    expect(databaseText).not.toContain(draft().body);
  });

  it.each(['ghs_classic_opaque', 'ghs_stateless.header.payload'])(
    'treats installation token format %s as opaque',
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
    const setup = await fixture();
    setup.relay.faults.afterGitHubCreate = () => {
      throw new Error('simulated crash');
    };
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
      rawBodies: Array.from({ length: 100 }, (_, index) => `issue ${index}`),
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
    ).resolves.toEqual({ complete: false, issueNumbers: [] });
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
      installationToken: 'ghs_installation_secret',
      labels: [],
      repository: 'arcadeai/safeword',
      title: 'occupy capacity',
    });
    await delay(5);
    const started = performance.now();

    await expect(
      client.scanExactMarker({
        installationId: 42,
        marker: '<!-- no-match -->',
        repository: 'arcadeai/safeword',
      }),
    ).resolves.toEqual({ complete: false, issueNumbers: [] });
    expect(performance.now() - started).toBeLessThan(80);
    await expect(occupyingCreate).resolves.toBeGreaterThan(0);
  });
});
