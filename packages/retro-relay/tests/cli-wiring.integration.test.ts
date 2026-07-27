import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { executeRetroCommand, type RetroOutcome } from '../../cli/src/commands/retro.js';
import { parseRetroCommandArguments } from '../../cli/src/retro/command-registration.js';
import type { RelayReadinessManifest } from '../../cli/src/retro/relay-readiness.js';
import type { IssueTracker } from '../../cli/src/retro/triage.js';
import { offsetStatePath } from '../../cli/templates/hooks/lib/retro-trigger.js';
import {
  CredentialRegistry,
  GitHubRestClient,
  RelayStore,
  startRelayServer,
} from '../src/index.js';

const directories: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];
type RelayHarness = 'claude' | 'codex' | 'cursor';
const artifactHash = 'a'.repeat(64);
const evidenceCommit = '1'.repeat(40);
const buildCommit = '2'.repeat(40);

const readinessManifest: RelayReadinessManifest = {
  enabled: true,
  evidenceCommit,
  measurements: {
    sameSignatureCollisions: {
      measuredAt: '2026-07-20T00:00:00.000Z',
      path: 'evidence/same-signature.json',
      sampleSize: 100,
      sha256: artifactHash,
    },
    spooledNeverFiled: {
      measuredAt: '2026-07-20T00:00:00.000Z',
      path: 'evidence/spooled-never-filed.json',
      sampleSize: 100,
      sha256: artifactHash,
    },
  },
  prerequisites: [
    {
      closedAt: '2026-07-10T00:00:00.000Z',
      issue: 1474,
      mergedCommit: '3'.repeat(40),
      state: 'closed',
      url: 'https://github.com/ArcadeAI/safeword/issues/1474',
    },
    {
      closedAt: '2026-07-11T00:00:00.000Z',
      issue: 1481,
      mergedCommit: '4'.repeat(40),
      state: 'closed',
      url: 'https://github.com/ArcadeAI/safeword/issues/1481',
    },
  ],
  reviewedAt: '2026-07-21T00:00:00.000Z',
  version: 1,
};

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

function noOutput(): { error: () => void; info: () => void; success: () => void } {
  return { error: () => {}, info: () => {}, success: () => {} };
}

function installSurfaceFixtures(project: string): {
  claudeHook: string;
  codexSkill: string;
  cursorCommand: string;
} {
  const cli = path.resolve(process.cwd(), '../cli');
  const installedHooks = path.join(project, '.safeword', 'hooks');
  cpSync(path.join(cli, 'templates', 'hooks'), installedHooks, { recursive: true });
  const codexSkill = path.join(project, '.agents', 'skills', 'retro', 'SKILL.md');
  const cursorCommand = path.join(project, '.cursor', 'commands', 'retro.md');
  mkdirSync(path.dirname(codexSkill), { recursive: true });
  mkdirSync(path.dirname(cursorCommand), { recursive: true });
  cpSync(path.join(cli, 'codex-plugin', 'skills', 'retro', 'SKILL.md'), codexSkill);
  cpSync(path.join(cli, 'templates', 'commands', 'retro.md'), cursorCommand);
  writeFileSync(
    path.join(project, '.safeword', 'config.json'),
    JSON.stringify({ selfReport: { surface: true } }),
  );
  return {
    claudeHook: path.join(installedHooks, 'stop-retro.ts'),
    codexSkill,
    cursorCommand,
  };
}

function substantialTranscript(project: string): string {
  const transcript = path.join(project, 'transcript.jsonl');
  const lines = Array.from({ length: 8 }, (_, index) =>
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: `tool-${index}`, name: 'Read', input: {} }],
      },
    }),
  );
  writeFileSync(transcript, lines.join('\n'));
  return transcript;
}

