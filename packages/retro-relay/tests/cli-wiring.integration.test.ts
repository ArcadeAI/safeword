import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
type RelayHarness = 'claude' | 'codex' | 'cursor';

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

function relayHarness(harness: string): RelayHarness {
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
  it('routes all six installed surfaces through one persisted request and collaborator chain', async () => {
    const project = mkdtempSync(path.join(tmpdir(), 'safeword-cli-relay-retry-'));
    directories.push(project);
    const github = await githubFixture();
    const registry = new CredentialRegistry('pepper');
    const issueCredential = (harness: RelayHarness, character: string) =>
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
      cursor: issueCredential('cursor', 'c'),
    };
    const credentialFor = (harness: RelayHarness) => {
      if (harness === 'claude') return credentials.claude;
      if (harness === 'codex') return credentials.codex;
      return credentials.cursor;
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
    const surfaces = [
      { harness: 'Claude Code', source: '../cli/templates/hooks/stop-retro.ts' },
      { harness: 'Claude Code Cloud', source: '../cli/templates/hooks/stop-retro.ts' },
      { harness: 'OpenAI Codex', source: '../cli/codex-plugin/skills/retro/SKILL.md' },
      { harness: 'OpenAI Codex Cloud', source: '../cli/codex-plugin/skills/retro/SKILL.md' },
      { harness: 'Cursor', source: '../cli/templates/commands/retro.md' },
      { harness: 'Cursor Cloud Agents', source: '../cli/templates/commands/retro.md' },
    ];
    for (const [index, surface] of surfaces.entries()) {
      const source = readFileSync(path.resolve(process.cwd(), surface.source), 'utf8');
      expect(source).toContain('safeword retro');
      const harness = relayHarness(surface.harness);
      const outcome = await run(
        surface.harness,
        credentialFor(harness),
        index === surfaces.length - 1 ? undefined : lostResponseFetch,
      );
      expect(outcome.relay).toEqual(
        index === surfaces.length - 1
          ? { accepted: 1, retryable: 0 }
          : { accepted: 0, retryable: 1 },
      );
    }

    const requestIds = relay.observability.logs.map(log => log.requestId);
    expect(requestIds).toHaveLength(6);
    expect(new Set(requestIds).size).toBe(1);
    expect(requestIds[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(github.createdBodies).toHaveLength(1);
    expect(JSON.stringify(relay.observability)).not.toContain('ghs_installation_secret');
    store.close();
  });
});
