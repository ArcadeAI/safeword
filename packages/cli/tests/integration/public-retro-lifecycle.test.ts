import { spawnSync } from 'node:child_process';
import {
  chmodSync,
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

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const CLI_PACKAGE = path.join(ROOT, 'packages/cli');
const CLAUDE_HOOK = path.join(CLI_PACKAGE, 'templates/hooks/stop-retro.ts');
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

it('runs installed Claude lifecycle through the real collector to a durable receipt', async () => {
  const project = mkdtempSync(path.join(tmpdir(), 'public-retro-lifecycle-'));
  const buildDirectory = mkdtempSync(path.join(CLI_PACKAGE, '.public-retro-build-'));
  temporaryDirectories.push(project, buildDirectory);
  const safewordDirectory = path.join(project, '.safeword');
  const attemptsDirectory = path.join(safewordDirectory, 'retro-attempts');
  mkdirSync(attemptsDirectory, { recursive: true });
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
  writeFileSync(
    findings,
    JSON.stringify([
      {
        category: 'rough-edge',
        title: 'Lifecycle fixture finding',
        safeword_surface: 'process/retro-delivery',
        what_happened: 'The lifecycle fixture observed a delivery handoff.',
        why_friction: 'A missing receipt would lose the retrospective.',
        repro: 'Complete a supported local session.',
      },
    ]),
  );
  const collector = await startPublicRetroCollector({
    databasePath: path.join(project, 'collector.sqlite'),
    operatorCredential: 'operator-fixture-credential',
  });

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
    const wrapper = path.join(project, 'extraction-fixture.mjs');
    writeFileSync(
      wrapper,
      `#!${process.execPath}\nimport { spawnSync } from 'node:child_process';\nconst args = process.argv.slice(2).filter(arg => arg !== '--auto-extract');\nargs.push('--findings', process.env.FINDINGS_PATH);\nconst result = spawnSync(process.execPath, [process.env.CLI_PATH, ...args], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });\nprocess.exit(result.status ?? 1);\n`,
    );
    chmodSync(wrapper, 0o755);
    const transcript = completedClaudeTranscript(project);
    const bun = spawnSync('which', ['bun'], { encoding: 'utf8' }).stdout.trim();
    const result = spawnSync(bun, [CLAUDE_HOOK], {
      cwd: project,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: project,
        CLI_PATH: path.join(buildDirectory, 'cli.js'),
        FINDINGS_PATH: findings,
        GITHUB_TOKEN: 'proxy-injected',
        PATH: '/usr/bin:/bin',
        SAFEWORD_RETRO_EXTRACT_CMD: wrapper,
      },
      input: JSON.stringify({ session_id: 'local-session', transcript_path: transcript }),
    });

    expect(result).toMatchObject({ status: 0, stdout: '', stderr: '' });
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
    await expect(inspected.json()).resolves.toMatchObject({
      source: {
        harness: 'claude-code',
        hostClass: 'local',
        projectUUID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      },
    });
  } finally {
    await collector.close();
  }
}, 60_000);
