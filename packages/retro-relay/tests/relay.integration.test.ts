import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createHarnessAdapters,
  CredentialRegistry,
  type FileRetroDraftRequest,
  GitHubAppTokenProvider,
  GitHubRestClient,
  RelayStore,
  startRelayServer,
} from '../src/index.js';

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
  return {
    requestId: 'request-1479',
    installationId: 42,
    repository: 'arcadeai/safeword',
    canonicalKey: 'canonical:abc123',
    legacySignature: 'retro:def456',
    title: 'Retry-safe retro filing',
    body: 'The filing path lost its response.',
    labels: ['retro'],
    ...overrides,
  };
}

async function startGitHubFixture(
  options: {
    createDelayMs?: number;
    createStatus?: number;
    failSecondPage?: boolean;
    failToken?: boolean;
    rawBodies?: string[];
    rawPullRequestBodies?: string[];
    sanitizedMcpBodies?: string[];
  } = {},
): Promise<{
  baseUrl: string;
  createBodies: string[];
  authorizationHeaders: string[];
  rawAcceptHeaders: string[];
  sanitizedMcpBodies: string[];
  tokenRequests: { authorization: string; body: Record<string, unknown> }[];
}> {
  const createdBodies: string[] = [];
  const authorizationHeaders: string[] = [];
  const rawAcceptHeaders: string[] = [];
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
      tokenRequests.push({
        authorization: request.headers.authorization ?? '',
        body: JSON.parse(body) as Record<string, unknown>,
      });
      response.statusCode = 201;
      response.setHeader('content-type', 'application/json');
      const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
      response.end(
        JSON.stringify({
          token: 'ghs_installation_secret',
          expires_at: expiresAt,
          permissions: { issues: 'write' },
        }),
      );
      return;
    }
    if (request.method === 'GET' && request.url?.includes('/issues')) {
      rawAcceptHeaders.push(request.headers.accept ?? '');

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
            : [
                ...rawBodies.map((body, index) => ({
                  number: 700 + index,
                  body,
                })),
                ...(options.rawPullRequestBodies ?? []).map((body, index) => ({
                  number: 800 + index,
                  body,
                  pull_request: {},
                })),
              ],
        ),
      );
      return;
    }
    if (request.method === 'POST' && request.url?.endsWith('/issues')) {
      authorizationHeaders.push(request.headers.authorization ?? '');
      let body = '';
      for await (const chunk of request) body += String(chunk);
      createdBodies.push(JSON.parse(body).body as string);
      if (options.createStatus !== undefined) {
        response.statusCode = options.createStatus;
        response.end();
        return;
      }
      if (options.createDelayMs !== undefined) {
        await delay(options.createDelayMs);
      }
      response.statusCode = 201;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ number: 900 + createdBodies.length }));
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
  };
}

async function fixture(
  options: {
    createDelayMs?: number;
    createStatus?: number;
    failSecondPage?: boolean;
    failToken?: boolean;
    rawBodies?: string[];
    rawPullRequestBodies?: string[];
    sanitizedMcpBodies?: string[];
  } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-integration-'));
  directories.push(directory);
  const githubFixture = await startGitHubFixture(options);
  const registry = new CredentialRegistry('deployment-pepper');
  const issueCredential = (
    harness: 'claude' | 'codex' | 'cursor' | 'operator',
    secretCharacter: string,
    roles: ('file' | 'reconcile')[] = ['file'],
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
    operator: issueCredential('operator', 'd', ['file', 'reconcile']),
  };
  const credential = credentials.claude;
  const store = RelayStore.open(path.join(directory, 'relay.sqlite'));
  const tokenProvider = new GitHubAppTokenProvider({
    appId: '1234',
    baseUrl: githubFixture.baseUrl,
    privateKey: githubAppPrivateKeyPem,
  });
  const relay = await startRelayServer({
    credentials: registry,
    github: new GitHubRestClient({
      baseUrl: githubFixture.baseUrl,
      installationToken: (installationId, repo) => tokenProvider.token(installationId, repo),
    }),
    lockPath: path.join(directory, 'relay.lock'),
    payloadKey: Buffer.alloc(32, 7),
    store,
  });
  servers.push(relay.server);
  return { ...githubFixture, credential, credentials, directory, registry, relay, store };
}

