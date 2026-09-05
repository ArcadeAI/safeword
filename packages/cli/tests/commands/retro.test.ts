import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAutoExtractor,
  buildProvenanceResolver,
  discardRelaySpoolCommand,
  executeRetroCommand,
  localRetroHostClass,
  localServerRouteEnabled,
  reportRetroCommandOutcome,
  resolvePublicRetroRoute,
  resolveRelayConfig,
  resolveRelayOutboxDirectory,
  retroCommand,
  retryRelayDeadLetterCommand,
  runRetro,
} from '../../src/commands/retro.js';
import { LEDGER_MARKER, parseLedger } from '../../src/retro/ledger.js';
import { buildPublicRetroEnvelope } from '../../src/retro/public-delivery.js';
import {
  createRelayRequest,
  listRelayDeadLetters,
  listRelayRequests,
  persistRelayDraft,
  persistRelayRequest,
  rearmRelayDeadLetter,
  type RelayDraftRequest,
} from '../../src/retro/relay-delivery.js';
import type {
  CreateIssueInput,
  IssueComment,
  IssueReference,
  IssueTracker,
} from '../../src/retro/triage.js';
import {
  cursorConversationStashPath,
  cursorProjectStashPath,
  cursorTranscriptStashPath,
  stashCursorTranscript,
} from '../../templates/hooks/lib/cursor-state.js';
import {
  ackFilePath,
  draftSpoolPath,
  readAcks,
  readServerSpooledDrafts,
  readSpooledDrafts,
  verifyDraftBody,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { DIGEST_CAP, runHeadlessExtraction } from '../../templates/hooks/lib/retro-extract.js';
import { decideRetroFilingGate } from '../../templates/hooks/lib/retro-filing-gate.js';
import { captureRetroFilingFault, readReports } from '../../templates/hooks/lib/self-report.js';
import { assertTestCliFresh, readJsonlFile } from '../helpers.js';
import { sinkWrites } from '../helpers/io-failure.js';
import { relayReadinessArtifact, validRelayReadinessManifest } from '../helpers/relay-readiness.js';

// Unit tests here isolate command behavior from GitHub. The real REST composition
// root is proven in cli-protocol/configured-wiring.test.ts.
vi.mock('../../src/retro/github-rest.js', () => ({
  createRestTransport: () => {},
  createReconcileTransport: () => {},
  resolveGitHubToken: () => {},
}));

function builtCliPath(): string {
  const path = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
  assertTestCliFresh();
  return path;
}

function activeRelayPath(projectDirectory: string, requestId: string): string {
  const directory = nodePath.join(projectDirectory, '.safeword', 'retro-drafts', 'relay');
  const filename = readdirSync(directory).find(
    candidate =>
      candidate === `${requestId}.json` || candidate === `${requestId}.materializing.json`,
  );
  if (filename === undefined) throw new Error('missing active relay file');
  return nodePath.join(directory, filename);
}

function deadLetterRelayPath(projectDirectory: string, requestId: string): string {
  return nodePath.join(
    projectDirectory,
    '.safeword',
    'retro-drafts',
    'relay',
    `${requestId}.dead-letter.json`,
  );
}

function movePersistedRequestToDeadLetter(
  projectDirectory: string,
  persisted: { path: string },
): {
  deadLetter: string;
  originalBytes: Buffer;
} {
  const originalBytes = readFileSync(persisted.path);
  const request = JSON.parse(originalBytes.toString('utf8')) as { requestId: string };
  const deadLetter = deadLetterRelayPath(projectDirectory, request.requestId);
  writeFileSync(deadLetter, originalBytes);
  rmSync(persisted.path);
  return { deadLetter, originalBytes };
}

function relayRequest(
  randomUUID: string,
  sourceKey = 'source',
  now: () => number = Date.now,
): RelayDraftRequest {
  return createRelayRequest(
    {
      body: 'body',
      canonicalKey: 'canonical',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'legacy',
      repository: 'arcadeai/safeword',
      sourceKey,
      title: 'title',
    },
    { now, randomUUID: () => randomUUID },
  );
}

// Compact in-memory transport — only the network boundary is faked.
class FakeGitHub implements IssueTracker {
  private nextIssue = 1;
  private nextComment = 1;
  readonly issues: (CreateIssueInput & { number: number })[] = [];
  readonly comments: string[] = [];
  readonly calls = { createIssue: 0 };

  searchBySignature(): Promise<IssueReference[]> {
    return Promise.resolve([]);
  }

  searchByCanonical(): Promise<IssueReference[]> {
    return Promise.resolve([]);
  }

  createIssue(input: CreateIssueInput): Promise<IssueReference> {
    this.calls.createIssue += 1;
    const issue = { number: this.nextIssue++, ...input };
    this.issues.push(issue);
    return Promise.resolve({ number: issue.number, title: issue.title });
  }

  listComments(): Promise<IssueComment[]> {
    return Promise.resolve([]);
  }

  createComment(_n: number, body: string): Promise<IssueComment> {
    this.comments.push(body);
    return Promise.resolve({ id: this.nextComment++, body });
  }

  updateComment(): Promise<void> {
    return Promise.resolve();
  }
}

const rawFinding = (over: Record<string, unknown> = {}) => ({
  category: 'rough-edge',
  title: 'Coverage gate message omits file and number',
  safeword_surface: 'hooks/stop-quality.ts',
  what_happened: 'The coverage gate blocked with no file and no number.',
  why_friction: 'I could not tell the user how to unblock.',
  repro: 'safeword check after an edit that drops coverage',
  ...over,
});

const dependencies = (over: Partial<Parameters<typeof runRetro>[1]> = {}) => ({
  extract: () => Promise.resolve([rawFinding()]),
  transport: new FakeGitHub(),
  sessionId: 'sess-a',
  harness: 'claude',
  readFile: () =>
    JSON.stringify({
      message: { role: 'user', content: [{ type: 'text', text: 'transcript content' }] },
    }),
  ...over,
});

describe('retro command configuration, extraction, egress, and relay execution', () => {
  function removeCursorBinding(sessionId: string): void {
    const state = { conversation_id: sessionId };
    rmSync(cursorConversationStashPath(state), { force: true });
    rmSync(cursorProjectStashPath(state), { force: true });
    rmSync(cursorTranscriptStashPath(state), { force: true });
  }

  function publicRouteFor(agent: 'claude' | 'codex' | 'cursor') {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
    mkdirSync(nodePath.join(project, '.safeword'));
    writeFileSync(
      nodePath.join(project, '.safeword/config.json'),
      JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    );
    const sessionId = 'session-fixture';
    const transcript = nodePath.join(project, 'transcript.jsonl');
    if (agent === 'cursor') {
      stashCursorTranscript({ conversation_id: sessionId, transcript_path: transcript }, project);
    }
    const route = resolvePublicRetroRoute({
      agent,
      enabled: true,
      environment: {
        CLAUDE_CODE_REMOTE_SESSION_ID: 'claude-cloud-fixture',
        CODEX_MODEL: 'gpt-fixture',
        CODEX_VERSION: '1.2.3',
      },
      projectDirectory: project,
      sessionId,
      transcript,
    });
    removeCursorBinding(sessionId);
    rmSync(project, { force: true, recursive: true });
    return route;
  }

  it('suppresses the Claude public route when Claude Remote evidence is present', () => {
    expect(publicRouteFor('claude')).toBeUndefined();
  });

  it('never selects the local server route for indeterminate host provenance', () => {
    expect(
      localServerRouteEnabled(
        {
          harness: 'codex',
          hostClass: 'unknown',
          projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          safewordCliVersion: '0.82.1',
        },
        true,
      ),
    ).toBe(false);
  });

  it('selects the local server route only for proven local provenance', () => {
    expect(
      localServerRouteEnabled(
        {
          harness: 'codex',
          hostClass: 'local',
          projectUUID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          safewordCliVersion: '0.82.1',
        },
        true,
      ),
    ).toBe(true);
  });

  it('resolves the server-owned route when local readiness is proven', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
    try {
      mkdirSync(nodePath.join(project, '.safeword'));
      writeFileSync(
        nodePath.join(project, '.safeword/config.json'),
        JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
      );

      expect(
        resolvePublicRetroRoute({
          agent: 'codex',
          enabled: true,
          environment: {},
          projectDirectory: project,
          serverReady: true,
          sessionId: 'session-fixture',
        }),
      ).toMatchObject({ route: 'server-v3', source: { harness: 'codex', hostClass: 'local' } });
    } finally {
      rmSync(project, { force: true, recursive: true });
    }
  });

  it('classifies Cursor managed, local, and indeterminate runtime evidence conservatively', () => {
    const missing = () => {
      const error = new Error('missing') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };

    expect(localRetroHostClass('cursor', {}, missing)).toBe('local');
    expect(localRetroHostClass('cursor', { CURSOR_AGENT_SOCKET: '' }, missing)).toBe('local');
    expect(localRetroHostClass('cursor', {}, () => ({ isSocket: () => true }))).toBe('unknown');
    expect(localRetroHostClass('cursor', { CURSOR_AGENT_SOCKET: '/custom.sock' }, missing)).toBe(
      'unknown',
    );
  });

  it.each(['codex', 'cursor'] as const)(
    'does not let Claude Remote evidence suppress the %s public route',
    agent => {
      expect(publicRouteFor(agent)?.source).toMatchObject({
        harness: agent,
        hostClass: 'unknown',
      });
    },
  );

  it('builds a bounded Cursor source when a conversation identity is available', () => {
    const source = publicRouteFor('cursor')?.source;
    expect(source).toMatchObject({ harness: 'cursor', hostClass: 'unknown' });
    expect(source).not.toHaveProperty('agentVersion');
    expect(source).not.toHaveProperty('model');
    expect(source).not.toHaveProperty('safewordPluginVersion');
  });

  it('keeps Cursor public delivery disabled without a conversation identity', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
    try {
      mkdirSync(nodePath.join(project, '.safeword'));
      writeFileSync(
        nodePath.join(project, '.safeword/config.json'),
        JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
      );

      expect(
        resolvePublicRetroRoute({
          agent: 'cursor',
          enabled: true,
          environment: {},
          projectDirectory: project,
        }),
      ).toBeUndefined();
    } finally {
      rmSync(project, { force: true, recursive: true });
    }
  });

  it('keeps Cursor public delivery disabled when the paired stash belongs to another project', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
    const otherProject = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-other-'));
    const sessionId = 'cursor-mismatched-project';
    const transcript = nodePath.join(otherProject, 'transcript.jsonl');
    try {
      mkdirSync(nodePath.join(project, '.safeword'));
      writeFileSync(
        nodePath.join(project, '.safeword/config.json'),
        JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
      );
      stashCursorTranscript(
        { conversation_id: sessionId, transcript_path: transcript },
        otherProject,
      );

      expect(
        resolvePublicRetroRoute({
          agent: 'cursor',
          enabled: true,
          environment: {},
          projectDirectory: project,
          sessionId,
          transcript,
        }),
      ).toBeUndefined();
    } finally {
      removeCursorBinding(sessionId);
      rmSync(project, { force: true, recursive: true });
      rmSync(otherProject, { force: true, recursive: true });
    }
  });

  it.each(['absent', 'malformed'] as const)(
    'keeps public delivery disabled when project identity is %s',
    identityState => {
      const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
      try {
        mkdirSync(nodePath.join(project, '.safeword'));
        writeFileSync(
          nodePath.join(project, '.safeword/config.json'),
          JSON.stringify(identityState === 'absent' ? {} : { projectUUID: 'not-a-uuid' }),
        );

        expect(
          resolvePublicRetroRoute({
            agent: 'codex',
            enabled: true,
            environment: {},
            projectDirectory: project,
            sessionId: 'session-fixture',
          }),
        ).toBeUndefined();
      } finally {
        rmSync(project, { force: true, recursive: true });
      }
    },
  );

  it('delivers required runtime context when Git discovery fails', async () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
    mkdirSync(nodePath.join(project, '.safeword'));
    writeFileSync(
      nodePath.join(project, '.safeword/config.json'),
      JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    );
    writeFileSync(nodePath.join(project, '.git'), 'invalid git pointer');
    const sessionId = 'cursor-git-discovery-failure';
    const transcript = '/tmp/t.jsonl';
    stashCursorTranscript({ conversation_id: sessionId, transcript_path: transcript }, project);
    const route = resolvePublicRetroRoute({
      agent: 'cursor',
      enabled: true,
      environment: {},
      projectDirectory: project,
      sessionId,
      transcript,
    });
    const publicTransport = vi.fn(request =>
      Promise.resolve({
        requestId: request.headers['x-safeword-request-id'],
        receipt: 'receipt-context-failure',
      }),
    );

    try {
      if (route === undefined) throw new TypeError('expected public route');
      const outcome = await runRetro(
        { transcript },
        dependencies({ publicRetro: { ...route, transport: publicTransport } }),
      );
      const body = JSON.parse(
        new TextDecoder().decode(publicTransport.mock.calls[0]?.[0].body),
      ) as { source: Record<string, unknown> };

      expect(outcome.ok).toBe(true);
      expect(publicTransport).toHaveBeenCalledOnce();
      expect(body.source).toMatchObject({
        harness: 'cursor',
        hostClass: 'unknown',
        projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });
      expect(body.source).not.toHaveProperty('repository');
      expect(body.source).not.toHaveProperty('model');
      expect(body.source).not.toHaveProperty('agentVersion');
    } finally {
      removeCursorBinding(sessionId);
      rmSync(project, { force: true, recursive: true });
    }
  });

  it('preserves documented enrichment while omitting untrusted runtime signals', async () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
    mkdirSync(nodePath.join(project, '.safeword'));
    mkdirSync(nodePath.join(project, '.git'));
    writeFileSync(
      nodePath.join(project, '.safeword/config.json'),
      JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    );
    writeFileSync(
      nodePath.join(project, '.git/config'),
      '[remote "origin"]\nurl = git@github.com:ArcadeAI/safeword.git\n',
    );
    const route = resolvePublicRetroRoute({
      agent: 'codex',
      enabled: true,
      environment: { CODEX_MODEL: 'model-fixture', CODEX_VERSION: 'agent-1.2.3' },
      projectDirectory: project,
      sessionId: 'session-fixture',
    });
    const publicTransport = vi.fn(request =>
      Promise.resolve({
        requestId: request.headers['x-safeword-request-id'],
        receipt: 'receipt-partial-context',
      }),
    );

    try {
      if (route === undefined) throw new TypeError('expected public route');
      const outcome = await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({ publicRetro: { ...route, transport: publicTransport } }),
      );
      const body = JSON.parse(
        new TextDecoder().decode(publicTransport.mock.calls[0]?.[0].body),
      ) as { source: Record<string, unknown> };

      expect(outcome.ok).toBe(true);
      expect(body.source).toMatchObject({
        repository: 'github.com/arcadeai/safeword',
      });
      expect(body.source.osFamily).toEqual(expect.any(String));
      expect(body.source).not.toHaveProperty('model');
      expect(body.source).not.toHaveProperty('agentVersion');
    } finally {
      rmSync(project, { force: true, recursive: true });
    }
  });

  it.each(['claude', 'codex'] as const)('omits undocumented %s runtime signals', agent => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
    try {
      mkdirSync(nodePath.join(project, '.safeword'));
      writeFileSync(
        nodePath.join(project, '.safeword/config.json'),
        JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
      );
      const source = resolvePublicRetroRoute({
        agent,
        enabled: true,
        environment: {
          ANTHROPIC_MODEL: 'claude-model-fixture',
          CLAUDE_CODE_VERSION: 'claude-agent-fixture',
          CODEX_MODEL: 'codex-model-fixture',
          CODEX_VERSION: 'codex-agent-fixture',
        },
        projectDirectory: project,
        sessionId: 'session-fixture',
      })?.source;

      expect(source).not.toHaveProperty('model');
      expect(source).not.toHaveProperty('agentVersion');
    } finally {
      rmSync(project, { force: true, recursive: true });
    }
  });

  it('emits the exact allowlisted profile without unrelated runtime sentinels', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-route-'));
    const sentinels = [
      'transcript-private-9f2c',
      'source-private-9f2c',
      'argv-private-9f2c',
      'host-private-9f2c',
      'secret-private-9f2c',
      'env-private-9f2c',
      'actor-private-9f2c',
    ];
    try {
      mkdirSync(nodePath.join(project, '.safeword'));
      mkdirSync(nodePath.join(project, '.git'));
      writeFileSync(
        nodePath.join(project, '.safeword/config.json'),
        JSON.stringify({ projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
      );
      writeFileSync(
        nodePath.join(project, '.git/config'),
        '[remote "origin"]\nurl = git@github.com:ArcadeAI/safeword.git\n',
      );
      const route = resolvePublicRetroRoute({
        agent: 'codex',
        enabled: true,
        environment: {
          CODEX_MODEL: 'model-fixture',
          CODEX_VERSION: 'agent-1.2.3',
          GITHUB_ACTOR: sentinels[6],
          HOSTNAME: sentinels[3],
          PRIVATE_ARGV: sentinels[2],
          PRIVATE_CREDENTIAL: sentinels[4],
          PRIVATE_ENV: sentinels[5],
          PRIVATE_SOURCE: sentinels[1],
          PRIVATE_TRANSCRIPT: sentinels[0],
        },
        projectDirectory: project,
        sessionId: 'session-fixture',
      });
      if (route === undefined) throw new TypeError('expected public route');
      const envelope = new TextDecoder().decode(
        buildPublicRetroEnvelope({
          findings: ['fixture finding'],
          sessionId: 'session-fixture',
          source: route.source,
        }).bytes,
      );
      const source = (JSON.parse(envelope) as { source: Record<string, unknown> }).source;

      expect(source).toEqual({
        harness: 'codex',
        hostClass: 'unknown',
        projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        safewordCliVersion: expect.any(String),
        repository: 'github.com/arcadeai/safeword',
        osFamily: expect.any(String),
      });
      for (const sentinel of sentinels) expect(envelope).not.toContain(sentinel);
    } finally {
      rmSync(project, { force: true, recursive: true });
    }
  });

  it('accepts only an absolute relay outbox outside the disposable project', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-outbox-project-'));
    const external = mkdtempSync(nodePath.join(tmpdir(), 'safeword-durable-outbox-'));
    const physicalInside = nodePath.join(project, 'physical-outbox');
    mkdirSync(physicalInside);
    const symlinkAlias = nodePath.join(external, 'project-outbox-alias');
    symlinkSync(physicalInside, symlinkAlias);

    try {
      expect(resolveRelayOutboxDirectory(project, external)).toBe(realpathSync(external));
      expect(
        resolveRelayOutboxDirectory(project, nodePath.join(project, 'physical-outbox')),
      ).toBeUndefined();
      expect(resolveRelayOutboxDirectory(project, symlinkAlias)).toBeUndefined();
      expect(resolveRelayOutboxDirectory(project, 'relative/outbox')).toBeUndefined();
      expect(resolveRelayOutboxDirectory(project, nodePath.parse(project).root)).toBeUndefined();
    } finally {
      rmSync(project, { recursive: true, force: true });
      rmSync(external, { recursive: true, force: true });
    }
  });

  it('normalizes equivalent absolute outbox spellings before resolving physical containment', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-normalized-outbox-project-'));
    const external = mkdtempSync(nodePath.join(tmpdir(), 'safeword-normalized-outbox-'));
    const equivalentSpellings = [
      `${external}${nodePath.sep}`,
      `${nodePath.dirname(external)}${nodePath.sep}.${nodePath.sep}${nodePath.basename(external)}`,
    ];

    try {
      for (const configured of equivalentSpellings) {
        expect(resolveRelayOutboxDirectory(project, configured)).toBe(realpathSync(external));
      }
    } finally {
      rmSync(project, { recursive: true, force: true });
      rmSync(external, { recursive: true, force: true });
    }
  });

  it('reports configured relay state that cannot select a safe outbox', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-invalid-outbox-project-'));
    try {
      expect(
        resolveRelayConfig(
          {
            SAFEWORD_RETRO_RELAY_CREDENTIAL: 'swc_test',
            SAFEWORD_RETRO_RELAY_INSTALLATION_ID: '42',
            SAFEWORD_RETRO_RELAY_OUTBOX: 'relative/outbox',
            SAFEWORD_RETRO_RELAY_REPOSITORY: 'arcadeai/safeword',
            SAFEWORD_RETRO_RELAY_URL: 'https://relay.invalid',
          },
          project,
        ),
      ).toEqual({
        error:
          'retro relay configuration is invalid; SAFEWORD_RETRO_RELAY_OUTBOX must be an existing absolute directory outside the project',
      });
    } finally {
      rmSync(project, { force: true, recursive: true });
    }
  });

  it('reports incomplete relay scalars before diagnosing an absent outbox', () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-partial-scalars-project-'));
    try {
      expect(
        resolveRelayConfig(
          {
            SAFEWORD_RETRO_RELAY_REPOSITORY: 'arcadeai/safeword',
          },
          project,
        ),
      ).toEqual({
        error:
          'retro relay configuration is incomplete or invalid; URL, credential, repository, installation ID, and external outbox are required',
      });
    } finally {
      rmSync(project, { force: true, recursive: true });
    }
  });

  it('stops before extraction or native filing when enabled relay configuration is invalid', async () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-invalid-relay-command-'));
    const manifest = validRelayReadinessManifest();
    const extract = vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([rawFinding()]));
    const transport = new FakeGitHub();
    const output = { error: vi.fn(), info: vi.fn(), success: vi.fn() };
    const previousExitCode = process.exitCode;

    try {
      const outcome = await executeRetroCommand(
        { transcript: '/tmp/session.jsonl' },
        {
          environment: {
            SAFEWORD_RETRO_RELAY_CREDENTIAL: 'swc_test',
            SAFEWORD_RETRO_RELAY_INSTALLATION_ID: '42',
            SAFEWORD_RETRO_RELAY_OUTBOX: 'relative/outbox',
            SAFEWORD_RETRO_RELAY_REPOSITORY: 'arcadeai/safeword',
            SAFEWORD_RETRO_RELAY_URL: 'https://relay.invalid',
          },
          extract,
          extractionSucceeded: () => true,
          harness: 'codex',
          output,
          projectDirectory: project,
          relay: {
            buildCommit: 'b'.repeat(40),
            isAncestor: () => Promise.resolve(true),
            manifest,
            now: new Date('2026-07-26T12:00:00.000Z'),
            readArtifactAtCommit: (_commit, artifactPath) =>
              Promise.resolve(relayReadinessArtifact(manifest, artifactPath)),
          },
          restTransportAvailable: true,
          sessionId: 'session-invalid-config',
          transport,
        },
      );

      expect(outcome).toEqual({
        errorMessage:
          'retro relay configuration is invalid; SAFEWORD_RETRO_RELAY_OUTBOX must be an existing absolute directory outside the project',
        ok: false,
      });
      expect(output.error).toHaveBeenCalledWith(outcome.errorMessage);
      expect(extract).not.toHaveBeenCalled();
      expect(transport.issues).toEqual([]);
    } finally {
      process.exitCode = previousExitCode;
      rmSync(project, { force: true, recursive: true });
    }
  });

  it('keeps the real command on native filing when the build attestation is disabled', async () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-disabled-attestation-project-'));
    const outbox = mkdtempSync(nodePath.join(tmpdir(), 'retro-disabled-attestation-outbox-'));
    const transcript = nodePath.join(project, 'transcript.jsonl');
    writeFileSync(transcript, 'transcript content');
    const send = vi.fn<typeof fetch>();
    const transport = new FakeGitHub();
    const previousExitCode = process.exitCode;

    try {
      const outcome = await executeRetroCommand(
        { transcript },
        {
          environment: {
            SAFEWORD_RETRO_RELAY_CREDENTIAL: 'swc_test',
            SAFEWORD_RETRO_RELAY_INSTALLATION_ID: '42',
            SAFEWORD_RETRO_RELAY_OUTBOX: outbox,
            SAFEWORD_RETRO_RELAY_REPOSITORY: 'arcadeai/safeword',
            SAFEWORD_RETRO_RELAY_URL: 'https://relay.invalid',
          },
          extract: () => Promise.resolve([rawFinding()]),
          extractionSucceeded: () => true,
          harness: 'codex',
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory: project,
          relay: {
            fetch: send,
            manifest: { enabled: false, version: 1 },
          },
          restTransportAvailable: true,
          sessionId: 'session-disabled-attestation',
          transport,
        },
      );

      expect(outcome.ok).toBe(true);
      expect(send).not.toHaveBeenCalled();
      expect(transport.issues).toHaveLength(1);
    } finally {
      process.exitCode = previousExitCode;
      rmSync(project, { force: true, recursive: true });
      rmSync(outbox, { force: true, recursive: true });
    }
  });

  it('[ORR-011] Complete fresh readiness proof selects the relay path', async () => {
    const project = mkdtempSync(nodePath.join(tmpdir(), 'retro-ready-attestation-project-'));
    const outbox = mkdtempSync(nodePath.join(tmpdir(), 'retro-ready-attestation-outbox-'));
    const transcript = nodePath.join(project, 'transcript.jsonl');
    writeFileSync(transcript, 'transcript content');
    const manifest = validRelayReadinessManifest();
    let sentPersistedBytes = false;
    const send = vi.fn<typeof fetch>((_input, init) => {
      const body = Buffer.from(init?.body as Uint8Array);
      const submitted = JSON.parse(body.toString('utf8')) as RelayDraftRequest;
      const relayDirectory = nodePath.join(outbox, '.safeword', 'retro-drafts', 'relay');
      const claim = readdirSync(relayDirectory).find(candidate =>
        candidate.startsWith(`${submitted.requestId}.claim.`),
      );
      if (claim === undefined) throw new Error('missing durable relay claim');
      const durable = JSON.parse(
        readFileSync(nodePath.join(relayDirectory, claim), 'utf8'),
      ) as RelayDraftRequest;
      expect(submitted).toEqual({
        body: durable.body,
        canonicalKey: durable.canonicalKey,
        installationId: durable.installationId,
        labels: durable.labels,
        legacySignature: durable.legacySignature,
        repository: durable.repository,
        requestId: durable.requestId,
        retryDeadlineAt: durable.retryDeadlineAt,
        title: durable.title,
      });
      sentPersistedBytes = true;
      return Promise.resolve(
        Response.json({
          receiptId: 'receipt-ready-attestation',
          requestId: submitted.requestId,
          state: 'filed',
        }),
      );
    });
    const transport = new FakeGitHub();
    const previousExitCode = process.exitCode;

    try {
      const outcome = await executeRetroCommand(
        { transcript },
        {
          environment: {
            SAFEWORD_RETRO_RELAY_CREDENTIAL: 'swc_test',
            SAFEWORD_RETRO_RELAY_INSTALLATION_ID: '42',
            SAFEWORD_RETRO_RELAY_OUTBOX: outbox,
            SAFEWORD_RETRO_RELAY_REPOSITORY: 'arcadeai/safeword',
            SAFEWORD_RETRO_RELAY_URL: 'https://relay.invalid',
          },
          extract: () => Promise.resolve([rawFinding()]),
          extractionSucceeded: () => true,
          harness: 'codex',
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory: project,
          relay: {
            buildCommit: 'b'.repeat(40),
            fetch: send,
            isAncestor: () => Promise.resolve(true),
            manifest,
            now: new Date('2026-07-26T12:00:00.000Z'),
            readArtifactAtCommit: (_commit, artifactPath) =>
              Promise.resolve(relayReadinessArtifact(manifest, artifactPath)),
          },
          restTransportAvailable: true,
          sessionId: 'session-ready-attestation',
          transport,
        },
      );

      expect(outcome.ok).toBe(true);
      expect(send).toHaveBeenCalledOnce();
      expect(sentPersistedBytes).toBe(true);
      expect(transport.issues).toEqual([]);
    } finally {
      process.exitCode = previousExitCode;
      rmSync(project, { force: true, recursive: true });
      rmSync(outbox, { force: true, recursive: true });
    }
  });

  it('always gives an enabled relay at least one complete request budget', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-budget-'));
    const send = vi.fn<typeof fetch>((_input, init) => {
      const request = JSON.parse(Buffer.from(init?.body as Uint8Array).toString('utf8')) as {
        requestId: string;
      };
      return Promise.resolve(
        Response.json({
          receiptId: 'receipt-budget',
          requestId: request.requestId,
          state: 'filed',
        }),
      );
    });
    try {
      const outcome = await runRetro(
        { transcript: '/tmp/session.jsonl' },
        dependencies({
          projectDirectory,
          relay: {
            credential: 'swc_test',
            deadlineMs: 2000,
            fetch: send,
            installationId: 42,
            readiness: { enabled: true },
            relayUrl: 'https://relay.invalid',
            repository: 'arcadeai/safeword',
          },
        }),
      );

      expect(send).toHaveBeenCalledOnce();
      expect(outcome.relay?.accepted).toBe(1);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('reports an invalid injected relay route after persisting the durable draft', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-invalid-injected-relay-'));
    try {
      const outcome = await runRetro(
        { transcript: '/tmp/session.jsonl' },
        dependencies({
          projectDirectory,
          relay: {
            credential: 'swc_test',
            installationId: 42,
            readiness: { enabled: true },
            relayUrl: 'not a URL',
            repository: 'arcadeai/safeword',
          },
        }),
      );

      expect(outcome).toMatchObject({
        agentFilingNeeded: true,
        errorMessage: 'retro relay delivery failed: invalid relay URL',
        ok: false,
      });
      expect(await listRelayRequests(projectDirectory)).toHaveLength(1);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('retains a spool-persistence error when delivery fails afterward', async () => {
    const projectDirectory = mkdtempSync(
      nodePath.join(tmpdir(), 'retro-persistence-delivery-failure-'),
    );
    const finding = rawFinding({ title: 'Corrupt before delivery' });
    const validRelay = {
      credential: 'swc_test',
      fetch: () => Promise.reject(new Error('offline')),
      installationId: 42,
      readiness: { enabled: true },
      relayUrl: 'https://relay.invalid',
      repository: 'arcadeai/safeword',
    };
    try {
      await runRetro(
        { transcript: '/tmp/session.jsonl' },
        dependencies({
          extract: () => Promise.resolve([finding]),
          projectDirectory,
          relay: validRelay,
        }),
      );
      const [persisted] = await listRelayRequests(projectDirectory);
      if (persisted === undefined) throw new Error('missing persisted request');
      writeFileSync(activeRelayPath(projectDirectory, persisted.requestId), '{"requestId":');

      const outcome = await runRetro(
        { transcript: '/tmp/session.jsonl' },
        dependencies({
          extract: () => Promise.resolve([finding]),
          projectDirectory,
          relay: { ...validRelay, relayUrl: 'not a URL' },
        }),
      );

      expect(outcome).toMatchObject({
        agentFilingNeeded: true,
        errorMessage: expect.stringContaining('could not durably persist 1 finding'),
        ok: false,
      });
      expect(outcome.errorMessage).toContain('retro relay delivery failed: invalid relay URL');
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('continues filing healthy findings when another persisted source is corrupt', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-corrupt-source-'));
    const first = rawFinding({ title: 'Poisoned finding' });
    const second = rawFinding({
      repro: 'healthy repro',
      title: 'Healthy finding',
      what_happened: 'A healthy finding happened.',
    });
    const sentTitles: string[] = [];
    const relay = {
      credential: 'swc_test',
      fetch: vi.fn<typeof fetch>((_input, init) => {
        const request = JSON.parse(Buffer.from(init?.body as Uint8Array).toString('utf8')) as {
          requestId: string;
          title: string;
        };
        sentTitles.push(request.title);
        return Promise.resolve(
          Response.json({
            receiptId: `receipt-${request.requestId}`,
            requestId: request.requestId,
            state: 'filed',
          }),
        );
      }),
      installationId: 42,
      readiness: { enabled: true },
      relayUrl: 'https://relay.invalid',
      repository: 'arcadeai/safeword',
    };
    try {
      await runRetro(
        { transcript: '/tmp/session.jsonl' },
        dependencies({
          extract: () => Promise.resolve([first]),
          projectDirectory,
          relay: { ...relay, fetch: () => Promise.reject(new Error('offline')) },
        }),
      );
      const [poisoned] = await listRelayRequests(projectDirectory);
      if (poisoned === undefined) throw new Error('missing poisoned request');
      writeFileSync(activeRelayPath(projectDirectory, poisoned.requestId), '{"requestId":');

      const outcome = await runRetro(
        { transcript: '/tmp/session.jsonl' },
        dependencies({
          extract: () => Promise.resolve([first, second]),
          projectDirectory,
          relay,
        }),
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errorMessage).toBe(
        `retro relay could not durably persist 1 finding; request ${poisoned.requestId} is corrupt. Inspect it with \`safeword retro-relay-retry\`; only if intentionally abandoning it, run \`safeword retro-relay-discard ${poisoned.requestId} --confirm\`.`,
      );
      expect(outcome.relay?.spoolFailed).toBe(1);
      expect(sentTitles).toContain('Healthy finding');
      expect(outcome.relay?.deadLetterBacklog).toBe(1);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it.each(['dead-letter', 'rejected', 'tombstone'] as const)(
    'fails visibly for an unresolved server-owned %s receipt without native fallback',
    async state => {
      const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-terminal-'));
      const transport = new FakeGitHub();
      const send = vi.fn<typeof fetch>((_input, init) => {
        const request = JSON.parse(Buffer.from(init?.body as Uint8Array).toString('utf8')) as {
          requestId: string;
        };
        return Promise.resolve(
          Response.json({
            receiptId: `receipt-${state}`,
            requestId: request.requestId,
            state,
          }),
        );
      });
      try {
        const outcome = await runRetro(
          { transcript: '/tmp/session.jsonl' },
          dependencies({
            projectDirectory,
            relay: {
              credential: 'swc_test',
              fetch: send,
              installationId: 42,
              readiness: { enabled: true },
              relayUrl: 'https://relay.invalid',
              repository: 'arcadeai/safeword',
            },
            transport,
          }),
        );

        expect(outcome).toMatchObject({ agentFilingNeeded: false, ok: false });
        expect(outcome.errorMessage).toContain(`server-owned ${state}`);
        expect(transport.calls.createIssue).toBe(0);
      } finally {
        rmSync(projectDirectory, { recursive: true, force: true });
      }
    },
  );

  it('completes when a server tombstone names its resolved issue', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-tombstone-'));
    try {
      const outcome = await runRetro(
        { transcript: '/tmp/session.jsonl' },
        dependencies({
          projectDirectory,
          relay: {
            credential: 'swc_test',
            fetch: (_input, init) => {
              const request = JSON.parse(
                Buffer.from(init?.body as Uint8Array).toString('utf8'),
              ) as { requestId: string };
              return Promise.resolve(
                Response.json({
                  issueNumber: 1479,
                  receiptId: 'receipt-tombstone',
                  requestId: request.requestId,
                  state: 'tombstone',
                }),
              );
            },
            installationId: 42,
            readiness: { enabled: true },
            relayUrl: 'https://relay.invalid',
            repository: 'arcadeai/safeword',
          },
        }),
      );

      expect(outcome).toMatchObject({ agentFilingNeeded: false, ok: true });
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('keys same-window relay drafts by finding evidence rather than extractor position', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-reorder-'));
    const sent: { requestId: string; title: string }[] = [];
    const relayFetch: typeof fetch = (_input, init) => {
      if (!(init?.body instanceof Uint8Array)) throw new Error('missing relay request body');
      const request = JSON.parse(Buffer.from(init.body).toString('utf8')) as {
        requestId: string;
        title: string;
      };
      sent.push(request);
      return Promise.reject(new Error('relay unavailable'));
    };
    const relay = {
      credential: 'swc_test',
      fetch: relayFetch,
      installationId: 42,
      readiness: { enabled: true },
      relayUrl: 'https://relay.invalid',
      repository: 'arcadeai/safeword',
    };
    const first = rawFinding({ title: 'Finding A' });
    const second = rawFinding({
      repro: 'different repro',
      title: 'Finding B',
      what_happened: 'A different failure happened.',
      why_friction: 'A different workflow was blocked.',
    });

    try {
      await runRetro(
        { transcript: '/tmp/session.jsonl', windowStart: 0 },
        dependencies({
          extract: () => Promise.resolve([first]),
          projectDirectory,
          relay,
          sessionId: 'same-session',
        }),
      );
      await runRetro(
        { transcript: '/tmp/session.jsonl', windowStart: 0 },
        dependencies({
          extract: () => Promise.resolve([second, first]),
          projectDirectory,
          relay,
          sessionId: 'same-session',
        }),
      );

      const requests = await listRelayRequests(projectDirectory);
      const titles = requests
        .map(item => JSON.parse(item.bytes.toString()).title as string)
        .toSorted((left, right) => left.localeCompare(right));
      expect(titles).toEqual(['Finding A', 'Finding B']);
      expect(new Set(requests.map(item => item.requestId)).size).toBe(2);
      expect(sent.map(item => item.title)).toContain('Finding B');
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });

  it('keeps consecutive relay fires distinct across pending dead-letter and ack states', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-fires-'));
    vi.useFakeTimers();
    let now = Date.parse('2026-07-01T00:00:00.000Z');
    vi.setSystemTime(now);
    let finding = rawFinding({ title: 'First occurrence' });
    let accept = false;
    const transmittedRequestIds: string[] = [];
    const relayFetch: typeof fetch = (_input, init) => {
      let requestBody: string | undefined;
      if (typeof init?.body === 'string') requestBody = init.body;
      else if (init?.body instanceof Uint8Array) {
        requestBody = Buffer.from(init.body).toString('utf8');
      }
      if (requestBody === undefined) return Promise.reject(new Error('missing relay body'));
      const request = JSON.parse(requestBody) as { requestId: string };
      transmittedRequestIds.push(request.requestId);
      if (!accept) return Promise.reject(new Error('relay unavailable'));
      return Promise.resolve(
        Response.json(
          {
            receiptId: `receipt-${request.requestId}`,
            requestId: request.requestId,
            state: 'filed',
          },
          { status: 200 },
        ),
      );
    };
    const relay = {
      credential: 'swc_test',
      fetch: relayFetch,
      installationId: 42,
      readiness: { enabled: true },
      relayUrl: 'https://relay.invalid',
      repository: 'arcadeai/safeword',
    };
    const runFire = (windowStart: number) =>
      runRetro(
        { transcript: '/tmp/session.jsonl', windowStart },
        dependencies({
          extract: () => Promise.resolve([finding]),
          projectDirectory,
          relay,
          sessionId: 'same-session',
        }),
      );

    try {
      await runFire(0);
      const firstPending = await listRelayRequests(projectDirectory);
      expect(firstPending).toHaveLength(1);
      const firstRequestId = firstPending[0]?.requestId;
      expect(transmittedRequestIds).toEqual([firstRequestId]);

      now += 24 * 60 * 60 * 1000;
      vi.setSystemTime(now);
      finding = rawFinding({ title: 'Second occurrence' });
      await runFire(100);
      const deadLetters = await listRelayDeadLetters(projectDirectory);
      const secondPending = await listRelayRequests(projectDirectory);
      expect(deadLetters.map(request => request.requestId)).toEqual([firstRequestId]);
      expect(secondPending).toHaveLength(1);
      const secondRequestId = secondPending[0]?.requestId;
      expect(secondRequestId).not.toBe(firstRequestId);
      expect(transmittedRequestIds).toEqual([firstRequestId, secondRequestId]);

      finding = rawFinding({ title: 'First occurrence' });
      now += 61_000;
      vi.setSystemTime(now);
      await runFire(0);
      const revisitedDeadLetters = await listRelayDeadLetters(projectDirectory);
      const stillPending = await listRelayRequests(projectDirectory);
      expect(revisitedDeadLetters).toHaveLength(1);
      expect(stillPending).toHaveLength(1);
      expect(revisitedDeadLetters[0]?.requestId).toBe(firstRequestId);
      expect(stillPending[0]?.requestId).toBe(secondRequestId);
      expect(transmittedRequestIds).toEqual([firstRequestId, secondRequestId, secondRequestId]);

      accept = true;
      finding = rawFinding({ title: 'Second occurrence' });
      now += 121_000;
      vi.setSystemTime(now);
      await runFire(100);
      expect(await listRelayRequests(projectDirectory)).toHaveLength(0);
      expect(transmittedRequestIds.at(-1)).toBe(secondRequestId);
      const acknowledgedCallCount = transmittedRequestIds.length;
      await runFire(100);
      expect(await listRelayRequests(projectDirectory)).toHaveLength(0);
      expect(transmittedRequestIds).toHaveLength(acknowledgedCallCount);

      accept = false;
      finding = rawFinding({ title: 'Third occurrence' });
      await runFire(200);
      const remaining = await listRelayRequests(projectDirectory);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.requestId).not.toBe(firstRequestId);
      expect(remaining[0]?.requestId).not.toBe(secondRequestId);
      expect(remaining[0]?.bytes.toString()).toContain('Third occurrence');
      expect(transmittedRequestIds.at(-1)).toBe(remaining[0]?.requestId);
    } finally {
      vi.useRealTimers();
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });

  it('retro-transcript-mining.TB1.AC2.planted_friction_signal_is_extracted', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        extract: () => Promise.resolve([rawFinding({ category: 'rough-edge' })]),
      }),
    );
    expect(outcome.ok).toBe(true);
    expect(transport.issues).toHaveLength(1);
    expect(transport.issues[0]?.body).toContain('hooks/stop-quality.ts');
    expect(transport.issues[0]?.labels).toContain('rough-edge');
  });

  it('hands one sanitized finding to public quarantine without changing private filing', async () => {
    const attemptsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-attempts-'));
    const privateTransport = new FakeGitHub();
    const publicTransport = vi.fn(request =>
      Promise.resolve({
        requestId: request.headers['x-safeword-request-id'],
        receipt: 'receipt-one',
      }),
    );
    try {
      const outcome = await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          extract: () =>
            Promise.resolve([
              rawFinding({
                what_happened: 'Saw /Users/alex/customer.ts and sk_live_TESTONLY1',
              }),
            ]),
          publicRetro: {
            attemptsDirectory,
            now: () => 0,
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'claude-code',
              hostClass: 'local',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.79.0',
            },
            transport: publicTransport,
          },
          transport: privateTransport,
        }),
      );

      expect(outcome.ok).toBe(true);
      expect(privateTransport.issues).toHaveLength(1);
      expect(publicTransport).toHaveBeenCalledOnce();
      const request = publicTransport.mock.calls[0]?.[0];
      const body = new TextDecoder().decode(request?.body);
      expect(body).not.toContain('/Users/alex/customer.ts');
      expect(body).not.toContain('sk_live_TESTONLY1');
    } finally {
      rmSync(attemptsDirectory, { force: true, recursive: true });
    }
  });

  it.each([
    ['accepted', true, false],
    ['typed rejection', false, true],
    ['unreachable', false, true],
  ] as const)(
    'routes a server-v3 finding only through the collector when it is %s',
    async (_outcome, accepted, recoveryRetained) => {
      const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-server-route-'));
      const attemptsDirectory = nodePath.join(projectDirectory, '.safeword/public-retro-attempts');
      const privateTransport = new FakeGitHub();
      const publicTransport = vi.fn(request =>
        accepted
          ? Promise.resolve({
              receipt: 'server-receipt',
              requestId: request.headers['x-safeword-request-id'],
            })
          : Promise.reject(new Error(_outcome)),
      );
      try {
        const outcome = await runRetro(
          { transcript: '/tmp/t.jsonl' },
          dependencies({
            projectDirectory,
            publicRetro: {
              attemptsDirectory,
              now: () => 0,
              randomUUID: () => '11111111-2222-4333-8444-555555555555',
              route: 'server-v3',
              source: {
                harness: 'codex',
                hostClass: 'local',
                projectUUID: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                safewordCliVersion: '0.82.1',
              },
              transport: publicTransport,
            },
            sessionId: 'server-route-session',
            transport: privateTransport,
          }),
        );

        expect(outcome.ok).toBe(true);
        expect(privateTransport.issues).toHaveLength(0);
        expect(publicTransport).toHaveBeenCalledOnce();
        expect(readSpooledDrafts(projectDirectory, 'server-route-session')).toEqual([]);
        expect(readServerSpooledDrafts(projectDirectory, 'server-route-session')).toHaveLength(
          recoveryRetained ? 1 : 0,
        );
        expect(outcome.agentFilingNeeded).toBe(recoveryRetained);
        if (recoveryRetained) {
          expect(existsSync(draftSpoolPath(projectDirectory, 'server-route-session'))).toBe(true);
        }
        expect(readdirSync(attemptsDirectory)).toHaveLength(1);
      } finally {
        rmSync(projectDirectory, { force: true, recursive: true });
      }
    },
  );

  it('starts the shared public delivery budget before finding preparation', async () => {
    const attemptsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-attempts-'));
    let nowCalls = 0;
    const publicTransport = vi.fn(request =>
      Promise.resolve({
        requestId: request.headers['x-safeword-request-id'],
        receipt: 'receipt-after-preparation',
      }),
    );

    try {
      await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          extract: () => {
            expect(nowCalls).toBe(1);
            return Promise.resolve([rawFinding(), rawFinding({ title: 'Second finding' })]);
          },
          publicRetro: {
            attemptsDirectory,
            now: () => {
              nowCalls += 1;
              return 0;
            },
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'codex',
              hostClass: 'local',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.81.1',
            },
            transport: publicTransport,
          },
        }),
      );

      expect(publicTransport).toHaveBeenCalledOnce();
    } finally {
      rmSync(attemptsDirectory, { force: true, recursive: true });
    }
  });

  it('delivers later delta windows from one session under distinct public scopes', async () => {
    const attemptsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-attempts-'));
    const publicTransport = vi.fn(request =>
      Promise.resolve({
        requestId: request.headers['x-safeword-request-id'],
        receipt: `receipt-${publicTransport.mock.calls.length}`,
      }),
    );
    const requestIds = [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    ] as const;
    let requestIndex = 0;
    const publicRetro = {
      attemptsDirectory,
      now: () => 0,
      randomUUID: () => requestIds[requestIndex++] ?? requestIds[1],
      source: {
        harness: 'codex' as const,
        hostClass: 'local' as const,
        projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        safewordCliVersion: '0.81.1',
      },
      transport: publicTransport,
    };

    try {
      await runRetro(
        { transcript: '/tmp/t.jsonl', windowStart: 0 },
        dependencies({ publicRetro, sessionId: 'same-session' }),
      );
      await runRetro(
        { transcript: '/tmp/t.jsonl', windowStart: 100 },
        dependencies({ publicRetro, sessionId: 'same-session' }),
      );

      expect(publicTransport).toHaveBeenCalledTimes(2);
      const scopes = publicTransport.mock.calls.map(([request]) => {
        const envelope = JSON.parse(new TextDecoder().decode(request.body)) as {
          sessionScope: string;
        };
        return envelope.sessionScope;
      });
      expect(new Set(scopes).size).toBe(2);
    } finally {
      rmSync(attemptsDirectory, { force: true, recursive: true });
    }
  });

  it('persists private recovery before starting the public handoff', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-spool-first-'));
    const publicTransport = vi.fn(request => {
      expect(readSpooledDrafts(projectDirectory, 'sess-a')).toHaveLength(1);
      return Promise.resolve({
        requestId: request.headers['x-safeword-request-id'],
        receipt: 'receipt-spool-first',
      });
    });

    try {
      const outcome = await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          projectDirectory,
          publicRetro: {
            attemptsDirectory: nodePath.join(projectDirectory, '.safeword/retro-attempts'),
            now: () => 0,
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'codex',
              hostClass: 'unknown',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.80.1',
            },
            transport: publicTransport,
          },
        }),
      );

      expect(outcome.ok).toBe(true);
      expect(publicTransport).toHaveBeenCalledOnce();
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });

  it('uses only relay recovery when the configured relay owns the window', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-spool-first-'));
    const publicTransport = vi.fn(async request => {
      expect(await listRelayRequests(projectDirectory)).toHaveLength(1);
      return {
        requestId: request.headers['x-safeword-request-id'],
        receipt: 'receipt-relay-spool-first',
      };
    });
    const relayFetch: typeof fetch = (_input, init) => {
      if (!(init?.body instanceof Uint8Array)) throw new Error('missing relay request body');
      const request = JSON.parse(Buffer.from(init.body).toString('utf8')) as {
        requestId: string;
      };
      return Promise.resolve(
        Response.json({
          receiptId: 'relay-receipt-spool-first',
          requestId: request.requestId,
          state: 'filed',
        }),
      );
    };

    try {
      const outcome = await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          projectDirectory,
          publicRetro: {
            attemptsDirectory: nodePath.join(projectDirectory, '.safeword/retro-attempts'),
            now: () => 0,
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'codex',
              hostClass: 'unknown',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.80.1',
            },
            transport: publicTransport,
          },
          relay: {
            credential: 'swc_test',
            fetch: relayFetch,
            installationId: 42,
            readiness: { enabled: true },
            relayUrl: 'https://relay.invalid',
            repository: 'arcadeai/safeword',
          },
        }),
      );

      expect(outcome.ok).toBe(true);
      expect(publicTransport).not.toHaveBeenCalled();
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });

  it('preserves private filing when the public collector rejects the submission', async () => {
    const attemptsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-attempts-'));
    const privateTransport = new FakeGitHub();
    const publicTransport = vi.fn(() => Promise.reject(new Error('injected rejection')));
    try {
      const outcome = await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          publicRetro: {
            attemptsDirectory,
            now: () => 0,
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'cursor',
              hostClass: 'unknown',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.80.1',
            },
            transport: publicTransport,
          },
          transport: privateTransport,
        }),
      );

      expect(outcome.ok).toBe(true);
      expect(publicTransport).toHaveBeenCalledOnce();
      expect(privateTransport.issues).toHaveLength(1);
    } finally {
      rmSync(attemptsDirectory, { force: true, recursive: true });
    }
  });

  it('hands every valid sanitized finding to public quarantine in original order', async () => {
    const attemptsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-attempts-'));
    const publicTransport = vi.fn();
    try {
      await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          extract: () =>
            Promise.resolve([
              rawFinding(),
              rawFinding({ title: '' }),
              rawFinding({ title: 'A second valid finding' }),
            ]),
          publicRetro: {
            attemptsDirectory,
            now: () => 0,
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'codex',
              hostClass: 'local',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.79.0',
            },
            transport: publicTransport,
          },
        }),
      );

      expect(publicTransport).toHaveBeenCalledOnce();
      const request = publicTransport.mock.calls[0]?.[0];
      const body = JSON.parse(new TextDecoder().decode(request?.body)) as {
        findings: string[];
        version: string;
      };
      expect(body.version).toBe('v2');
      expect(body.findings).toHaveLength(2);
      expect(body.findings[0]).toContain('Coverage gate message omits file and number');
      expect(body.findings[1]).toContain('A second valid finding');
    } finally {
      rmSync(attemptsDirectory, { force: true, recursive: true });
    }
  });

  it('preserves every valid finding privately after public batch acceptance', async () => {
    const attemptsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-attempts-'));
    const privateTransport = new FakeGitHub();
    const publicTransport = vi.fn(request =>
      Promise.resolve({
        receipt: 'receipt-fixture',
        requestId: request.headers['x-safeword-request-id'],
      }),
    );
    try {
      const outcome = await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          extract: () =>
            Promise.resolve([
              rawFinding(),
              rawFinding({ title: 'A second valid finding' }),
              rawFinding({ title: 'A third valid finding' }),
            ]),
          publicRetro: {
            attemptsDirectory,
            now: () => 0,
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'codex',
              hostClass: 'local',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.81.1',
            },
            transport: publicTransport,
          },
          transport: privateTransport,
        }),
      );

      expect(outcome.ok).toBe(true);
      expect(publicTransport).toHaveBeenCalledOnce();
      expect(privateTransport.issues).toHaveLength(3);
    } finally {
      rmSync(attemptsDirectory, { force: true, recursive: true });
    }
  });

  it('makes no public attempt when every extracted finding is invalid', async () => {
    const attemptsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-attempts-'));
    const publicTransport = vi.fn();
    try {
      const outcome = await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          extract: () => Promise.resolve([rawFinding({ title: '' })]),
          publicRetro: {
            attemptsDirectory,
            now: () => 0,
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'codex',
              hostClass: 'local',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.81.1',
            },
            transport: publicTransport,
          },
        }),
      );

      expect(outcome.ok).toBe(true);
      expect(publicTransport).not.toHaveBeenCalled();
      expect(readdirSync(attemptsDirectory)).toEqual([]);
    } finally {
      rmSync(attemptsDirectory, { force: true, recursive: true });
    }
  });

  it('keeps private recovery when no public carrier is available', async () => {
    const privateTransport = new FakeGitHub();

    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        extract: () =>
          Promise.resolve([rawFinding(), rawFinding({ title: 'A second valid finding' })]),
        transport: privateTransport,
      }),
    );

    expect(outcome.ok).toBe(true);
    expect(privateTransport.issues).toHaveLength(2);
  });

  it('retro-transcript-mining.TB1.AC2.missing_flag_fails_loudly_and_files_nothing', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro({}, dependencies({ transport }));
    expect(outcome.ok).toBe(false);
    expect(outcome.errorMessage).toMatch(/--transcript/);
    expect(transport.calls.createIssue).toBe(0);
  });

  it('retro-transcript-mining.TB1.AC2.unreadable_path_fails_loudly_and_files_nothing', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/nope/missing.jsonl' },
      dependencies({
        transport,
        readFile: () => {
          throw new Error('ENOENT');
        },
      }),
    );
    expect(outcome.ok).toBe(false);
    expect(transport.calls.createIssue).toBe(0);
  });

  it('retro-transcript-mining.TB1.AC1.findings_are_filed_without_approval', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro({ transcript: '/tmp/t.jsonl' }, dependencies({ transport }));
    expect(outcome.ok).toBe(true);
    expect(transport.calls.createIssue).toBe(1);
    expect(outcome.result?.created).toHaveLength(1);
  });

  it('retro-transcript-mining.NTB1.AC2.unresolvable_surface_is_dropped_not_filed', async () => {
    const attemptsDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-public-attempts-'));
    const transport = new FakeGitHub();
    const publicTransport = vi.fn();
    try {
      await runRetro(
        { transcript: '/tmp/t.jsonl' },
        dependencies({
          transport,
          extract: () =>
            Promise.resolve([
              rawFinding({ safeword_surface: 'src/billing.ts', title: 'Customer bug' }),
              rawFinding({ title: 'Real safeword friction' }),
            ]),
          publicRetro: {
            attemptsDirectory,
            now: () => 0,
            randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            source: {
              harness: 'codex',
              hostClass: 'local',
              projectUUID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              safewordCliVersion: '0.81.1',
            },
            transport: publicTransport,
          },
        }),
      );
      expect(transport.issues).toHaveLength(1);
      expect(transport.issues[0]?.title).toBe('Real safeword friction');
      const publicBody = new TextDecoder().decode(publicTransport.mock.calls[0]?.[0].body);
      expect(publicBody).toContain('Real safeword friction');
      expect(publicBody).not.toContain('Customer bug');
    } finally {
      rmSync(attemptsDirectory, { force: true, recursive: true });
    }
  });

  it('retro-transcript-mining.NTB1.AC2.end_to_end_filed_payload_carries_no_customer_data', async () => {
    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({
              what_happened:
                'gate fired editing /Users/jdoe/app/billing.ts with key sk_live_TESTONLY1',
            }),
          ]),
      }),
    );
    const filed = JSON.stringify(transport.issues);
    expect(filed).not.toContain('/Users/jdoe/app/billing.ts');
    expect(filed).not.toContain('sk_live_TESTONLY1');
    expect(filed).toContain('[path]');
    expect(filed).toContain('[redacted]');
  });

  // invisible-retro-claude.NTB1.AC1 — the --auto-extract path (headless extractor)
  // feeds findings through the SAME egress guard end-to-end: a secret + customer
  // path are scrubbed, and a finding whose surface does not resolve is dropped.
  it('invisible-retro-claude.NTB1.AC1.auto_extracted_findings_pass_the_egress_guard', async () => {
    const envelope = (text: string) =>
      JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text });
    const extracted = JSON.stringify([
      {
        category: 'rough-edge',
        title: 'Gate omits the file',
        safeword_surface: 'hooks/stop-quality.ts',
        what_happened: 'blocked editing /Users/jdoe/app/secret.ts with key sk_live_TESTONLY1',
        why_friction: 'could not unblock',
        repro: 'safeword check',
      },
      // unresolved surface → must be dropped, not filed
      {
        category: 'bug',
        title: 'Customer-surface finding',
        safeword_surface: 'src/billing.ts',
        what_happened: 'x',
        why_friction: 'y',
        repro: 'z',
      },
    ]);

    const autoExtractor = (transcript: string) =>
      runHeadlessExtraction(transcript, {
        spawn: () => Promise.resolve({ code: 0, stdout: envelope(extracted) }),
        writeDigest: () => '/tmp/neutral/digest.txt',
        env: {},
        cwd: '/tmp/neutral',
        model: 'haiku',
      });

    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({ transport, extract: autoExtractor }),
    );

    // The unresolved-surface finding was dropped; only the safeword one filed.
    expect(transport.issues).toHaveLength(1);
    const filed = JSON.stringify(transport.issues);
    expect(filed).not.toContain('/Users/jdoe/app/secret.ts');
    expect(filed).not.toContain('sk_live_TESTONLY1');
    expect(filed).not.toContain('src/billing.ts');
    expect(filed).toContain('[redacted]');
  });

  // ZFGWS1 — a friction only in the BACK HALF (beyond the digest head cap) is
  // filed by a delta fire that windows from the prior offset, and a head-capped
  // fire over the same transcript files nothing. Drives the real runRetro →
  // windowFor → runHeadlessExtraction → buildDigest → triage path; the spawn is
  // gated on whether the (windowed) digest actually contains the back-half marker.
  it('retro-recall.SM1.AC1.back_half_finding_beyond_the_head_cap_is_filed', async () => {
    const headText = 'x'.repeat(DIGEST_CAP + 1000); // alone exceeds the digest cap
    const headEntry = JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: headText }] },
    });
    const backEntry = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'BACKHALF friction in hooks/stop-quality.ts' }],
      },
    });
    const transcript = `${headEntry}\n${backEntry}`;
    const windowStart = headEntry.length + 1; // first char of the back-half line

    const envelope = (text: string) =>
      JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text });
    const findingJSON = JSON.stringify([
      {
        category: 'rough-edge',
        title: 'Back-half friction',
        safeword_surface: 'hooks/stop-quality.ts',
        what_happened: 'surfaced only late in the session',
        why_friction: 'a fire-once retro head-caps and never reads it',
        repro: 'safeword check late in a long session',
      },
    ]);

    // The spawn "sees" the back-half finding only when the digest it was built from
    // actually contains the marker — i.e. only when the window read the back half.
    let digest = '';
    const autoExtractor = (window: string) =>
      runHeadlessExtraction(window, {
        writeDigest: (d: string) => {
          digest = d;
          return '/tmp/neutral/digest.txt';
        },
        spawn: () =>
          Promise.resolve({
            code: 0,
            stdout: envelope(digest.includes('BACKHALF') ? findingJSON : '[]'),
          }),
        env: {},
        cwd: '/tmp/neutral',
        model: 'sonnet',
      });

    // Head fire (windowStart 0): the digest head-caps → no BACKHALF → files nothing.
    const headTransport = new FakeGitHub();
    await runRetro(
      { transcript: '/t.jsonl', windowStart: 0 },
      dependencies({
        transport: headTransport,
        extract: autoExtractor,
        readFile: () => transcript,
      }),
    );
    expect(headTransport.issues).toHaveLength(0);

    // Delta fire (windowStart at the back half): the window digest carries BACKHALF
    // → the finding is filed, which the head-capped fire above would have missed.
    const deltaTransport = new FakeGitHub();
    await runRetro(
      { transcript: '/t.jsonl', windowStart },
      dependencies({
        transport: deltaTransport,
        extract: autoExtractor,
        readFile: () => transcript,
      }),
    );
    expect(deltaTransport.issues).toHaveLength(1);
    expect(deltaTransport.issues[0]?.body).toContain('hooks/stop-quality.ts');
  });

  // ZFGWS1 NTB1.AC1 — the egress guard holds for EVERY delta window, not just the
  // first: windowing slices the INPUT transcript only; findings from a re-fire
  // (windowStart > 0) still flow through normalize → resolveSurface →
  // sanitizeTextDeep → buildDraft, never bypassing it.
  it('retro-recall.NTB1.AC1.a_secret_in_a_delta_window_finding_is_redacted', async () => {
    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/t.jsonl', windowStart: 5000 },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({
              what_happened: 'leaked sk_live_TESTONLY1 editing /Users/jdoe/app/x.ts',
            }),
          ]),
      }),
    );
    const filed = JSON.stringify(transport.issues);
    expect(filed).not.toContain('sk_live_TESTONLY1');
    expect(filed).not.toContain('/Users/jdoe/app/x.ts');
    expect(filed).toContain('[redacted]');
  });

  it('retro-recall.NTB1.AC1.a_delta_window_finding_with_an_unresolved_surface_is_dropped', async () => {
    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/t.jsonl', windowStart: 5000 },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({ safeword_surface: 'src/billing.ts', title: 'Customer bug' }),
          ]),
      }),
    );
    expect(transport.issues).toHaveLength(0);
  });

  it('traces empty post-egress spool calls separately from extraction failure', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-empty-spool-'));
    const debugLog = nodePath.join(projectDirectory, 'retro-debug.jsonl');
    const previousDebugLog = process.env.SAFEWORD_RETRO_DEBUG_LOG;
    let events: Record<string, unknown>[] | undefined;
    process.env.SAFEWORD_RETRO_DEBUG_LOG = debugLog;
    try {
      await runRetro(
        { transcript: '/t.jsonl' },
        dependencies({
          projectDirectory,
          extract: () => Promise.resolve([]),
          transport: new FakeGitHub(),
          sessionId: 'empty-findings',
          readFile: () => 'transcript content',
        }),
      );
      events = readJsonlFile(debugLog);
    } finally {
      if (previousDebugLog === undefined) {
        delete process.env.SAFEWORD_RETRO_DEBUG_LOG;
      } else {
        process.env.SAFEWORD_RETRO_DEBUG_LOG = previousDebugLog;
      }
      rmSync(projectDirectory, { recursive: true, force: true });
    }

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'retro_cli_spool',
          sessionId: 'empty-findings',
          draftsPassed: 0,
          skippedAppend: true,
        }),
        expect.objectContaining({
          event: 'retro_cli_filing',
          sessionId: 'empty-findings',
          filedCount: 0,
          remainingDrafts: 0,
          agentFilingNeeded: false,
        }),
      ]),
    );
  });
});

