import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runRetro } from '../../cli/src/commands/retro.js';
import type { IssueTracker } from '../../cli/src/retro/triage.js';
import {
  CredentialRegistry,
  GitHubRestClient,
  RelayStore,
  startRelayServer,
} from '../src/index.js';

const directories: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];

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
    rmSync(directory, { recursive: true, force: true });
  }
});

function relayHarness(harness: string): 'claude' | 'codex' | 'cursor' {
  if (harness.includes('Codex')) return 'codex';
  if (harness.includes('Cursor')) return 'cursor';
  return 'claude';
}

const forbiddenNativeTransport = (): IssueTracker => {
  const fail = () => Promise.reject(new Error('native fallback must not run'));
  return {
    createComment: fail,
    createIssue: fail,
    listComments: fail,
    searchByCanonical: fail,
    searchBySignature: fail,
    updateComment: fail,
  };
};

async function githubFixture(): Promise<{
  baseUrl: string;
  createdBodies: string[];
}> {
  const createdBodies: string[] = [];
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void (async () => {
      if (request.method === 'GET' && request.url?.includes('/issues')) {
        response.setHeader('content-type', 'application/json');
        response.end('[]');
        return;
      }
      if (request.method === 'POST' && request.url?.endsWith('/issues')) {
        let body = '';
        for await (const chunk of request) body += String(chunk);
        createdBodies.push((JSON.parse(body) as { body: string }).body);
        response.statusCode = 201;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ number: 1479 }));
        return;
      }
      response.statusCode = 404;
      response.end();
    })();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('missing fixture address');
  return { baseUrl: `http://127.0.0.1:${address.port}`, createdBodies };
}

describe('real shared CLI to relay wiring', () => {
  it.each([
    'Claude Code',
    'Claude Code Cloud',
    'OpenAI Codex',
    'OpenAI Codex Cloud',
    'Cursor',
    'Cursor Cloud Agents',
  ])(
    '%s uses the same persisted request identity through HTTP auth SQLite and GitHub',
    async harness => {
      const project = mkdtempSync(path.join(tmpdir(), 'safeword-cli-relay-wiring-'));
      directories.push(project);
      const github = await githubFixture();
      const registry = new CredentialRegistry('pepper');
      const credential = registry.issue({
        credentialId: `harness-${harness.toLowerCase().replaceAll(/[^a-z]+/gu, '-')}`,
        harness: relayHarness(harness),
        installationId: 42,
        repository: 'arcadeai/safeword',
        roles: ['file'],
        secret: 'a'.repeat(64),
        subject: harness,
        tenantId: 'tenant-1',
      });
      const store = RelayStore.open(path.join(project, 'relay.sqlite'));
      const relay = await startRelayServer({
        allowUnlockedForTests: true,
        credentials: registry,
        github: new GitHubRestClient({
          baseUrl: github.baseUrl,
          installationToken: () => Promise.resolve('ghs_classic.part.two'),
        }),
        payloadKey: Buffer.alloc(32, 7),
        store,
      });
      servers.push(relay.server);

      const outcome = await runRetro(
        { transcript: '/transcript.jsonl' },
        {
          extract: () =>
            Promise.resolve([
              {
                category: 'rough-edge',
                repro: 'run safeword retro after a lost response',
                safeword_surface: 'hooks/stop-quality.ts',
                title: 'Relay response can be lost',
                what_happened: 'The response was lost after durable acceptance.',
                why_friction: 'The next harness could open a duplicate.',
              },
            ]),
          harness,
          projectDirectory: project,
          readFile: () => 'transcript',
          relay: {
            credential,
            installationId: 42,
            readiness: { enabled: true },
            relayUrl: relay.url,
            repository: 'arcadeai/safeword',
          },
          sessionId: 'session-1479',
          transport: forbiddenNativeTransport(),
        },
      );

      expect(outcome.ok).toBe(true);
      expect(outcome.relay?.accepted).toBe(1);
      expect(relay.observability.logs[0]?.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
      );
      expect(github.createdBodies).toHaveLength(1);
      expect(JSON.stringify(relay.observability)).not.toContain('ghs_classic.part.two');
      store.close();
    },
  );

  it('reuses one request ID when another harness retries after the receipt response is lost', async () => {
    const project = mkdtempSync(path.join(tmpdir(), 'safeword-cli-relay-retry-'));
    directories.push(project);
    const github = await githubFixture();
    const registry = new CredentialRegistry('pepper');
    const issueCredential = (harness: 'claude' | 'codex', character: string) =>
      registry.issue({
        credentialId: `${harness}-retry`,
        harness,
        installationId: 42,
        repository: 'arcadeai/safeword',
        roles: ['file'],
        secret: character.repeat(64),
        subject: harness,
        tenantId: 'tenant-1',
      });
    const credentials = {
      claude: issueCredential('claude', 'a'),
      codex: issueCredential('codex', 'b'),
    };
    const store = RelayStore.open(path.join(project, 'relay.sqlite'));
    const relay = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: registry,
      github: new GitHubRestClient({
        baseUrl: github.baseUrl,
        installationToken: () => Promise.resolve('ghs_installation_secret'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      store,
    });
    servers.push(relay.server);
    const finding = {
      category: 'rough-edge',
      repro: 'run safeword retro after a lost response',
      safeword_surface: 'hooks/stop-quality.ts',
      title: 'Relay response can be lost',
      what_happened: 'The response was lost after durable acceptance.',
      why_friction: 'The next harness could open a duplicate.',
    };
    const run = (harness: string, credential: string, relayFetch?: typeof fetch) =>
      runRetro(
        { transcript: '/transcript.jsonl' },
        {
          extract: () => Promise.resolve([finding]),
          harness,
          projectDirectory: project,
          readFile: () => 'transcript',
          relay: {
            credential,
            ...(relayFetch !== undefined && { fetch: relayFetch }),
            installationId: 42,
            readiness: { enabled: true },
            relayUrl: relay.url,
            repository: 'arcadeai/safeword',
          },
          sessionId: 'session-1479',
          transport: forbiddenNativeTransport(),
        },
      );

    const lostResponseFetch: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      await response.arrayBuffer();
      throw new Error('simulated lost receipt response');
    };
    const first = await run('Claude Code', credentials.claude, lostResponseFetch);
    expect(first.relay).toEqual({ accepted: 0, retryable: 1 });
    const second = await run('OpenAI Codex', credentials.codex);
    expect(second.relay).toEqual({ accepted: 1, retryable: 0 });

    const requestIds = relay.observability.logs.map(log => log.requestId);
    expect(requestIds).toHaveLength(2);
    expect(new Set(requestIds).size).toBe(1);
    expect(github.createdBodies).toHaveLength(1);
    store.close();
  });
});
