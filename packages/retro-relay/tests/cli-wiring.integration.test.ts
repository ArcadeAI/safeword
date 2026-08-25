import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertCodexPluginCatalogue } from '../../cli/src/codex-plugin/catalogue.js';
import { executeRetroCommand, type RetroOutcome } from '../../cli/src/commands/retro.js';
import { reconcile } from '../../cli/src/reconcile.js';
import { parseRetroCommandArguments } from '../../cli/src/retro/command-registration.js';
import { prepareEncounters } from '../../cli/src/retro/pipeline.js';
import {
  createRelayRequest,
  persistRelayRequest,
  relaySourceKey,
} from '../../cli/src/retro/relay-delivery.js';
import type { RelayReadinessManifest } from '../../cli/src/retro/relay-readiness.js';
import type { IssueTracker } from '../../cli/src/retro/triage.js';
import { SAFEWORD_SCHEMA } from '../../cli/src/schema.js';
import { createProjectContext } from '../../cli/src/utils/context.js';
import { VERSION } from '../../cli/src/version.js';
import { offsetStatePath } from '../../cli/templates/hooks/lib/retro-trigger.js';
import { startPublicRetroCollector } from '../../retro-collector/src/index.js';
import {
  CredentialRegistry,
  GitHubRestClient,
  RelayStore,
  startRelayServer,
} from '../src/index.js';

const directories: string[] = [];
const servers: ReturnType<typeof createServer>[] = [];
type RelayHarness = 'claude' | 'codex' | 'cursor';
type InstalledSurface = {
  harness: string;
  kind: RelayHarness;
};
const artifactHash = 'a'.repeat(64);
const evidenceCommit = '1'.repeat(40);
const buildCommit = '2'.repeat(40);

const readinessManifest: RelayReadinessManifest = {
  enabled: true,
  evidenceCommit,
  measurements: {
    drainThroughput: {
      measuredAt: '2026-07-20T00:00:00.000Z',
      path: 'evidence/drain-throughput.json',
      sampleSize: 300,
      sha256: artifactHash,
    },
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

function readinessArtifactContent(artifactPath: string): string {
  const entry = Object.entries(readinessManifest.measurements).find(
    ([, artifact]) => artifact.path === artifactPath,
  );
  if (entry === undefined) throw new Error(`unknown readiness artifact: ${artifactPath}`);
  const [metric, artifact] = entry as [
    keyof RelayReadinessManifest['measurements'],
    RelayReadinessManifest['measurements'][keyof RelayReadinessManifest['measurements']],
  ];
  return JSON.stringify({
    measuredAt: artifact.measuredAt,
    metric,
    repository: 'ArcadeAI/safeword',
    result:
      metric === 'drainThroughput'
        ? {
            acceptedCount: 2,
            backlogSize: artifact.sampleSize,
            durationMs: 999,
            overallDeadlineMs: 750,
            relayLatencyMs: 80,
            requestDeadlineMs: 500,
          }
        : { count: 0 },
    sampleSize: artifact.sampleSize,
    version: metric === 'drainThroughput' ? 2 : 1,
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
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

function noOutput(): { error: () => void; info: () => void; success: () => void } {
  return { error: () => {}, info: () => {}, success: () => {} };
}

async function installSurfaceFixtures(project: string): Promise<{
  claudeHook: string;
  codexSkill: string;
  cursorCommand: string;
}> {
  const cli = path.resolve(import.meta.dirname, '../../cli');
  writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'relay-fixture' }));
  await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(project));

  const canonicalSkills = path.join(cli, 'templates', 'skills');
  const packagedPlugin = path.join(cli, 'codex-plugin');
  assertCodexPluginCatalogue(canonicalSkills, packagedPlugin, VERSION);
  const installedPlugin = path.join(project, '.codex', 'plugins', 'safeword');
  cpSync(packagedPlugin, installedPlugin, { recursive: true });

  writeFileSync(
    path.join(project, '.safeword', 'config.json'),
    JSON.stringify({ selfReport: { surface: true } }),
  );
  return {
    claudeHook: path.join(project, '.safeword', 'hooks', 'stop-retro.ts'),
    codexSkill: path.join(installedPlugin, 'skills', 'retro', 'SKILL.md'),
    cursorCommand: path.join(project, '.cursor', 'commands', 'retro.md'),
  };
}

function instructionArguments(source: string, transcript: string, findings: string): string[] {
  const command = source
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('safeword retro ') && line.includes('--findings'));
  if (command === undefined) throw new Error('installed retro instructions have no CLI command');
  const replacements = new Map([
    ['<findings.json>', findings],
    ['<path>', transcript],
  ]);
  return command
    .split(/\s+/u)
    .slice(1)
    .map(token => replacements.get(token) ?? token);
}