// BNGK9W — transport selection: spool the post-egress drafts, try REST, then drain
// only the drafts that reached the tracker (by signature). A REST auth failure (the
// cloud #568 case) leaves the drafts spooled and signals that the agent path is
// needed; a partial result drains only the filed drafts. The spool fs is real (a
// temp projectDirectory), the GitHub REST transport is the mock.
describe('runRetro transport selection (BNGK9W — spool → try-REST → drain filed)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-transport-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  const twoFindings = [
    rawFinding({ title: 'Alpha friction', safeword_surface: 'hooks/a.ts' }),
    rawFinding({ title: 'Beta friction', safeword_surface: 'hooks/b.ts' }),
  ];

  // A transport whose createIssue rejects — simulates the cloud REST 401 per draft.
  class RejectingGitHub extends FakeGitHub {
    constructor(private readonly rejectTitle?: string) {
      super();
    }
    override createIssue(input: CreateIssueInput): Promise<IssueReference> {
      if (this.rejectTitle === undefined || input.title === this.rejectTitle) {
        return Promise.reject(new Error('401 Bad credentials'));
      }
      return super.createIssue(input);
    }
  }

  it('a valid token files all drafts and drains the spool — no agent filing needed', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({ transport, projectDirectory, extract: () => Promise.resolve(twoFindings) }),
    );
    expect(outcome.ok).toBe(true);
    expect(transport.calls.createIssue).toBe(2);
    expect(readAcks(projectDirectory, 'sess-a')).toEqual([
      { signature: expect.any(String), issue: 1 },
      { signature: expect.any(String), issue: 2 },
    ]);
    expect(readSpooledDrafts(projectDirectory, 'sess-a')).toEqual([]); // fully drained
    expect(outcome.agentFilingNeeded).toBe(false);
  });

  it('retains tracker-filed drafts when their acknowledgement cannot be persisted', async () => {
    mkdirSync(ackFilePath(projectDirectory, 'sess-a'), { recursive: true });

    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({ transport, projectDirectory, extract: () => Promise.resolve(twoFindings) }),
    );

    expect(transport.calls.createIssue).toBe(2);
    expect(readSpooledDrafts(projectDirectory, 'sess-a')).toHaveLength(2);
    expect(outcome.agentFilingNeeded).toBe(true);
  });

  it('retains tracker-filed drafts when acknowledgement writes cannot be read back', async () => {
    sinkWrites(ackFilePath(projectDirectory, 'sess-a'));

    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({ transport, projectDirectory, extract: () => Promise.resolve(twoFindings) }),
    );

    expect(transport.calls.createIssue).toBe(2);
    expect(readAcks(projectDirectory, 'sess-a')).toEqual([]);
    expect(readSpooledDrafts(projectDirectory, 'sess-a')).toHaveLength(2);
    expect(outcome.agentFilingNeeded).toBe(true);
  });

  it('a REST auth failure leaves every draft spooled and signals agent filing', async () => {
    const transport = new RejectingGitHub();
    const outcome = await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({ transport, projectDirectory, extract: () => Promise.resolve(twoFindings) }),
    );
    expect(outcome.ok).toBe(true);
    expect(readSpooledDrafts(projectDirectory, 'sess-a')).toHaveLength(2); // nothing filed → retained
    expect(outcome.agentFilingNeeded).toBe(true);
  });

  it('describes an authenticated transport failure without inventing its cause', async () => {
    class FailingAuthenticatedGitHub extends RejectingGitHub {
      override createIssue(): Promise<IssueReference> {
        return Promise.reject(new Error('500 Internal Server Error'));
      }
    }

    await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({
        transport: new FailingAuthenticatedGitHub(),
        projectDirectory,
        extract: () => Promise.resolve([twoFindings[0]]),
      }),
    );

    const dispatch = decideRetroFilingGate(projectDirectory, 'sess-a');
    expect(dispatch).toContain('remain queued');
    expect(dispatch).not.toMatch(/credential|authenticat|\b401\b|not a defect/i);
  });

  it('a partial REST result drains only the filed draft, retaining the rejected one', async () => {
    const transport = new RejectingGitHub('Beta friction');
    const outcome = await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({ transport, projectDirectory, extract: () => Promise.resolve(twoFindings) }),
    );
    const remaining = readSpooledDrafts(projectDirectory, 'sess-a');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.title).toBe('Beta friction');
    expect(outcome.agentFilingNeeded).toBe(true);
  });

  it('does not spool when no projectDirectory is provided (opt-in; existing callers unchanged)', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro({ transcript: '/t.jsonl' }, dependencies({ transport }));
    expect(outcome.ok).toBe(true);
    expect(outcome.agentFilingNeeded).toBeFalsy();
  });

  // NTB1.AC1 — only post-egress fields reach the spool. A finding carrying a
  // distinctive secret + customer path flows through the REAL egress pipeline; the
  // draft is spooled (REST 401 keeps it on disk), and the spool FILE carries neither
  // the secret nor the path — the no-leak guarantee holds on disk, not just upstream.
  it('the spool file carries only sanitized post-egress drafts — no secret, no customer path', async () => {
    const transport = new RejectingGitHub(); // 401 → the draft stays spooled to inspect
    await runRetro(
      { transcript: '/t.jsonl' },
      dependencies({
        transport,
        projectDirectory,
        extract: () =>
          Promise.resolve([
            rawFinding({
              what_happened:
                'gate fired editing /acme-corp/prod/secrets.ts with key sk_live_TESTONLY1',
            }),
          ]),
      }),
    );
    const raw = readFileSync(draftSpoolPath(projectDirectory, 'sess-a'), 'utf8');
    expect(raw).not.toContain('sk_live_TESTONLY1'); // recognized secret shape → redacted
    expect(raw).not.toContain('/acme-corp/prod/secrets.ts'); // customer path → redacted
    expect(raw).toContain('[redacted]');
    // Only the code-assembled fields ever reach disk (bodyDigest is the JDK0F0 body
    // seal; canonicalSignature is the H1P0D7 code-derived canonical identity — a hash
    // of the normalized repro, never raw finding text, so the no-leak assertions above
    // still guard it).
    const lines = raw.split('\n').filter(line => line.trim());
    for (const line of lines) {
      expect(Object.keys(JSON.parse(line)).toSorted((a, b) => a.localeCompare(b))).toEqual([
        'body',
        'bodyDigest',
        'canonicalSignature',
        'labels',
        'route',
        'signature',
        'title',
      ]);
    }
    // Close the wiring chain in one place: the drafts read back from the REAL
    // pipeline's spool (real sanitizer, real disk) pass the spool-side verifier.
    const readBack = readSpooledDrafts(projectDirectory, 'sess-a');
    expect(readBack.length).toBeGreaterThan(0);
    expect(readBack.every(draft => verifyDraftBody(draft))).toBe(true);
  });

  it('retroCommand still spools sanitized drafts when no GitHub transport is available', async () => {
    const transcript = nodePath.join(projectDirectory, 'transcript.jsonl');
    const findings = nodePath.join(projectDirectory, 'findings.json');
    writeFileSync(transcript, 'transcript content');
    writeFileSync(findings, JSON.stringify(twoFindings));

    const previousProjectDirectory = process.env.CLAUDE_PROJECT_DIR;
    const previousExitCode = process.exitCode;
    process.env.CLAUDE_PROJECT_DIR = projectDirectory;
    process.exitCode = undefined;
    try {
      await retroCommand({ transcript, findings, sessionId: 'sess-a' });
    } finally {
      if (previousProjectDirectory === undefined) {
        delete process.env.CLAUDE_PROJECT_DIR;
      } else {
        process.env.CLAUDE_PROJECT_DIR = previousProjectDirectory;
      }
      process.exitCode = previousExitCode;
    }

    const remaining = readSpooledDrafts(projectDirectory, 'sess-a');
    expect(remaining).toHaveLength(2);
    expect(remaining.map(draft => draft.title).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'Alpha friction',
      'Beta friction',
    ]);
  });
});

