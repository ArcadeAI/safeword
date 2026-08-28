import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { startPublicRetroCollector } from '../../../retro-collector/src/index.js';
import { PublicRetroStore } from '../../../retro-collector/src/store.js';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const CLI_PACKAGE = path.join(ROOT, 'packages/cli');
const HOOKS = {
  'claude-code': path.join(CLI_PACKAGE, 'templates/hooks/stop-retro.ts'),
  codex: path.join(CLI_PACKAGE, 'templates/hooks/codex/stop.ts'),
} as const;
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true });
  temporaryDirectories.length = 0;
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
        GIT_CONFIG_GLOBAL: path.join(project, 'missing-global-gitconfig'),
        HOME: path.join(project, 'empty-home'),
      };
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
      if (markerName === undefined) throw new Error('expected a public attempt marker');
      const marker = JSON.parse(readFileSync(path.join(attemptsDirectory, markerName), 'utf8')) as {
        receipt?: string;
      };
      expect(marker.receipt).toBeDefined();
      const inspected = await fetch(`${collector.url}/v1/public-retros/${marker.receipt}`, {
        headers: { authorization: 'Bearer operator-fixture-credential' },
      });
      expect(inspected.status).toBe(200);
      const storedEnvelope = (await inspected.json()) as { finding: string; source: object };
      expect(storedEnvelope).toMatchObject({
        source: {
          harness,
          hostClass: 'unknown',
          projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          repository: 'github.com/arcadeai/safeword',
        },
      });
      expect(storedEnvelope.source).not.toHaveProperty('userIdentity');
      expect(storedEnvelope.finding).not.toContain(fixtureSecret);
      expect(storedEnvelope.finding).not.toContain('/Users/customer');
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
