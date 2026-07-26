import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createHarnessAdapters,
  CredentialRegistry,
  type FileRetroDraftRequest,
  GitHubRestClient,
  RelayStore,
  startRelayServer,
} from '../src/index.js';

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
    rawBodies?: string[];
  } = {},
): Promise<{ baseUrl: string; createBodies: string[] }> {
  const createdBodies: string[] = [];
  const rawBodies = options.rawBodies ?? [];
  const handleRequest = async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method === 'GET' && request.url?.includes('/issues')) {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify(
          rawBodies.map((body, index) => ({
            number: 700 + index,
            body,
          })),
        ),
      );
      return;
    }
    if (request.method === 'POST' && request.url?.endsWith('/issues')) {
      let body = '';
      for await (const chunk of request) body += String(chunk);
      createdBodies.push(JSON.parse(body).body as string);
      if (options.createDelayMs !== undefined) {
        await new Promise<void>(resolve => setImmediate(resolve));
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
  return { baseUrl: `http://127.0.0.1:${address.port}`, createBodies: createdBodies };
}

async function fixture(options: { createDelayMs?: number; rawBodies?: string[] } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-integration-'));
  directories.push(directory);
  const githubFixture = await startGitHubFixture(options);
  const registry = new CredentialRegistry('deployment-pepper');
  const credential = registry.issue({
    credentialId: 'harness-1',
    harness: 'claude',
    installationId: 42,
    repository: 'arcadeai/safeword',
    roles: ['file', 'reconcile'],
    secret: 'a'.repeat(64),
    subject: 'integration',
    tenantId: 'tenant-1',
  });
  const store = RelayStore.open(path.join(directory, 'relay.sqlite'));
  const relay = await startRelayServer({
    credentials: registry,
    github: new GitHubRestClient({
      baseUrl: githubFixture.baseUrl,
      installationToken: () => Promise.resolve('ghs_installation_secret'),
    }),
    payloadKey: Buffer.alloc(32, 7),
    store,
  });
  servers.push(relay.server);
  return { ...githubFixture, credential, directory, registry, relay, store };
}

describe('retry-safe retro relay', () => {
  it('uses one request identity across Claude, Codex, and Cursor', async () => {
    const setup = await fixture();
    const adapters = createHarnessAdapters(setup.relay.url, setup.credential);

    const receipts = await Promise.all([
      adapters.claude.file(draft()),
      adapters.codex.file(draft()),
      adapters.cursor.file(draft()),
    ]);

    expect(receipts.map(receipt => receipt.issueNumber)).toEqual([901, 901, 901]);
    expect(setup.createBodies).toHaveLength(1);
  });

  it('rejects a changed payload under the same identity', async () => {
    const setup = await fixture();
    const adapter = createHarnessAdapters(setup.relay.url, setup.credential).claude;
    await adapter.file(draft());

    await expect(adapter.file(draft({ body: 'changed' }))).rejects.toMatchObject({
      status: 409,
    });
    expect(setup.createBodies).toHaveLength(1);
  });

  it('elects one creator across concurrent database connections', async () => {
    const setup = await fixture({ createDelayMs: 50 });
    const secondStore = RelayStore.open(path.join(setup.directory, 'relay.sqlite'));
    const secondRelay = await startRelayServer({
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
      createHarnessAdapters(setup.relay.url, setup.credential).claude.file(draft()),
      createHarnessAdapters(secondRelay.url, setup.credential).codex.file(draft()),
    ]);

    expect(first.issueNumber).toBe(second.issueNumber);
    expect(setup.createBodies).toHaveLength(1);
    secondStore.close();
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
      credentials: setup.registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store: reopened,
    });
    servers.push(relay.server);

    const receipt = await createHarnessAdapters(relay.url, setup.credential).operator.reconcile(
      draft(),
    );
    expect(receipt).toMatchObject({ issueNumber: 700, state: 'filed' });
    expect(github.createBodies).toHaveLength(0);
    reopened.close();
  });

  it('uses raw REST bodies as marker authority and has no MCP decision input', async () => {
    const canonicalMarker = '<!-- safeword-retro-canonical: canonical:abc123 -->';
    const existing = await fixture({ rawBodies: [canonicalMarker] });
    const adopted = await createHarnessAdapters(
      existing.relay.url,
      existing.credential,
    ).claude.file(draft());
    expect(adopted.issueNumber).toBe(700);
    expect(existing.createBodies).toHaveLength(0);

    const absent = await fixture({ rawBodies: ['sanitized representation has no raw marker'] });
    const created = await createHarnessAdapters(absent.relay.url, absent.credential).codex.file(
      draft({ requestId: 'raw-absent' }),
    );
    expect(created.issueNumber).toBe(901);
    expect(absent.createBodies).toHaveLength(1);
  });

  it('rejects missing, malformed, and repository-unauthorized credentials before GitHub', async () => {
    const setup = await fixture();
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

    for (const credential of ['', 'malformed', unauthorized]) {
      await expect(
        createHarnessAdapters(setup.relay.url, credential).cursor.file(draft()),
      ).rejects.toMatchObject({ status: credential === unauthorized ? 403 : 401 });
    }
    expect(setup.createBodies).toHaveLength(0);
  });
});