describe('executeRetroCommand filing-fault capture (#1936)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-filing-fault-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  class FailingGitHub extends FakeGitHub {
    override createIssue(): Promise<IssueReference> {
      return Promise.reject(new Error('500 Internal Server Error'));
    }
  }

  async function executeWithTransportAvailability(restTransportAvailable: boolean) {
    const transcript = nodePath.join(projectDirectory, 'transcript.jsonl');
    writeFileSync(transcript, 'transcript content');
    return executeRetroCommand(
      { transcript },
      {
        captureFilingFault: captureRetroFilingFault,
        environment: {},
        extract: () => Promise.resolve([rawFinding()]),
        extractionSucceeded: () => true,
        harness: 'claude',
        output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
        projectDirectory,
        relay: { manifest: { ...validRelayReadinessManifest(), enabled: false } },
        restTransportAvailable,
        sessionId: 'sess-fault',
        transport: new FailingGitHub(),
      },
    );
  }

  it('captures an authenticated filing failure through the command composition', async () => {
    const outcome = await executeWithTransportAvailability(true);

    expect(outcome.result?.failed).toHaveLength(1);
    expect(readReports(projectDirectory)).toEqual([
      expect.objectContaining({
        errorClass: 'RetroFilingFault',
        sessionId: 'sess-fault',
        source: 'retro-run',
      }),
    ]);
  });

  it('does not capture the ordinary no-credential recovery lane', async () => {
    const outcome = await executeWithTransportAvailability(false);

    expect(outcome.result?.failed).toHaveLength(1);
    expect(readReports(projectDirectory)).toEqual([]);
  });
});