function cursorInstructionArguments(
  commandPath: string,
  project: string,
  transcript: string,
  findings: string,
): string[] {
  const wrapper = readFileSync(commandPath, 'utf8');
  const reference = /Read and follow the instructions in (?<path>\S+)/u.exec(wrapper)?.groups?.path;
  if (reference === undefined) throw new Error('installed Cursor command has no skill reference');
  return instructionArguments(
    readFileSync(path.join(project, reference), 'utf8'),
    transcript,
    findings,
  );
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
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- CI exposes Bun on PATH without requiring BUN_INSTALL.
  const result = spawnSync('bun', [hook], {
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
  expect(result.error, String(result.error)).toBeUndefined();
  expect(result.status, result.stderr || '<no stderr>').toBe(0);
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

const installedSurfaces: InstalledSurface[] = [
  { harness: 'Claude Code', kind: 'claude' },
  { harness: 'Claude Code Cloud', kind: 'claude' },
  { harness: 'OpenAI Codex', kind: 'codex' },
  { harness: 'OpenAI Codex Cloud', kind: 'codex' },
  { harness: 'Cursor', kind: 'cursor' },
  { harness: 'Cursor Cloud Agents', kind: 'cursor' },
];

const relayFinding = {
  category: 'rough-edge',
  repro: 'run safeword retro after a lost response',
  safeword_surface: 'hooks/stop-quality.ts',
  title: 'Relay response can be lost',
  what_happened: 'The response was lost after durable acceptance.',
  why_friction: 'The next harness could open a duplicate.',
};

type RelayScenario = Awaited<ReturnType<typeof createRelayScenario>>;

async function createRelayScenario(): Promise<{
  credentials: Record<RelayHarness, string>;
  durableOutbox: string;
  githubBodies: string[];
  relay: Awaited<ReturnType<typeof startRelayServer>>;
  secureRelayFetch: typeof fetch;
  store: RelayStore;
}> {
  const relayDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-cli-relay-server-'));
  const durableOutbox = mkdtempSync(path.join(tmpdir(), 'safeword-cli-relay-outbox-'));
  directories.push(relayDirectory, durableOutbox);
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
  const store = RelayStore.open(path.join(relayDirectory, 'relay.sqlite'));
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
  const nativeFetch = globalThis.fetch;
  const secureRelayFetch: typeof fetch = (input, init) => {
    let requested: URL;
    if (typeof input === 'string') requested = new URL(input);
    else if (input instanceof URL) requested = input;
    else requested = new URL(input.url);
    expect(requested.origin).toBe('https://relay.test');
    return nativeFetch(new URL(`${requested.pathname}${requested.search}`, relay.url), init);
  };

  const report = await prepareEncounters([relayFinding]);
  const encounter = report.encounters[0];
  const relayDraft = {
    body: encounter.draft.body,
    canonicalKey: encounter.draft.canonicalSignature,
    installationId: 42,
    labels: encounter.draft.labels,
    legacySignature: encounter.draft.signature,
    repository: 'arcadeai/safeword',
    title: encounter.draft.title,
  };
  const sharedRequest = createRelayRequest(
    { ...relayDraft, sourceKey: relaySourceKey('session-1479', 0, relayDraft) },
    {
      now: Date.now,
      randomUUID: () => '00000000-0000-4000-8000-000000001479',
    },
  );
  await persistRelayRequest(durableOutbox, sharedRequest);
  return {
    credentials,
    durableOutbox,
    githubBodies: github.createdBodies,
    relay,
    secureRelayFetch,
    store,
  };
}

function installedSurfaceArguments(
  surface: InstalledSurface,
  project: string,
  installed: Awaited<ReturnType<typeof installSurfaceFixtures>>,
  transcript: string,
  findings: string,
): string[] {
  if (surface.kind === 'claude') {
    return captureClaudeHookArguments(
      project,
      installed.claudeHook,
      transcript,
      `${surface.harness}-${process.pid}`,
    );
  }
  if (surface.kind === 'codex') {
    return instructionArguments(readFileSync(installed.codexSkill, 'utf8'), transcript, findings);
  }
  return cursorInstructionArguments(installed.cursorCommand, project, transcript, findings);
}

async function runInstalledSurface(
  scenario: RelayScenario,
  surface: InstalledSurface,
  relayFetch: typeof fetch,
): Promise<{ outcome: RetroOutcome; project: string }> {
  const project = mkdtempSync(path.join(tmpdir(), `safeword-${surface.kind}-runtime-`));
  directories.push(project);
  const installed = await installSurfaceFixtures(project);
  const transcript = substantialTranscript(project);
  const findings = path.join(project, 'findings.json');
  writeFileSync(findings, JSON.stringify([relayFinding]));
  const arguments_ = installedSurfaceArguments(surface, project, installed, transcript, findings);
  let outcome: RetroOutcome | undefined;
  await parseRetroCommandArguments(arguments_, async options => {
    outcome = await executeRetroCommand(options, {
      environment: {
        SAFEWORD_RETRO_RELAY_CREDENTIAL: scenario.credentials[surface.kind],
        SAFEWORD_RETRO_RELAY_INSTALLATION_ID: '42',
        SAFEWORD_RETRO_RELAY_OUTBOX: scenario.durableOutbox,
        SAFEWORD_RETRO_RELAY_REPOSITORY: 'arcadeai/safeword',
        SAFEWORD_RETRO_RELAY_URL: 'https://relay.test',
      },
      extract: () => Promise.resolve([relayFinding]),
      extractionSucceeded: () => true,
      harness: surface.harness,
      output: noOutput(),
      projectDirectory: project,
      relay: {
        buildCommit,
        fetch: relayFetch,
        isAncestor: () => Promise.resolve(true),
        manifest: readinessManifest,
        now: new Date('2026-07-26T00:00:00.000Z'),
        readArtifactAtCommit: (_commit, artifactPath) =>
          Promise.resolve({
            content: readinessArtifactContent(artifactPath),
            sha256: artifactHash,
          }),
      },
      sessionId: 'session-1479',
      restTransportAvailable: false,
      transport: forbiddenNativeTransport(),
    });
  });
  if (outcome === undefined) throw new Error('retro CLI action did not execute');
  return { outcome, project };
}

function discardProject(project: string): void {
  rmSync(project, { force: true, recursive: true });
  const index = directories.indexOf(project);
  if (index !== -1) directories.splice(index, 1);
}

function lostReceiptFetch(scenario: RelayScenario): typeof fetch {
  return async (input, init) => {
    const response = await scenario.secureRelayFetch(input, init);
    await response.arrayBuffer();
    throw new Error('simulated lost receipt response');
  };
}

const retryableRelayOutcome = {
  accepted: 0,
  deadLetterBacklog: 0,
  deadLetteredThisRun: 0,
  retryable: 1,
  spoolFailed: 0,
};

const acceptedRelayOutcome = {
  accepted: 1,
  deadLetterBacklog: 0,
  deadLetteredThisRun: 0,
  retryable: 0,
  spoolFailed: 0,
};

describe('real shared CLI to relay wiring', () => {
  it('keeps public quarantine separate from authorized private filing', async () => {
    const collectorDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-collector-'));
    directories.push(collectorDirectory);
    const collector = await startPublicRetroCollector({
      databasePath: path.join(collectorDirectory, 'collector.sqlite'),
    });
    const scenario = await createRelayScenario();
    try {
      const publicBody = JSON.stringify({
        version: 'v1',
        finding: 'public fixture finding',
        source: {
          harness: 'codex',
          hostClass: 'local',
          projectUUID: '018f0f2e-abcd-7def-8abc-def012345678',
          safewordCliVersion: '0.79.0',
        },
        sessionScope: '6'.repeat(64),
      });
      const publicResponse = await fetch(`${collector.url}/v1/public-retros`, {
        body: publicBody,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-request-id': '01933333-2222-7333-8444-55555555555a',
        },
        method: 'POST',
      });
      const privateRun = await runInstalledSurface(
        scenario,
        installedSurfaces[2],
        scenario.secureRelayFetch,
      );

      expect(publicResponse.status).toBe(201);
      expect(privateRun.outcome.relay).toEqual(acceptedRelayOutcome);
      expect(scenario.githubBodies).toHaveLength(1);
      discardProject(privateRun.project);
    } finally {
      await collector.close();
      scenario.store.close();
    }
  }, 30_000);

  it.each([
    { harness: 'Claude Code' },
    { harness: 'Claude Code Cloud' },
    { harness: 'OpenAI Codex' },
    { harness: 'OpenAI Codex Cloud' },
    { harness: 'Cursor' },
    { harness: 'Cursor Cloud Agents' },
  ])(
    '[ORR-001] routes the installed $harness surface through the persisted request',
    async ({ harness }) => {
      const surface = installedSurfaces.find(candidate => candidate.harness === harness);
      expect(surface).toBeDefined();
      if (surface === undefined) throw new Error(`Missing installed surface: ${harness}`);
      const scenario = await createRelayScenario();
      try {
        const { outcome, project } = await runInstalledSurface(
          scenario,
          surface,
          scenario.secureRelayFetch,
        );
        expect(outcome.relay).toEqual(acceptedRelayOutcome);
        expect(scenario.relay.observability.logs.map(log => log.requestId)).toContain(
          '00000000-0000-4000-8000-000000001479',
        );
        discardProject(project);
      } finally {
        scenario.store.close();
      }
    },
    30_000,
  );

  it('[ORR-001] routes all six installed surfaces through one persisted request and collaborator chain', async () => {
    let deliveryNow = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => deliveryNow);
    const scenario = await createRelayScenario();
    try {
      for (const [index, surface] of installedSurfaces.entries()) {
        if (index === installedSurfaces.length - 1) deliveryNow += 61_000;
        const { outcome, project } = await runInstalledSurface(
          scenario,
          surface,
          index === installedSurfaces.length - 1
            ? scenario.secureRelayFetch
            : lostReceiptFetch(scenario),
        );
        expect(outcome.relay, surface.harness).toEqual(
          index === installedSurfaces.length - 1 ? acceptedRelayOutcome : retryableRelayOutcome,
        );
        discardProject(project);
      }

      const requestIds = scenario.relay.observability.logs.map(log => log.requestId);
      expect(requestIds).toHaveLength(2);
      expect(new Set(requestIds)).toEqual(new Set(['00000000-0000-4000-8000-000000001479']));
      expect(scenario.githubBodies).toHaveLength(1);
      expect(JSON.stringify(scenario.relay.observability)).not.toContain('ghs_installation_secret');
    } finally {
      scenario.store.close();
    }
  }, 30_000);

  it('[ORR-009] keeps the same persisted draft retryable after a durable receipt response is lost', async () => {
    let deliveryNow = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => deliveryNow);
    const scenario = await createRelayScenario();
    try {
      const first = await runInstalledSurface(
        scenario,
        installedSurfaces[0],
        lostReceiptFetch(scenario),
      );
      expect(first.outcome.relay).toEqual(retryableRelayOutcome);
      discardProject(first.project);

      deliveryNow += 61_000;
      const retry = await runInstalledSurface(
        scenario,
        installedSurfaces[0],
        scenario.secureRelayFetch,
      );
      expect(retry.outcome.relay).toEqual(acceptedRelayOutcome);
      discardProject(retry.project);

      const requestIds = scenario.relay.observability.logs.map(log => log.requestId);
      expect(requestIds).toEqual([
        '00000000-0000-4000-8000-000000001479',
        '00000000-0000-4000-8000-000000001479',
      ]);
      expect(scenario.githubBodies).toHaveLength(1);
    } finally {
      scenario.store.close();
    }
  }, 30_000);

  it('[ORR-036] keeps one external durable outbox across disposable harness workspaces', async () => {
    let deliveryNow = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => deliveryNow);
    const scenario = await createRelayScenario();
    try {
      const claudeRun = await runInstalledSurface(
        scenario,
        installedSurfaces[0],
        lostReceiptFetch(scenario),
      );
      expect(claudeRun.project).not.toContain(scenario.durableOutbox);
      expect(claudeRun.outcome.relay).toEqual(retryableRelayOutcome);
      discardProject(claudeRun.project);

      deliveryNow += 61_000;
      const codexRun = await runInstalledSurface(
        scenario,
        installedSurfaces[2],
        scenario.secureRelayFetch,
      );
      expect(codexRun.project).not.toBe(claudeRun.project);
      expect(codexRun.project).not.toContain(scenario.durableOutbox);
      expect(codexRun.outcome.relay).toEqual(acceptedRelayOutcome);
      discardProject(codexRun.project);

      expect(new Set(scenario.relay.observability.logs.map(log => log.requestId))).toEqual(
        new Set(['00000000-0000-4000-8000-000000001479']),
      );
      expect(scenario.githubBodies).toHaveLength(1);
    } finally {
      scenario.store.close();
    }
  }, 30_000);

  it('[ORR-010] keeps the real CLI composition on native filing with the checked-in disabled manifest', async () => {
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