describe('retry-safe retro relay', () => {
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

  it('converges different requestIds that reserve the same semantic evidence', async () => {
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

    const retryAfterSleeps: number[] = [];
    const adapterOptions = {
      sleep: async (milliseconds: number) => {
        retryAfterSleeps.push(milliseconds);
        await new Promise<void>(resolve => setImmediate(resolve));
      },
    };
    const [first, second] = await Promise.all([
      createHarnessAdapters(setup.relay.url, setup.credentials, adapterOptions).claude.file(
        draft({ requestId: 'semantic-owner-a' }),
      ),
      createHarnessAdapters(secondRelay.url, setup.credentials, adapterOptions).codex.file(
        draft({ requestId: 'semantic-owner-b' }),
      ),
    ]);

    expect(first.issueNumber).toBe(second.issueNumber);
    expect(first.requestId).toBe('semantic-owner-a');
    expect(second.requestId).toBe('semantic-owner-b');
    expect(first.receiptId).not.toBe(second.receiptId);
    const scope = {
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
    };
    expect(setup.store.load({ ...scope, requestId: 'semantic-owner-a' })?.state).toBe('filed');
    expect(setup.store.load({ ...scope, requestId: 'semantic-owner-b' })?.state).toBe('filed');
    expect(retryAfterSleeps).toContain(1000);
    expect(setup.createBodies).toHaveLength(1);
    secondStore.close();
  });

  it('quarantines an alias when its semantic evidence owner is ambiguous', async () => {
    const setup = await fixture({ createStatus: 500 });
    const adapters = createHarnessAdapters(setup.relay.url, setup.credentials, {
      sleep: () => Promise.resolve(),
    });

    await expect(
      adapters.claude.file(draft({ requestId: 'ambiguous-owner' })),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      adapters.codex.file(draft({ requestId: 'ambiguous-alias' })),
    ).rejects.toMatchObject({
      status: 503,
      details: {
        latestReceipt: {
          requestId: 'ambiguous-alias',
          state: 'ambiguous',
        },
      },
    });

    expect(setup.createBodies).toHaveLength(1);
    expect(
      setup.store.load({
        tenantId: 'tenant-1',
        installationId: 42,
        repository: 'arcadeai/safeword',
        requestId: 'ambiguous-alias',
      }),
    ).toMatchObject({ state: 'ambiguous' });
  });

  it('restores alias quarantine after restart recovery', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'retro-relay-restart-alias-'));
    directories.push(directory);
    const databasePath = path.join(directory, 'relay.sqlite');
    const store = RelayStore.open(databasePath);
    const baseScope = {
      tenantId: 'tenant-1',
      installationId: 42,
      repository: 'arcadeai/safeword',
    };
    const envelope = {
      nonce: Buffer.alloc(12),
      ciphertext: Buffer.from('durable payload'),
      tag: Buffer.alloc(16),
    };
    const ownerScope = { ...baseScope, requestId: 'restart-owner' };
    const aliasScope = { ...baseScope, requestId: 'restart-alias' };
    for (const scope of [ownerScope, aliasScope]) {
      store.accept({
        scope,
        payloadHash: `hash-${scope.requestId}`,
        envelope,
        requestMarker: `marker-${scope.requestId}`,
      });
      expect(store.claim(scope)).toBe(true);
    }
    const evidence = [
      { kind: 'canonical' as const, value: 'canonical:restart' },
      { kind: 'legacy' as const, value: 'retro:restart' },
    ];
    const owner = store.reserveEvidence(ownerScope, evidence);
    expect(store.beginDispatch(ownerScope)).toBe(true);
    expect(store.reserveEvidence(aliasScope, evidence).scope.requestId).toBe('restart-owner');
    store.linkAlias(aliasScope, owner);
    store.close();

    const reopened = RelayStore.open(databasePath);
    reopened.recoverInFlight();
    expect(reopened.receipt(aliasScope)).toMatchObject({
      requestId: 'restart-alias',
      state: 'ambiguous',
    });
    expect(reopened.load(aliasScope)).toMatchObject({ state: 'ambiguous' });
    reopened.close();
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

    const receipt = await createHarnessAdapters(relay.url, setup.credentials).operator.reconcile(
      draft(),
    );
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
        createHarnessAdapters(relay.url, setup.credentials).operator.reconcile(draft()),
      ).rejects.toMatchObject({ status: 503 });
      const durable = reopened.load({
        tenantId: 'tenant-1',
        installationId: 42,
        repository: 'arcadeai/safeword',
        requestId: draft().requestId,
      });
      expect(reopened.reconciliationAudit(durable?.receiptId ?? '')).toEqual([
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

  it('uses raw REST bodies as marker authority and has no MCP decision input', async () => {
    const canonicalMarker = '<!-- safeword-retro-canonical: canonical:abc123 -->';
    const existing = await fixture({ rawBodies: [canonicalMarker] });
    const adopted = await createHarnessAdapters(
      existing.relay.url,
      existing.credential,
    ).claude.file(draft());
    expect(adopted.issueNumber).toBe(700);
    expect(existing.createBodies).toHaveLength(0);
    expect(existing.rawAcceptHeaders).toContain('application/vnd.github.raw+json');

    const absent = await fixture({
      rawBodies: ['raw body has no marker'],
      sanitizedMcpBodies: [canonicalMarker],
    });
    const created = await createHarnessAdapters(absent.relay.url, absent.credential).codex.file(
      draft({ requestId: 'raw-absent' }),
    );
    expect(created.issueNumber).toBe(901);
    expect(created.issueNumber).not.toBe(700);
    expect(absent.sanitizedMcpBodies).toContain(canonicalMarker);
    expect(absent.createBodies).toHaveLength(1);
  });

  it('adopts an exact legacy raw marker and ignores matching pull requests', async () => {
    const legacy = '<!-- safeword-retro-signature: retro:def456 -->';
    const existing = await fixture({ rawBodies: [legacy] });
    await expect(
      createHarnessAdapters(existing.relay.url, existing.credential).claude.file(draft()),
    ).resolves.toMatchObject({ issueNumber: 700, state: 'filed' });
    expect(existing.createBodies).toHaveLength(0);

    const pullRequestOnly = await fixture({ rawPullRequestBodies: [legacy] });
    await expect(
      createHarnessAdapters(pullRequestOnly.relay.url, pullRequestOnly.credential).claude.file(
        draft({ requestId: 'pull-request-marker' }),
      ),
    ).resolves.toMatchObject({ issueNumber: 901, state: 'filed' });
    expect(pullRequestOnly.createBodies).toHaveLength(1);
  });

  it('quarantines conflicting canonical and legacy raw matches', async () => {
    const setup = await fixture({
      rawBodies: [
        '<!-- safeword-retro-canonical: canonical:abc123 -->',
        '<!-- safeword-retro-signature: retro:def456 -->',
      ],
    });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 409 });
    expect(setup.createBodies).toHaveLength(0);
  });

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
      createHarnessAdapters(ambiguous.relay.url, ambiguous.credential).operator.reconcile(draft()),
    ).rejects.toMatchObject({ status: 403 });
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
    expect(observable).toContain('request-1479');
    expect(observable).toContain('filed');
    expect(observable).not.toContain(setup.credential);
    expect(observable).not.toContain('ghs_installation_secret');

    const databaseText = readFileSync(path.join(setup.directory, 'relay.sqlite')).toString('utf8');
    expect(databaseText).not.toContain(setup.credential);
    expect(databaseText).not.toContain('ghs_installation_secret');
    expect(databaseText).not.toContain(draft().body);
  });

  it('fails closed when raw REST marker enumeration is non-unique', async () => {
    const marker = '<!-- safeword-retro-canonical: canonical:abc123 -->';
    const setup = await fixture({ rawBodies: [marker, marker] });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
    expect(setup.createBodies).toHaveLength(0);
  });

  it('fails closed when raw REST pagination is incomplete', async () => {
    const setup = await fixture({
      failSecondPage: true,
      rawBodies: Array.from({ length: 100 }, (_, index) => `issue ${index}`),
    });
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;

    await expect(adapter.file(draft())).rejects.toMatchObject({ status: 503 });
    expect(setup.createBodies).toHaveLength(0);
  });
});