// ZFGWS1 SM1.AC2 — the RUNNER (buildAutoExtractor), not just the headless-default
// concept, requests sonnet by default and honors the retro.model config override.
// Covers the done_when "a test covers buildAutoExtractor's model".
describe('buildAutoExtractor (SM1.AC2 — runner model: sonnet default, config-overridable)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-runner-'));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  async function modelFromRunner(
    directory: string,
    agent: 'claude' | 'codex' | 'cursor' = 'claude',
  ): Promise<{ argv: string[]; model: string | undefined }> {
    let argvSeen: string[] = [];
    const extract = await buildAutoExtractor(directory, {
      agent,
      spawn: (argv: string[]) => {
        argvSeen = argv;
        return Promise.resolve({ code: 0, stdout: '' });
      },
    });
    await extract(
      JSON.stringify({
        message: { role: 'user', content: [{ type: 'text', text: 'retro transcript' }] },
      }),
    );
    const modelFlag = agent === 'codex' ? '-m' : '--model';
    const modelFlagIndex = argvSeen.indexOf(modelFlag);
    return {
      argv: argvSeen,
      model: modelFlagIndex === -1 ? undefined : argvSeen[modelFlagIndex + 1],
    };
  }

  it('builds the extractor with sonnet when no retro.model is configured', async () => {
    const result = await modelFromRunner(projectDirectory);
    expect(result.model).toBe('sonnet');
  });

  it('builds the Codex extractor with gpt-5.5 when no retro.model is configured', async () => {
    const result = await modelFromRunner(projectDirectory, 'codex');
    expect(result.argv[0]).toBe('exec');
    expect(result.model).toBe('gpt-5.5');
  });

  it('builds the Cursor extractor with auto when no retro.model is configured', async () => {
    const result = await modelFromRunner(projectDirectory, 'cursor');
    expect(result.argv[0]).toBe('-p');
    expect(result.model).toBe('auto');
  });

  it('does not expose arbitrary parent environment variables to Cursor extraction', async () => {
    let childEnvironment: Record<string, string | undefined> | undefined;
    const extract = await buildAutoExtractor(projectDirectory, {
      agent: 'cursor',
      spawn: (_argv, options) => {
        childEnvironment = options.env;
        return Promise.resolve({
          code: 0,
          stdout: JSON.stringify({ type: 'result', is_error: false, result: '[]' }),
        });
      },
    });

    vi.stubEnv('SAFEWORD_PRIVATE_PARENT_SENTINEL', 'secret-parent-value');
    vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-secret');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'aws-secret');
    vi.stubEnv('OPENAI_API_KEY', 'openai-secret');
    vi.stubEnv('PATH', '/safe/shared/path');

    await extract(
      JSON.stringify({
        message: { role: 'user', content: [{ type: 'text', text: 'retro transcript' }] },
      }),
    );

    expect(childEnvironment).not.toHaveProperty('SAFEWORD_PRIVATE_PARENT_SENTINEL');
    expect(childEnvironment).not.toHaveProperty('ANTHROPIC_API_KEY');
    expect(childEnvironment).not.toHaveProperty('AWS_SECRET_ACCESS_KEY');
    expect(childEnvironment).not.toHaveProperty('OPENAI_API_KEY');
    expect(childEnvironment).toMatchObject({ PATH: '/safe/shared/path' });
  });

  it('installs deny-all Cursor tool and network policy before the extractor spawns', async () => {
    let policy:
      | {
          permissions: { allow: string[]; deny: string[] };
          approvalMode: string;
          sandbox: {
            type: string;
            disableTmpWrite: boolean;
            networkPolicy: { default: string; allow: string[] };
          };
        }
      | undefined;
    const extract = await buildAutoExtractor(projectDirectory, {
      agent: 'cursor',
      spawn: (_argv, options) => {
        policy = JSON.parse(
          readFileSync(nodePath.join(options.cwd, '.cursor/cli.json'), 'utf8'),
        ) as typeof policy;
        if (policy) {
          policy.sandbox = JSON.parse(
            readFileSync(nodePath.join(options.cwd, '.cursor/sandbox.json'), 'utf8'),
          ) as NonNullable<typeof policy>['sandbox'];
        }
        return Promise.resolve({
          code: 0,
          stdout: JSON.stringify({ type: 'result', is_error: false, result: '[]' }),
        });
      },
    });
    await extract(
      JSON.stringify({
        message: { role: 'user', content: [{ type: 'text', text: 'retro transcript' }] },
      }),
    );

    const observed = policy as {
      permissions: { allow: string[]; deny: string[] };
      approvalMode: string;
      sandbox: {
        type: string;
        disableTmpWrite: boolean;
        networkPolicy: { default: string; allow: string[] };
      };
    };

    expect(observed.permissions.allow).toEqual([]);
    expect(observed.permissions.deny).toEqual(
      expect.arrayContaining([
        'Shell(**)',
        'Read(**)',
        'Write(**)',
        'Mcp(**)',
        'WebFetch(**)',
        'WebSearch(**)',
      ]),
    );
    expect(observed.approvalMode).toBe('allowlist');
    expect(observed.sandbox).toEqual({
      type: 'workspace_readwrite',
      disableTmpWrite: true,
      networkPolicy: { default: 'deny', allow: [] },
    });
  });

  it('uses the configured retro.model override', async () => {
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({ retro: { model: 'haiku' } }),
    );
    const claude = await modelFromRunner(projectDirectory);
    const codex = await modelFromRunner(projectDirectory, 'codex');
    const cursor = await modelFromRunner(projectDirectory, 'cursor');
    expect(claude.model).toBe('haiku');
    expect(codex.model).toBe('haiku');
    expect(cursor.model).toBe('haiku');
  });
});

