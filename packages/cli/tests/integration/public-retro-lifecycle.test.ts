import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { startPublicRetroCollector } from '../../../retro-collector/src/index.js';
import { PublicRetroStore } from '../../../retro-collector/src/store.js';
import { buildPublicRetroEnvelope } from '../../src/retro/public-delivery.js';
import {
  cursorConversationStashPath,
  cursorProjectStashPath,
  cursorTranscriptStashPath,
} from '../../templates/hooks/lib/cursor-state.js';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const CLI_PACKAGE = path.join(ROOT, 'packages/cli');
const HOOKS = {
  'claude-code': path.join(CLI_PACKAGE, 'templates/hooks/stop-retro.ts'),
  codex: path.join(CLI_PACKAGE, 'templates/hooks/codex/stop.ts'),
} as const;
const CURSOR_BINDING_HOOK = path.join(
  CLI_PACKAGE,
  'templates/hooks/cursor/before-shell-execution.ts',
);
const temporaryDirectories: string[] = [];
const cursorSessions: string[] = [];
type LifecycleHarness = 'claude-code' | 'codex' | 'cursor';

afterEach(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true });
  temporaryDirectories.length = 0;
  for (const sessionId of cursorSessions) {
    const state = { conversation_id: sessionId };
    rmSync(cursorConversationStashPath(state), { force: true });
    rmSync(cursorProjectStashPath(state), { force: true });
    rmSync(cursorTranscriptStashPath(state), { force: true });
  }
  cursorSessions.length = 0;
});

function completedClaudeTranscript(project: string): string {
  const transcript = path.join(project, 'session.jsonl');
  const lines = [0, 1, 2].flatMap(index => [
    JSON.stringify({
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: `tool_${index}`, name: 'Read', input: {} }],
      },
    }),
    JSON.stringify({
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: `tool_${index}`, content: 'done' }],
      },
    }),
  ]);
  writeFileSync(transcript, lines.join('\n'));
  return transcript;
}

function completedCodexTranscript(project: string): string {
  const transcript = path.join(project, 'session.jsonl');
  const lines = [0, 1, 2].flatMap(index => [
    JSON.stringify({
      type: 'response_item',
      payload: { type: 'function_call', call_id: `call_${index}` },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: { type: 'function_call_output', call_id: `call_${index}` },
    }),
  ]);
  writeFileSync(transcript, lines.join('\n'));
  return transcript;
}