function captureClaudeHookArguments(
  project: string,
  hook: string,
  transcript: string,
  sessionId: string,
): string[] {
  const capture = path.join(project, `${sessionId}.json`);
  const executable = path.join(project, 'capture-retro-args.mjs');
  writeFileSync(
    executable,
    `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs';\nwriteFileSync(process.env.SAFEWORD_CAPTURE_PATH, JSON.stringify(process.argv.slice(2)));\n`,
    { mode: 0o755 },
  );
  const bunExecutable = path.join(process.env.BUN_INSTALL ?? '/missing-bun-install', 'bin', 'bun');
  const result = spawnSync(bunExecutable, [hook], {
    cwd: project,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_CAPTURE_PATH: capture,
      SAFEWORD_RETRO_EXTRACT_CMD: executable,
    },
    input: JSON.stringify({ session_id: sessionId, transcript_path: transcript }),
  });
  expect(result.status, result.stderr).toBe(0);
  const arguments_ = JSON.parse(readFileSync(capture, 'utf8')) as string[];
  rmSync(offsetStatePath(sessionId), { force: true });
  return arguments_;
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
    const installed = installSurfaceFixtures(project);
    const transcript = substantialTranscript(project);
    const findings = path.join(project, 'findings.json');
    const finding = {
      category: 'rough-edge',
      repro: 'run safeword retro after a lost response',
      safeword_surface: 'hooks/stop-quality.ts',
      title: 'Relay response can be lost',
      what_happened: 'The response was lost after durable acceptance.',
      why_friction: 'The next harness could open a duplicate.',
    };
    writeFileSync(findings, JSON.stringify([finding]));
    const run = async (
      arguments_: string[],
      harnessName: string,
      credential: string,
      relayFetch?: typeof fetch,
    ): Promise<RetroOutcome> => {
      let outcome: RetroOutcome | undefined;
      await parseRetroCommandArguments(arguments_, async options => {
        outcome = await executeRetroCommand(options, {
          environment: {},
          extract: () => Promise.resolve([finding]),
          extractionSucceeded: () => true,
          harness: harnessName,
          output: noOutput(),
          projectDirectory: project,
          relay: {
            buildCommit,
            configuration: () => ({
              credential,
              ...(relayFetch !== undefined && { fetch: relayFetch }),
              installationId: 42,
              relayUrl: relay.url,
              repository: 'arcadeai/safeword',
            }),
            isAncestor: () => Promise.resolve(true),
            manifest: readinessManifest,
            now: new Date('2026-07-26T00:00:00.000Z'),
            readArtifactAtCommit: () => Promise.resolve({ sha256: artifactHash }),
          },
          sessionId: 'session-1479',
          restTransportAvailable: false,
          transport: forbiddenNativeTransport(),
        });
      });
      if (outcome === undefined) throw new Error('retro CLI action did not execute');
      return outcome;
    };

    const lostResponseFetch: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      await response.arrayBuffer();
      throw new Error('simulated lost receipt response');
    };
    const inContextArguments = ['retro', '--transcript', transcript, '--findings', findings];
    const surfaces = [
      {
        arguments: captureClaudeHookArguments(
          project,
          installed.claudeHook,
          transcript,
          `claude-local-${process.pid}`,
        ),
        harness: 'Claude Code',
        source: installed.claudeHook,
      },
      {
        arguments: captureClaudeHookArguments(
          project,
          installed.claudeHook,
          transcript,
          `claude-cloud-${process.pid}`,
        ),
        harness: 'Claude Code Cloud',
        source: installed.claudeHook,
      },
      {
        arguments: inContextArguments,
        harness: 'OpenAI Codex',
        source: installed.codexSkill,
      },
      {
        arguments: inContextArguments,
        harness: 'OpenAI Codex Cloud',
        source: installed.codexSkill,
      },
      { arguments: inContextArguments, harness: 'Cursor', source: installed.cursorCommand },
      {
        arguments: inContextArguments,
        harness: 'Cursor Cloud Agents',
        source: installed.cursorCommand,
      },
    ];
    for (const [index, surface] of surfaces.entries()) {
      const source = readFileSync(path.resolve(process.cwd(), surface.source), 'utf8');
      expect(source).toContain('safeword retro');
      const harness = relayHarness(surface.harness);
      const outcome = await run(
        surface.arguments,
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

  it('keeps the real CLI composition on native filing with the checked-in disabled manifest', async () => {
    const project = mkdtempSync(path.join(tmpdir(), 'safeword-cli-relay-disabled-'));
    directories.push(project);
    const transcript = substantialTranscript(project);
    const finding = {
      category: 'rough-edge',
      repro: 'run the checked-in disabled relay route',
      safeword_surface: 'hooks/stop-retro.ts',
      title: 'Relay stays disabled',
      what_happened: 'The checked-in manifest was disabled.',
      why_friction: 'A hostile environment must not bypass readiness.',
    };
    let relayConfigReads = 0;
    let nativeCreates = 0;
    const nativeTransport: IssueTracker = {
      createComment: () => Promise.resolve({ body: 'created', id: 1 }),
      createIssue: () => {
        nativeCreates += 1;
        return Promise.resolve({ number: 1479, title: 'Relay stays disabled' });
      },
      listComments: () => Promise.resolve([]),
      searchByCanonical: () => Promise.resolve([]),
      searchBySignature: () => Promise.resolve([]),
      updateComment: () => Promise.resolve(),
    };

    await parseRetroCommandArguments(
      ['retro', '--transcript', transcript, '--findings', path.join(project, 'findings.json')],
      async options => {
        await executeRetroCommand(options, {
          environment: {
            SAFEWORD_RETRO_RELAY_CREDENTIAL: 'hostile',
            SAFEWORD_RETRO_RELAY_INSTALLATION_ID: '42',
            SAFEWORD_RETRO_RELAY_REPOSITORY: 'arcadeai/safeword',
            SAFEWORD_RETRO_RELAY_URL: 'https://hostile.invalid',
          },
          extract: () => Promise.resolve([finding]),
          extractionSucceeded: () => true,
          harness: 'Claude Code',
          output: noOutput(),
          projectDirectory: project,
          relay: {
            configuration: () => {
              relayConfigReads += 1;
              throw new Error('disabled readiness must not read relay configuration');
            },
          },
          restTransportAvailable: true,
          sessionId: 'disabled-session',
          transport: nativeTransport,
        });
      },
    );

    expect(relayConfigReads).toBe(0);
    expect(nativeCreates).toBe(1);
  });
});