describe('runRetro provenance capture (G19QG7)', () => {
  // Only the process boundaries are mocked: GitHub transport, git subprocess,
  // clock. Environment detection and ledger rendering are real.
  //
  // Prefixes stay per-test: SM1.R2 plants `sw-acme-secret-project-` as a leak
  // sentinel and asserts the directory name never reaches public comments.
  let projectDirectory = '';
  afterEach(() => {
    if (projectDirectory) rmSync(projectDirectory, { recursive: true, force: true });
    projectDirectory = '';
  });
  const makeProject = (prefix: string, packageName: string): string => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), prefix));
    writeFileSync(
      nodePath.join(projectDirectory, 'package.json'),
      JSON.stringify({ name: packageName }),
    );
    return projectDirectory;
  };

  it('retro-filing-provenance.SM1.R1.dogfood_encounter_records_short_sha_and_capture_time', async () => {
    makeProject('sw-dogfood-', 'safeword');

    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        resolveProvenance: buildProvenanceResolver({
          projectDirectory,
          runGit: () => 'abc1234def\n',
          now: () => new Date('2026-07-07T12:00:00.000Z'),
          version: '0.67.0',
        }),
      }),
    );

    expect(outcome.ok).toBe(true);
    const ledgerComment = transport.comments.find(c => c.includes(LEDGER_MARKER));
    expect(ledgerComment).toBeDefined();
    expect(parseLedger(ledgerComment ?? '').provenance).toEqual({
      dogfood: { sha: 'abc1234def', at: '2026-07-07T12:00:00.000Z' },
    });
  });
  it('retro-filing-provenance.SM1.R1.customer_encounter_records_version_and_capture_time', async () => {
    makeProject('sw-customer-', 'acme-app');

    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        resolveProvenance: buildProvenanceResolver({
          projectDirectory,
          runGit: () => 'feedc0ffee\n',
          now: () => new Date('2026-07-07T12:00:00.000Z'),
          version: '0.67.0',
        }),
      }),
    );

    expect(outcome.ok).toBe(true);
    const ledgerComment = transport.comments.find(c => c.includes(LEDGER_MARKER));
    expect(parseLedger(ledgerComment ?? '').provenance).toEqual({
      install: { version: '0.67.0', at: '2026-07-07T12:00:00.000Z' },
    });
  });

  it('retro-filing-provenance.SM1.R2.customer_provenance_carries_no_customer_repo_identifier', async () => {
    makeProject('sw-acme-secret-project-', 'acme-app');

    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        resolveProvenance: buildProvenanceResolver({
          projectDirectory,
          // If the resolver ever consulted git in a customer install, this
          // branch-shaped sentinel would leak into the public artifacts.
          runGit: () => 'feature/acme-payments-refactor',
          now: () => new Date('2026-07-07T12:00:00.000Z'),
          version: '0.67.0',
        }),
      }),
    );

    const everything = transport.comments.join('\n');
    expect(everything).not.toContain('acme-payments-refactor');
    expect(everything).not.toContain('acme-secret-project');
    expect(everything).not.toContain(projectDirectory);
  });

  it('retro-filing-provenance.SM1.R1.unresolvable_git_state_files_without_provenance', async () => {
    makeProject('sw-dogfood-', 'safeword');

    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        resolveProvenance: buildProvenanceResolver({
          projectDirectory,
          runGit: () => {
            throw new Error('not a git repository');
          },
          now: () => new Date('2026-07-07T12:00:00.000Z'),
          version: '0.67.0',
        }),
      }),
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.result?.created).toHaveLength(1);
    const ledgerComment = transport.comments.find(c => c.includes(LEDGER_MARKER));
    expect(parseLedger(ledgerComment ?? '').provenance).toBeUndefined();
  });
});