function runHook(
  bun: string,
  hook: string,
  project: string,
  environment: NodeJS.ProcessEnv,
  input: string,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bun, [hook], { cwd: project, env: environment });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr.setEncoding('utf8').on('data', chunk => {
      stderr += String(chunk);
    });
    child.once('error', reject);
    child.once('close', status => {
      resolve({ status, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

async function primeCursorBinding(
  bun: string,
  project: string,
  environment: NodeJS.ProcessEnv,
  sessionId: string,
  transcript: string,
): Promise<void> {
  cursorSessions.push(sessionId);
  const result = await runHook(
    bun,
    CURSOR_BINDING_HOOK,
    project,
    environment,
    JSON.stringify({
      command: 'safeword retro run',
      conversation_id: sessionId,
      transcript_path: transcript,
      workspace_roots: [project],
    }),
  );
  expect(result.status).toBe(0);
  const state = { conversation_id: sessionId };
  const stashedProject = readFileSync(cursorProjectStashPath(state), 'utf8');
  expect(readFileSync(cursorConversationStashPath(state), 'utf8')).toBe(sessionId);
  expect(readFileSync(cursorTranscriptStashPath(state), 'utf8')).toBe(transcript);
  expect(realpathSync(stashedProject)).toBe(realpathSync(project));
}

async function primeCursorBindingIfNeeded(input: {
  bun: string;
  environment: NodeJS.ProcessEnv;
  harness: LifecycleHarness;
  project: string;
  sessionId: string;
  transcript: string;
}): Promise<void> {
  if (input.harness !== 'cursor') return;
  await primeCursorBinding(
    input.bun,
    input.project,
    input.environment,
    input.sessionId,
    input.transcript,
  );
}

it('ships Cursor retro wiring with public delivery and paired conversation identity', () => {
  const skill = readFileSync(path.join(CLI_PACKAGE, 'templates/skills/retro/SKILL.md'), 'utf8');

  expect(skill).toContain('/tmp/safeword-cursor-transcript-');
  expect(skill).toContain('/tmp/safeword-cursor-conversation-$key');
  expect(skill).toContain('bind that transcript and conversation to the current');
  expect(skill).toContain(
    'safeword retro run --public-retro --transcript <path> --findings <findings.json> --session-id <session-id>',
  );
});

it('ships manual retro with a project-toolchain-independent CLI carrier', () => {
  const skill = readFileSync(path.join(CLI_PACKAGE, 'templates/skills/retro/SKILL.md'), 'utf8');

  expect(skill).toContain('bunx --bun safeword@latest');
  expect(skill).not.toContain('bun run safeword');
});

it('ships the public retro metadata, exclusion, and opt-out disclosure', () => {
  const guide = readFileSync(path.join(CLI_PACKAGE, 'templates/guides/retro.md'), 'utf8');

  expect(guide).toContain('project UUID, repository identity, session scope, harness, host class');
  expect(guide).toContain('available agent, model, SafeWord CLI, and plugin versions');
  expect(guide).toContain('transcript or prompt text, tool output, file contents, secrets');
  expect(guide).toContain('hostname, IP address, machine identifiers, or user identity');
  expect(guide).toContain('safeword project public-retros off');
});

it('round-trips a current CLI envelope through the real collector unchanged', async () => {
  const project = mkdtempSync(path.join(tmpdir(), 'public-retro-round-trip-'));
  temporaryDirectories.push(project);
  const collector = await startPublicRetroCollector({
    databasePath: path.join(project, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });
  const prepared = buildPublicRetroEnvelope({
    findings: ['first current fixture finding', 'second current fixture finding'],
    sessionId: 'current-session-fixture',
    source: {
      harness: 'codex',
      hostClass: 'unknown',
      projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      safewordCliVersion: '0.80.1',
      repository: 'github.com/arcadeai/safeword',
      agentVersion: 'agent-1.2.3',
      model: 'm'.repeat(256),
      osFamily: 'darwin',
    },
  });

  const accepted = await fetch(`${collector.url}/v1/public-retros`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-safeword-request-id': '01911111-2222-7333-8444-55555555555d',
    },
    body: prepared.bytes,
  });
  const { receipt } = (await accepted.json()) as { receipt: string };
  const inspected = await fetch(`${collector.url}/v1/public-retros/${receipt}`, {
    headers: { authorization: 'Bearer operator-fixture-credential' },
  });
  const inspectedBody = new Uint8Array(await inspected.arrayBuffer());
  await collector.close();

  expect(accepted.status).toBe(201);
  expect(inspected.status).toBe(200);
  expect(inspectedBody).toEqual(prepared.bytes);
});

it.each([
  ['claude-code', completedClaudeTranscript],
  ['codex', completedCodexTranscript],
  ['cursor', completedClaudeTranscript],
] as const)(
  'runs installed %s lifecycle through the real collector to a durable receipt',
  async (harness, completedTranscript) => {
    const project = mkdtempSync(path.join(tmpdir(), 'public-retro-lifecycle-'));
    const buildDirectory = mkdtempSync(path.join(CLI_PACKAGE, '.public-retro-build-'));
    temporaryDirectories.push(project, buildDirectory);
    const safewordDirectory = path.join(project, '.safeword');
    const attemptsDirectory = path.join(safewordDirectory, 'retro-attempts');
    mkdirSync(safewordDirectory, { recursive: true });
    mkdirSync(path.join(project, '.git'));
    writeFileSync(
      path.join(safewordDirectory, 'config.json'),
      JSON.stringify({
        projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        selfReport: { surface: true },
      }),
    );
    writeFileSync(
      path.join(project, '.git/config'),
      '[remote "origin"]\nurl = git@github.com:ArcadeAI/safeword.git\n',
    );
    const findings = path.join(project, 'findings.json');
    const fixtureSecret = ['sk', 'live', 'fixturesecret123456'].join('_');
    writeFileSync(
      findings,
      JSON.stringify([
        {
          category: 'rough-edge',
          title: 'Lifecycle fixture finding',
          safeword_surface: 'process/retro-delivery',
          what_happened: `The lifecycle fixture observed ${fixtureSecret} during a handoff.`,
          why_friction: 'A missing receipt at /Users/customer/private/repo would lose the retro.',
          repro: 'Complete a supported local session.',
        },
        {
          category: 'bug',
          title: 'Second lifecycle fixture finding',
          safeword_surface: 'process/retro-delivery',
          what_happened: 'The same extraction produced another eligible finding.',
          why_friction: 'Dropping it would make local delivery incomplete.',
          repro: 'Complete the same supported local session.',
        },
        {
          category: 'rough-edge',
          title: 'Third lifecycle fixture finding',
          safeword_surface: 'process/retro-delivery',
          what_happened: 'The same extraction produced a third eligible finding.',
          why_friction: 'The batch must preserve every eligible finding in order.',
          repro: 'Complete the same supported local session.',
        },
      ]),
    );
    const store = new PublicRetroStore(path.join(project, 'collector.sqlite'));
    let acceptCalls = 0;
    const collector = await startPublicRetroCollector(
      {
        databasePath: path.join(project, 'collector.sqlite'),
        operatorCredential: 'operator-fixture-credential',
      },
      {
        accept: (...args) => {
          acceptCalls += 1;
          return store.accept(...args);
        },
        close: () => {
          store.close();
        },
        read: receipt => store.read(receipt),
      },
    );
    const sessionId = `public-lifecycle-${process.pid}-${Date.now()}`;
    const debugLog = path.join(project, 'retro-debug.jsonl');

    try {
      const { build } = await import('tsup');
      await build({
        clean: false,
        config: false,
        define: { __SAFEWORD_PUBLIC_RETRO_ORIGIN__: JSON.stringify(collector.url) },
        dts: false,
        entry: [path.join(CLI_PACKAGE, 'src/cli.ts')],
        format: ['esm'],
        outDir: buildDirectory,
        silent: true,
        sourcemap: false,
        target: 'node18',
      });
      const wrapper =
        harness === 'codex'
          ? path.join(project, 'packages/cli/src/cli.ts')
          : path.join(project, 'extraction-fixture.mjs');
      mkdirSync(path.dirname(wrapper), { recursive: true });
      writeFileSync(
        wrapper,
        `#!${process.execPath}\nimport { spawnSync } from 'node:child_process';\nconst args = process.argv.slice(2).filter(arg => arg !== '--auto-extract');\nargs.push('--findings', process.env.FINDINGS_PATH);\nconst result = spawnSync(process.execPath, [process.env.CLI_PATH, ...args], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });\nprocess.exit(result.status ?? 1);\n`,
      );
      chmodSync(wrapper, 0o755);
      const transcript = completedTranscript(project);
      const cursorRunner = path.join(project, 'cursor-retro.mjs');
      writeFileSync(
        cursorRunner,
        `import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, [process.env.CLI_PATH, 'retro', 'run', '--public-retro', '--transcript', process.env.TRANSCRIPT_PATH, '--findings', process.env.FINDINGS_PATH, '--session-id', process.env.SESSION_ID, '--json'], { cwd: process.cwd(), env: { ...process.env, SAFEWORD_RETRO_AGENT: 'cursor' }, stdio: 'ignore' });
process.exit(result.status ?? 1);
`,
      );
      const hook = harness === 'cursor' ? cursorRunner : HOOKS[harness];
      const bun = spawnSync('which', ['bun'], { encoding: 'utf8' }).stdout.trim();
      expect(bun).not.toBe('');
      const controlledEnvironment = {
        ...process.env,
        ANTHROPIC_MODEL: 'claude-model-lifecycle-sentinel',
        CLAUDE_CODE_VERSION: 'claude-agent-lifecycle-sentinel',
        CODEX_MODEL: 'codex-model-lifecycle-sentinel',
        CODEX_VERSION: 'codex-agent-lifecycle-sentinel',
        GIT_CONFIG_GLOBAL: path.join(project, 'missing-global-gitconfig'),
        HOME: path.join(project, 'empty-home'),
      };
      await primeCursorBindingIfNeeded({
        bun,
        environment: controlledEnvironment,
        harness,
        project,
        sessionId,
        transcript,
      });
      const result = await runHook(
        bun,
        hook,
        project,
        {
          ...controlledEnvironment,
          CLAUDE_PROJECT_DIR: project,
          CLI_PATH: path.join(buildDirectory, 'cli.js'),
          FINDINGS_PATH: findings,
          PATH: `${path.dirname(bun)}:/usr/bin:/bin`,
          SAFEWORD_RETRO_DEBUG_LOG: debugLog,
          SAFEWORD_RETRO_EXTRACT_CMD: wrapper,
          SESSION_ID: sessionId,
          TRANSCRIPT_PATH: transcript,
        },
        JSON.stringify({ session_id: sessionId, transcript_path: transcript, cwd: project }),
      );

      expect(result).toMatchObject({ status: 0, stderr: '' });
      if (harness === 'claude-code') expect(result.stdout).toBe('');
      if (!existsSync(attemptsDirectory)) {
        throw new Error(readFileSync(debugLog, 'utf8'));
      }
      const [markerName] = readdirSync(attemptsDirectory);
      if (markerName === undefined) {
        throw new Error(`expected a public attempt marker\n${readFileSync(debugLog, 'utf8')}`);
      }
      const marker = JSON.parse(readFileSync(path.join(attemptsDirectory, markerName), 'utf8')) as {
        receipt?: string;
      };
      expect(marker.receipt).toBeDefined();
      const inspected = await fetch(`${collector.url}/v1/public-retros/${marker.receipt}`, {
        headers: { authorization: 'Bearer operator-fixture-credential' },
      });
      expect(inspected.status).toBe(200);
      const storedEnvelope = (await inspected.json()) as { findings: string[]; source: object };
      expect(storedEnvelope).toMatchObject({
        source: {
          harness,
          hostClass: 'unknown',
          projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          repository: 'github.com/arcadeai/safeword',
        },
      });
      expect(storedEnvelope.source).not.toHaveProperty('userIdentity');
      expect(storedEnvelope.source).not.toHaveProperty('agentVersion');
      expect(storedEnvelope.source).not.toHaveProperty('model');
      expect(storedEnvelope.findings).toHaveLength(3);
      expect(storedEnvelope.findings[0]).toContain('Lifecycle fixture finding');
      expect(storedEnvelope.findings[1]).toContain('Second lifecycle fixture finding');
      expect(storedEnvelope.findings[2]).toContain('Third lifecycle fixture finding');
      expect(storedEnvelope.findings.join('\n')).not.toContain(fixtureSecret);
      expect(storedEnvelope.findings.join('\n')).not.toContain('/Users/customer');
      expect(acceptCalls).toBe(1);

      const duplicate = await runHook(
        bun,
        hook,
        project,
        {
          ...controlledEnvironment,
          CLAUDE_PROJECT_DIR: project,
          CLI_PATH: path.join(buildDirectory, 'cli.js'),
          FINDINGS_PATH: findings,
          PATH: `${path.dirname(bun)}:/usr/bin:/bin`,
          SAFEWORD_RETRO_EXTRACT_CMD: wrapper,
          SESSION_ID: sessionId,
          TRANSCRIPT_PATH: transcript,
        },
        JSON.stringify({ session_id: sessionId, transcript_path: transcript, cwd: project }),
      );
      expect(duplicate).toMatchObject({ status: 0, stderr: '' });
      expect(acceptCalls).toBe(1);
      expect(readdirSync(attemptsDirectory)).toHaveLength(1);

      if (harness === 'cursor') {
        const distinctSessionId = `${sessionId}-distinct`;
        await primeCursorBinding(
          bun,
          project,
          controlledEnvironment,
          distinctSessionId,
          transcript,
        );
        const distinct = await runHook(
          bun,
          hook,
          project,
          {
            ...controlledEnvironment,
            CLI_PATH: path.join(buildDirectory, 'cli.js'),
            FINDINGS_PATH: findings,
            PATH: `${path.dirname(bun)}:/usr/bin:/bin`,
            SESSION_ID: distinctSessionId,
            TRANSCRIPT_PATH: transcript,
          },
          '{}',
        );
        expect(distinct).toMatchObject({ status: 0, stderr: '' });
        expect(acceptCalls).toBe(2);
        expect(readdirSync(attemptsDirectory)).toHaveLength(2);
      }

      writeFileSync(
        path.join(safewordDirectory, 'config.json'),
        JSON.stringify({
          projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          publicRetrospectiveCollection: false,
          selfReport: { surface: true },
        }),
      );
      const disabledSessionId = `${sessionId}-disabled`;
      await primeCursorBindingIfNeeded({
        bun,
        environment: controlledEnvironment,
        harness,
        project,
        sessionId: disabledSessionId,
        transcript,
      });
      const disabled = await runHook(
        bun,
        hook,
        project,
        {
          ...controlledEnvironment,
          CLAUDE_PROJECT_DIR: project,
          CLI_PATH: path.join(buildDirectory, 'cli.js'),
          FINDINGS_PATH: findings,
          PATH: `${path.dirname(bun)}:/usr/bin:/bin`,
          SAFEWORD_RETRO_EXTRACT_CMD: wrapper,
          SESSION_ID: disabledSessionId,
          TRANSCRIPT_PATH: transcript,
        },
        JSON.stringify({
          session_id: disabledSessionId,
          transcript_path: transcript,
          cwd: project,
        }),
      );
      expect(disabled).toMatchObject({ status: 0, stderr: '' });
      expect(acceptCalls).toBe(harness === 'cursor' ? 2 : 1);
      expect(readdirSync(attemptsDirectory)).toHaveLength(harness === 'cursor' ? 2 : 1);
    } finally {
      await collector.close();
    }
  },
  60_000,
);