describe('retroReconcileCommand wiring (G19QG7 SM2.R1)', () => {
  it('retro-filing-provenance.SM2.R1.reconcile_cli_mode_flags_through_injected_tracker', async () => {
    const { retroReconcileCommand } = await import('../../src/commands/retro.js');
    const { RECONCILE_LABEL, RECONCILE_MARKER } = await import('../../src/retro/reconcile.js');
    const { renderLedger, emptyLedger } = await import('../../src/retro/ledger.js');

    const ledger = renderLedger({
      ...emptyLedger(),
      total: 1,
      sessions: ['s1'],
      provenance: { dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } },
    });
    const comments = new Map<number, string[]>([[41, [ledger]]]);
    const labels = new Map<number, string[]>();
    const tracker = {
      listIssues: () =>
        Promise.resolve([
          {
            number: 41,
            title: 'flag via CLI',
            body: '**Safeword surface:** `packages/cli/src/retro/pipeline.ts`',
            labels: ['retro'],
          },
        ]),
      listComments: (n: number) =>
        Promise.resolve((comments.get(n) ?? []).map((body, index) => ({ id: index + 1, body }))),
      createComment: (n: number, body: string) => {
        comments.set(n, [...(comments.get(n) ?? []), body]);
        return Promise.resolve({ id: 99, body });
      },
      addLabels: (n: number, added: string[]) => {
        labels.set(n, [...(labels.get(n) ?? []), ...added]);
        return Promise.resolve();
      },
      resolveTagDate: () => Promise.resolve(undefined),
      surfaceTouchedSince: () => Promise.resolve(true),
    };

    await retroReconcileCommand({ tracker });

    expect(labels.get(41)).toContain(RECONCILE_LABEL);
    expect((comments.get(41) ?? []).some(c => c.includes(RECONCILE_MARKER))).toBe(true);
  });

  // 4KP67A (quality review): with per-issue isolation, a sweep where EVERY
  // evaluated issue fails (e.g. token valid enough to list but broken for
  // comment reads) would otherwise report success and look identical to a
  // healthy quiet day — total failure must redden the scheduled run.
  it('exits non-zero when every evaluated issue fails and nothing was flagged or skipped', async () => {
    const { retroReconcileCommand } = await import('../../src/commands/retro.js');
    const previousExitCode = process.exitCode;

    const tracker = {
      listIssues: () =>
        Promise.resolve([
          { number: 1, title: 'a', body: '**Safeword surface:** `hooks/a.ts`', labels: ['retro'] },
          { number: 2, title: 'b', body: '**Safeword surface:** `hooks/b.ts`', labels: ['retro'] },
        ]),
      listComments: () => Promise.reject(new Error('403')),
      createComment: () => Promise.reject(new Error('403')),
      addLabels: () => Promise.reject(new Error('403')),
      resolveTagDate: () => Promise.resolve(undefined),
      surfaceTouchedSince: () => Promise.resolve(false),
    };

    try {
      await retroReconcileCommand({ tracker });
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});

describe('retro summary reporting and process surfaces (PNZM3B SM2.R1)', () => {
  const reportOptions = (output: Parameters<typeof reportRetroCommandOutcome>[1]['output']) => ({
    extractionSucceeded: true,
    restTransportAvailable: true,
    output,
  });
  const collect = () => {
    const lines: string[] = [];
    return {
      lines,
      output: {
        error: (m: string) => {
          lines.push(m);
        },
        info: (m: string) => {
          lines.push(m);
        },
        success: (m: string) => {
          lines.push(m);
        },
      },
    };
  };

  it('counts unresolvable-surface drops in the rendered summary', async () => {
    const transport = new FakeGitHub();
    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({ safeword_surface: 'process/deadbeefcafe', title: 'Secret-shaped' }),
            rawFinding({ safeword_surface: 'src/billing.ts', title: 'Customer path' }),
            rawFinding(),
          ]),
      }),
    );

    const { lines, output } = collect();
    reportRetroCommandOutcome(outcome, reportOptions(output));

    const summary = lines.join('\n');
    expect(summary).toContain('2 dropped at the surface wall');
  });

  it('counts off-schema drops in the rendered summary', async () => {
    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        extract: () => Promise.resolve([rawFinding({ repro: undefined }), rawFinding()]),
      }),
    );

    const { lines, output } = collect();
    reportRetroCommandOutcome(outcome, reportOptions(output));

    expect(lines.join('\n')).toContain('1 dropped at the schema wall');
  });

  it('reports drops at both walls separately in one run', async () => {
    const outcome = await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        extract: () =>
          Promise.resolve([
            rawFinding({ repro: undefined }),
            rawFinding({ safeword_surface: 'src/billing.ts' }),
          ]),
      }),
    );

    const { lines, output } = collect();
    reportRetroCommandOutcome(outcome, reportOptions(output));

    const summary = lines.join('\n');
    expect(summary).toContain('1 dropped at the schema wall');
    expect(summary).toContain('1 dropped at the surface wall');
  });

  it("keeps a clean run's summary free of any drop line", async () => {
    const outcome = await runRetro({ transcript: '/tmp/t.jsonl' }, dependencies());

    const { lines, output } = collect();
    reportRetroCommandOutcome(outcome, reportOptions(output));

    expect(lines.join('\n')).not.toContain('dropped');
  });

  it('reports relay recovery without claiming the legacy agent path was spooled', () => {
    const { lines, output } = collect();
    reportRetroCommandOutcome(
      {
        agentFilingNeeded: true,
        drops: { schema: 0, surface: 0 },
        ok: true,
        relay: {
          accepted: 0,
          deadLetterBacklog: 1,
          deadLetteredThisRun: 1,
          retryable: 0,
        },
        result: {
          bumped: [],
          commented: [],
          created: [],
          deferred: [],
          failed: [],
          filedDestinations: [],
          filedSignatures: [],
        },
      },
      reportOptions(output),
    );

    expect(lines.join('\n')).toContain('retro-relay-retry <request-id>');
    expect(lines.join('\n')).not.toContain('agent filing path');
  });

  it('reports server-side dead letters as relay operator work without retaining local ownership', () => {
    const { lines, output } = collect();
    reportRetroCommandOutcome(
      {
        agentFilingNeeded: false,
        ok: true,
        relay: {
          accepted: 1,
          deadLetterBacklog: 0,
          deadLetteredThisRun: 0,
          retryable: 0,
          serverReportedTerminalReceipts: [
            {
              receiptId: 'receipt-dead-letter',
              requestId: '00000000-0000-4000-8000-000000001522',
              state: 'dead-letter',
            },
          ],
        },
      },
      reportOptions(output),
    );

    expect(lines.join('\n')).toContain(
      'request 00000000-0000-4000-8000-000000001522 (receipt receipt-dead-letter) is durably server-side dead-lettered; relay operator recovery is required',
    );
    expect(lines.join('\n')).toContain('1 durably owned');
    expect(lines.join('\n')).toContain('0 local dead letter(s)');
    expect(lines.join('\n')).not.toContain('retro-relay-retry <request-id>');
    expect(lines.join('\n')).not.toContain('agent filing path');
  });

  it('reports unrecoverable server rejection with its request and receipt identifiers', () => {
    const { lines, output } = collect();
    reportRetroCommandOutcome(
      {
        agentFilingNeeded: false,
        ok: true,
        relay: {
          accepted: 1,
          deadLetterBacklog: 0,
          deadLetteredThisRun: 0,
          retryable: 0,
          serverReportedTerminalReceipts: [
            {
              receiptId: 'receipt-rejected',
              requestId: '00000000-0000-4000-8000-000000001523',
              state: 'rejected',
            },
          ],
        },
      },
      reportOptions(output),
    );

    expect(lines.join('\n')).toContain(
      'request 00000000-0000-4000-8000-000000001523 (receipt receipt-rejected) was permanently rejected by the relay; inspect relay operations and logs',
    );
  });

  it('renders the durable relay summary and spool recovery hint before a terminal failure', () => {
    const { lines, output } = collect();
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      reportRetroCommandOutcome(
        {
          errorMessage: 'retro relay persistence failed',
          ok: false,
          relay: {
            accepted: 1,
            deadLetterBacklog: 2,
            deadLetteredThisRun: 0,
            retryable: 3,
            spoolFailed: 1,
          },
        },
        reportOptions(output),
      );

      expect(lines.join('\n')).toContain(
        'retro relay: 1 durably owned, 3 queued for retry, 2 local dead letter(s), 1 spool error(s)',
      );
      expect(lines.join('\n')).toContain('inspect the local relay spool');
      expect(lines.at(-1)).toBe('retro relay persistence failed');
      expect(lines).not.toContain('retro complete');
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it('retro-process-surface.SM1.R1.process_finding_files_end_to_end', async () => {
    const transport = new FakeGitHub();
    await runRetro(
      { transcript: '/tmp/t.jsonl' },
      dependencies({
        transport,
        extract: () =>
          Promise.resolve([
            rawFinding({ safeword_surface: 'process/tdd-loop', title: 'TDD loop misses tsc' }),
          ]),
      }),
    );

    expect(transport.issues).toHaveLength(1);
    expect(transport.issues[0]?.body).toContain('process/tdd-loop');
    expect(transport.issues[0]?.labels).toContain('process');
    expect(transport.issues[0]?.labels).toContain('retro');
    expect(transport.issues[0]?.labels).toContain('self-report');
  });
});

describe('relay dead-letter recovery command', () => {
  it('rearms the exact durable request identity for retry', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-retry-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001479');
    const persisted = await persistRelayRequest(projectDirectory, original);
    movePersistedRequestToDeadLetter(projectDirectory, persisted);
    const messages: string[] = [];

    try {
      await retryRelayDeadLetterCommand(original.requestId, {
        output: {
          error: message => {
            messages.push(message);
          },
          info: message => {
            messages.push(message);
          },
          success: message => {
            messages.push(message);
          },
        },
        projectDirectory,
      });

      const requests = await listRelayRequests(projectDirectory);
      expect(requests[0]?.requestId).toBe(original.requestId);
      expect(await listRelayDeadLetters(projectDirectory)).toEqual([]);
      expect(messages.join('\n')).toContain(original.requestId);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('explains a dead-letter rearm that loses ownership before the transition', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-rearm-race-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001490', 'source-race');
    const persisted = await persistRelayRequest(projectDirectory, original);
    movePersistedRequestToDeadLetter(projectDirectory, persisted);
    const error = vi.fn<(message: string) => void>();

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          faultBeforeRearm: async () => {
            await rearmRelayDeadLetter(projectDirectory, original.requestId);
          },
          output: { error, info: vi.fn(), success: vi.fn() },
          projectDirectory,
        }),
      ).resolves.toBe(false);
      expect(error).toHaveBeenCalledWith(
        `retro relay: dead letter ${original.requestId} could not be claimed; list current state and retry.`,
      );
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });

  it('does not misreport a fault-injection failure as an invalid request identity', async () => {
    const error = vi.fn<(message: string) => void>();
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-rearm-injected-fault-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001491', 'source-injected-fault');
    const persisted = await persistRelayRequest(projectDirectory, original);
    movePersistedRequestToDeadLetter(projectDirectory, persisted);

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          faultBeforeRearm: () => Promise.reject(new Error('injected rearm fault')),
          output: { error, info: vi.fn(), success: vi.fn() },
          projectDirectory,
        }),
      ).rejects.toThrow('injected rearm fault');
      expect(error).not.toHaveBeenCalled();
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });

  it('recovers an expired dead letter by replaying exact bytes to the existing server identity', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-recover-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001481', 'source', () => 0);
    const persisted = await persistRelayRequest(projectDirectory, original);
    movePersistedRequestToDeadLetter(projectDirectory, persisted);
    const send = vi.fn<typeof fetch>((_input, init) => {
      expect(Buffer.from(init?.body as Uint8Array).toString('utf8')).toContain(original.requestId);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(
        Response.json({
          issueNumber: 1479,
          receiptId: 'receipt-existing',
          requestId: original.requestId,
          state: 'filed',
        }),
      );
    });

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'swc_client_secret',
            fetch: send,
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).resolves.toBe(true);
      expect(send).toHaveBeenCalledOnce();
      expect(await listRelayDeadLetters(projectDirectory)).toEqual([]);
      expect(await listRelayRequests(projectDirectory)).toEqual([]);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('bridges an existing server dead letter to operator recovery', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-unresolved-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001482', 'source', () => 0);
    const persisted = await persistRelayRequest(projectDirectory, original);
    movePersistedRequestToDeadLetter(projectDirectory, persisted);

    const requestedUrls: string[] = [];
    const send = vi.fn<typeof fetch>((input, _init) => {
      let requestedUrl: string;
      if (typeof input === 'string') requestedUrl = input;
      else if (input instanceof URL) requestedUrl = input.href;
      else requestedUrl = input.url;
      requestedUrls.push(requestedUrl);
      if (requestedUrls.length === 1) {
        return Promise.resolve(
          Response.json({
            receiptId: 'receipt-existing',
            requestId: original.requestId,
            state: 'dead-letter',
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          issueNumber: 1482,
          receiptId: 'receipt-existing',
          requestId: original.requestId,
          state: 'filed',
        }),
      );
    });

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'swc_client_secret',
            fetch: send,
            operatorCredential: 'swc_operator_secret',
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).resolves.toBe(true);
      expect(requestedUrls).toEqual([
        'https://relay.invalid/v1/retro-filings',
        'https://relay.invalid/v1/retro-filings/receipt-existing/recover',
      ]);
      expect(await listRelayDeadLetters(projectDirectory)).toEqual([]);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('renews an expired local-only dead letter under the original request identity', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-renew-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001483', 'source', () => 0);
    const persisted = await persistRelayRequest(projectDirectory, original);
    movePersistedRequestToDeadLetter(projectDirectory, persisted);
    const sent: RelayDraftRequest[] = [];
    const send = vi.fn<typeof fetch>((_input, init) => {
      const request = JSON.parse(
        Buffer.from(init?.body as Uint8Array).toString('utf8'),
      ) as RelayDraftRequest;
      sent.push(request);
      if (sent.length === 1) {
        return Promise.resolve(
          Response.json(
            { error: 'invalid relay filing request', reason: 'retry-deadline-elapsed' },
            { status: 400 },
          ),
        );
      }
      return Promise.resolve(
        Response.json({
          issueNumber: 1483,
          receiptId: 'receipt-renewed',
          requestId: request.requestId,
          state: 'filed',
        }),
      );
    });

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'swc_client_secret',
            fetch: send,
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).resolves.toBe(true);
      expect(sent).toHaveLength(2);
      expect(sent[1]?.requestId).toBe(original.requestId);
      expect(Date.parse(sent[1]?.retryDeadlineAt ?? '')).toBeGreaterThan(Date.now());
      expect(await listRelayDeadLetters(projectDirectory)).toEqual([]);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('does not rewrite an expired dead letter for an unrelated validation failure', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-invalid-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001484', 'source', () => 0);
    const persisted = await persistRelayRequest(projectDirectory, original);
    const { deadLetter, originalBytes } = movePersistedRequestToDeadLetter(
      projectDirectory,
      persisted,
    );
    const send = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json(
          { error: 'invalid relay filing request', reason: 'invalid-request' },
          { status: 400 },
        ),
      ),
    );

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'swc_client_secret',
            fetch: send,
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).resolves.toBe(false);
      expect(send).toHaveBeenCalledOnce();
      expect(readFileSync(deadLetter)).toEqual(originalBytes);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('keeps renewed bytes when a retryable 4xx does not reject the payload', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-renew-auth-'));
    const original = relayRequest(
      '00000000-0000-4000-8000-000000001524',
      'source-renew-auth',
      () => 0,
    );
    const persisted = await persistRelayRequest(projectDirectory, original);
    const { deadLetter, originalBytes } = movePersistedRequestToDeadLetter(
      projectDirectory,
      persisted,
    );
    let attempt = 0;
    const send = vi.fn<typeof fetch>(() => {
      attempt += 1;
      return Promise.resolve(
        attempt === 1
          ? Response.json(
              { error: 'invalid relay filing request', reason: 'retry-deadline-elapsed' },
              { status: 400 },
            )
          : Response.json({ error: 'authentication is required' }, { status: 401 }),
      );
    });

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'expired-client-credential',
            fetch: send,
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).resolves.toBe(false);
      expect(send).toHaveBeenCalledTimes(2);
      const renewedBytes = readFileSync(deadLetter);
      expect(renewedBytes).not.toEqual(originalBytes);
      const renewed = JSON.parse(renewedBytes.toString('utf8')) as RelayDraftRequest;
      expect(renewed.requestId).toBe(original.requestId);
      expect(Date.parse(renewed.retryDeadlineAt)).toBeGreaterThan(Date.now());
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('restores the original source reservation after a renewed submission is rejected', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-renew-reject-'));
    const currentTime = Date.now();
    const draft = {
      body: 'body',
      canonicalKey: 'canonical',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'legacy',
      repository: 'arcadeai/safeword',
      sourceKey: 'source',
      title: 'title',
    };
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const original = await persistRelayDraft(projectDirectory, draft);
    vi.setSystemTime(currentTime);
    if (original === undefined) throw new Error('missing relay request');
    const [active] = await listRelayRequests(projectDirectory);
    if (active === undefined) throw new Error('missing active relay request');
    const activePath = activeRelayPath(projectDirectory, original.requestId);
    const deadLetter = deadLetterRelayPath(projectDirectory, original.requestId);
    writeFileSync(deadLetter, active.bytes);
    rmSync(activePath);
    let attempt = 0;
    const send = vi.fn<typeof fetch>(() => {
      attempt += 1;
      return Promise.resolve(
        Response.json(
          attempt === 1
            ? { error: 'invalid relay filing request', reason: 'retry-deadline-elapsed' }
            : { error: 'invalid relay filing request', reason: 'invalid-request' },
          { status: 400 },
        ),
      );
    });

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'swc_client_secret',
            fetch: send,
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).resolves.toBe(false);
      expect(send).toHaveBeenCalledTimes(2);
      expect(readFileSync(deadLetter)).toEqual(active.bytes);
      await expect(persistRelayDraft(projectDirectory, draft)).resolves.toMatchObject({
        requestId: original.requestId,
        retryDeadlineAt: original.retryDeadlineAt,
      });
    } finally {
      vi.useRealTimers();
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('reconciles the source reservation after a renewed submission loses its response', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-renew-crash-'));
    const currentTime = Date.now();
    const draft = {
      body: 'body',
      canonicalKey: 'canonical',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'legacy',
      repository: 'arcadeai/safeword',
      sourceKey: 'source',
      title: 'title',
    };
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const original = await persistRelayDraft(projectDirectory, draft);
    vi.setSystemTime(currentTime);
    if (original === undefined) throw new Error('missing relay request');
    const activeRequests = await listRelayRequests(projectDirectory);
    const active = activeRequests[0];
    if (active === undefined) throw new Error('missing active relay request');
    const activePath = activeRelayPath(projectDirectory, original.requestId);
    const deadLetter = deadLetterRelayPath(projectDirectory, original.requestId);
    writeFileSync(deadLetter, active.bytes);
    rmSync(activePath);
    let attempt = 0;
    const send = vi.fn<typeof fetch>(() => {
      attempt += 1;
      if (attempt === 1) {
        return Promise.resolve(
          Response.json(
            { error: 'invalid relay filing request', reason: 'retry-deadline-elapsed' },
            { status: 400 },
          ),
        );
      }
      return Promise.reject(new DOMException('response lost', 'AbortError'));
    });

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'swc_client_secret',
            fetch: send,
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).rejects.toThrow('response lost');
      const renewed = JSON.parse(readFileSync(deadLetter, 'utf8')) as RelayDraftRequest;
      expect(Date.parse(renewed.retryDeadlineAt)).toBeGreaterThan(currentTime);
      await expect(persistRelayDraft(projectDirectory, draft)).resolves.toMatchObject({
        requestId: original.requestId,
        retryDeadlineAt: renewed.retryDeadlineAt,
      });
    } finally {
      vi.useRealTimers();
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('keeps renewed identity coherent after the printed retry command rearms it', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-renew-rearm-'));
    const currentTime = Date.now();
    const draft = {
      body: 'body',
      canonicalKey: 'canonical',
      installationId: 42,
      labels: ['retro'],
      legacySignature: 'legacy',
      repository: 'arcadeai/safeword',
      sourceKey: 'source',
      title: 'title',
    };
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const original = await persistRelayDraft(projectDirectory, draft);
    vi.setSystemTime(currentTime);
    if (original === undefined) throw new Error('missing relay request');
    const [active] = await listRelayRequests(projectDirectory);
    if (active === undefined) throw new Error('missing active relay request');
    const activePath = activeRelayPath(projectDirectory, original.requestId);
    const deadLetter = deadLetterRelayPath(projectDirectory, original.requestId);
    writeFileSync(deadLetter, active.bytes);
    rmSync(activePath);
    let attempt = 0;
    const send = vi.fn<typeof fetch>(() => {
      attempt += 1;
      return Promise.resolve(
        attempt === 1
          ? Response.json(
              { error: 'invalid relay filing request', reason: 'retry-deadline-elapsed' },
              { status: 400 },
            )
          : Response.json({ error: 'relay unavailable' }, { status: 503 }),
      );
    });

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'swc_client_secret',
            fetch: send,
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).resolves.toBe(false);
      const renewed = JSON.parse(readFileSync(deadLetter, 'utf8')) as RelayDraftRequest;
      expect(Date.parse(renewed.retryDeadlineAt)).toBeGreaterThan(currentTime);

      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
        }),
      ).resolves.toBe(true);
      await expect(persistRelayDraft(projectDirectory, draft)).resolves.toMatchObject({
        requestId: original.requestId,
        retryDeadlineAt: renewed.retryDeadlineAt,
      });
      await expect(persistRelayDraft(projectDirectory, draft)).resolves.toMatchObject({
        requestId: original.requestId,
        retryDeadlineAt: renewed.retryDeadlineAt,
      });
    } finally {
      vi.useRealTimers();
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('bridges an ambiguous submit response to the operator recovery endpoint', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-ambiguous-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001485', 'source', () => 0);
    const persisted = await persistRelayRequest(projectDirectory, original);
    movePersistedRequestToDeadLetter(projectDirectory, persisted);
    const requestedUrls: string[] = [];
    const send = vi.fn<typeof fetch>(input => {
      let url: string;
      if (typeof input === 'string') url = input;
      else if (input instanceof URL) url = input.href;
      else url = input.url;
      requestedUrls.push(url);
      if (requestedUrls.length === 1) {
        return Promise.resolve(
          Response.json(
            {
              error: 'filing outcome is ambiguous',
              receiptId: 'receipt-ambiguous',
              requestId: original.requestId,
              state: 'ambiguous',
            },
            { status: 503 },
          ),
        );
      }
      return Promise.resolve(
        Response.json({
          issueNumber: 1485,
          receiptId: 'receipt-ambiguous',
          requestId: original.requestId,
          state: 'filed',
        }),
      );
    });

    try {
      await expect(
        retryRelayDeadLetterCommand(original.requestId, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
          relay: {
            credential: 'swc_client_secret',
            fetch: send,
            operatorCredential: 'swc_operator_secret',
            relayUrl: 'https://relay.invalid',
          },
        }),
      ).resolves.toBe(true);
      expect(requestedUrls).toEqual([
        'https://relay.invalid/v1/retro-filings',
        'https://relay.invalid/v1/retro-filings/receipt-ambiguous/recover',
      ]);
      expect(await listRelayDeadLetters(projectDirectory)).toEqual([]);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('discards one explicitly confirmed poisoned durable identity through the built CLI', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-discard-'));
    const cliProject = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-cli-discard-project-'));
    const durableOutbox = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-cli-discard-outbox-'));
    const requestId = '00000000-0000-4000-8000-000000001486';
    const spoolDirectory = nodePath.join(projectDirectory, '.safeword', 'retro-drafts', 'relay');
    mkdirSync(spoolDirectory, { recursive: true });
    const poisoned = nodePath.join(spoolDirectory, `${requestId}.dead-letter.json`);
    writeFileSync(poisoned, '{');

    try {
      await expect(
        discardRelaySpoolCommand(requestId, false, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
        }),
      ).resolves.toBe(false);
      expect(readFileSync(poisoned, 'utf8')).toBe('{');
      await expect(
        discardRelaySpoolCommand(requestId, true, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
        }),
      ).resolves.toBe(true);
      const cliRequestId = '00000000-0000-4000-8000-000000001487';
      const cliSpoolDirectory = nodePath.join(durableOutbox, '.safeword', 'retro-drafts', 'relay');
      mkdirSync(cliSpoolDirectory, { recursive: true });
      const cliPoisoned = nodePath.join(cliSpoolDirectory, `${cliRequestId}.dead-letter.json`);
      writeFileSync(cliPoisoned, '{');
      rmSync(cliProject, { recursive: true, force: true });

      const result = spawnSync(
        process.execPath,
        [builtCliPath(), 'retro-relay-discard', cliRequestId, '--confirm'],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: cliProject,
            SAFEWORD_RETRO_RELAY_OUTBOX: durableOutbox,
          },
        },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(`discarded poisoned durable request ${cliRequestId}`);
      expect(() => readFileSync(cliPoisoned)).toThrow();
      await expect(
        discardRelaySpoolCommand('not-a-request-id', true, {
          output: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
          projectDirectory,
        }),
      ).resolves.toBe(false);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
      rmSync(cliProject, { recursive: true, force: true });
      rmSync(durableOutbox, { recursive: true, force: true });
    }
  });

  it('rejects an unsafe relay discard identity before advertising a confirmation command', () => {
    const result = spawnSync(
      process.execPath,
      [
        builtCliPath(),
        'retro-relay-discard',
        '00000000-0000-4000-8000-000000001486;echo-owned',
        '--json',
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'CLI_ARGUMENT_INVALID' }],
      next_actions: [],
    });
  });

  it('lists and rearms through the built Commander entry point', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-cli-retry-'));
    const durableOutbox = mkdtempSync(nodePath.join(tmpdir(), 'retro-relay-cli-outbox-'));
    const original = relayRequest('00000000-0000-4000-8000-000000001480');
    const persisted = await persistRelayRequest(durableOutbox, original);
    movePersistedRequestToDeadLetter(durableOutbox, persisted);
    rmSync(projectDirectory, { recursive: true, force: true });
    const commandEnvironment = {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectDirectory,
      SAFEWORD_RETRO_RELAY_OUTBOX: durableOutbox,
    };

    try {
      const listedDeadLetter = spawnSync(process.execPath, [builtCliPath(), 'retro-relay-retry'], {
        encoding: 'utf8',
        env: commandEnvironment,
      });
      expect(listedDeadLetter.status, listedDeadLetter.stderr).toBe(0);
      expect(listedDeadLetter.stdout).toContain(`${original.requestId} dead-letter`);

      const result = spawnSync(
        process.execPath,
        [builtCliPath(), 'retro-relay-retry', original.requestId],
        {
          encoding: 'utf8',
          env: commandEnvironment,
        },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(original.requestId);
      const requests = await listRelayRequests(durableOutbox);
      expect(requests[0]?.requestId).toBe(original.requestId);
      const listedActive = spawnSync(process.execPath, [builtCliPath(), 'retro-relay-retry'], {
        encoding: 'utf8',
        env: commandEnvironment,
      });
      expect(listedActive.status, listedActive.stderr).toBe(0);
      expect(listedActive.stdout).toContain(`${original.requestId} active`);
    } finally {
      rmSync(projectDirectory, { recursive: true, force: true });
      rmSync(durableOutbox, { recursive: true, force: true });
    }
  });

  it.each([
    ['retro-relay-retry'],
    ['retro-relay-discard', '00000000-0000-4000-8000-000000001488', '--confirm'],
  ])(
    'fails %s visibly when a configured outbox is invalid instead of using the project',
    (...commandArguments) => {
      const projectDirectory = mkdtempSync(
        nodePath.join(tmpdir(), 'retro-relay-invalid-recovery-outbox-'),
      );

      try {
        const result = spawnSync(process.execPath, [builtCliPath(), ...commandArguments], {
          encoding: 'utf8',
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: projectDirectory,
            SAFEWORD_RETRO_RELAY_OUTBOX: 'relative/outbox',
          },
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          'SAFEWORD_RETRO_RELAY_OUTBOX must be an existing absolute directory outside the project',
        );
        expect(() => readdirSync(nodePath.join(projectDirectory, '.safeword'))).toThrow();
      } finally {
        rmSync(projectDirectory, { recursive: true, force: true });
      }
    },
  );
});
