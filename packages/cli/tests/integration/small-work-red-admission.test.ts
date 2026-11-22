import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { consequentialDecisions } from '../../templates/hooks/lib/small-work-classification.js';
import {
  createTemporaryDirectory,
  expectHookAllow,
  expectHookDeny,
  removeTemporaryDirectory,
  runCli,
  spawnHookScript,
  ticketFolderBySlug,
  ticketIdBySlug,
} from '../helpers.js';

describe('installed small-work RED admission', () => {
  const slug = 'retry-after-timeout';
  const session = 'small-work-red';
  let fixture: string;

  beforeEach(() => {
    fixture = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(fixture);
  });

  it('requires the current observed failure and matching relevance before the first edit', async () => {
    const project = nodePath.join(fixture, 'project');
    mkdirSync(project);
    const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
    const environment = {
      NODE_ENV: 'test',
      SAFEWORD_PLUGIN_CLI: cli,
      SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(fixture, 'keys'),
      CLAUDE_PROJECT_DIR: project,
    };
    const run = (args: string[]) => runCli([...args, '--json'], { cwd: project, env: environment });
    const install = await run(['install', '--agents=cursor', '--no-modify', '--offline']);
    expect(install.exitCode, install.stderr).toBe(0);

    const entryPoint = 'src/retry.ts';
    const realTest = './tests/retry.test.ts';
    const unrelatedTest = './tests/unrelated.test.ts';
    const expectedFailure = 'expected two attempts';
    mkdirSync(nodePath.join(project, 'src'));
    mkdirSync(nodePath.join(project, 'tests'));
    writeFileSync(nodePath.join(project, entryPoint), 'export const attempts = () => 1;\n');
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('add', '.');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'before the test',
    );
    const baselineRevision = git('rev-parse', 'HEAD');
    writeFileSync(
      nodePath.join(project, realTest),
      `import { test } from 'bun:test';
import { attempts } from '../src/retry';
test('retry after timeout', () => {
  if (attempts() !== 2) throw new Error('${expectedFailure}');
});\n`,
    );
    writeFileSync(
      nodePath.join(project, unrelatedTest),
      `import { test } from 'bun:test';
test('unrelated', () => { throw new Error('${expectedFailure}'); });\n`,
    );

    const creation = await run(['ticket', 'new', slug, '--type', 'task', '--goal', 'Retry once']);
    expect(creation.exitCode, creation.stderr).toBe(0);
    const id = ticketIdBySlug(project, slug);
    const ticket = nodePath.join(ticketFolderBySlug(project, slug), 'ticket.md');
    const original = readFileSync(ticket, 'utf8');
    const contract = {
      schemaVersion: 1,
      scope: 'Private retry correction',
      outcome: 'Two attempts after a timeout',
      decisions: Object.fromEntries(consequentialDecisions.map(decision => [decision, 'settled'])),
      introducesUserFlow: false,
      multipleUserFlows: false,
      newPersistentState: false,
      changesSharedContract: false,
      changesBehavior: true,
      verification: 'new-regression',
    };
    const evaluation = {
      base: baselineRevision,
      fileLimit: 2,
      surfaceLimit: 1,
      aboveFileLimit: true,
      aboveSurfaceLimit: false,
      declaredSurfaces: ['CLI'],
      surfacePaths: [entryPoint, 'tests/retry.test.ts', 'tests/unrelated.test.ts'].map(path => ({
        path,
        surfaces: ['CLI'],
      })),
    };
    const writeFacts = (proof?: unknown) => {
      writeFileSync(
        ticket,
        `${original}\n## Safeword small-work facts\n\n\`\`\`json\n${JSON.stringify({
          ...contract,
          evaluation,
          proof,
        })}\n\`\`\`\n`,
      );
    };
    writeFileSync(
      nodePath.join(project, '.project', `quality-state-cursor-${session}.json`),
      JSON.stringify({
        activeTicket: id,
        locSinceCommit: 0,
        lastCommitHash: '',
        recentFailures: [],
        incrementedPatterns: [],
      }),
    );
    const editDecision = () => {
      const result = spawnSync('bun', ['.safeword/hooks/cursor/pre-tool-quality.ts'], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, ...environment },
        timeout: 15_000,
        input: JSON.stringify({
          conversation_id: session,
          workspace_roots: [project],
          tool_name: 'Write',
          tool_input: {
            file_path: nodePath.join(project, entryPoint),
            content: 'export const attempts = () => 2;\n',
          },
        }),
      });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as { permission: string; agent_message?: string };
    };
    writeFacts();
    expect(editDecision().permission).toBe('deny');
    writeFileSync(
      nodePath.join(project, '.project', `quality-state-${session}.json`),
      JSON.stringify({ activeTicket: id }),
    );
    const claudeDecision = (tool_name: string, tool_input: Record<string, string>) =>
      spawnHookScript(
        nodePath.resolve(import.meta.dirname, '../../templates/hooks/pre-tool-quality.ts'),
        project,
        { cwd: project, session_id: session, tool_name, tool_input },
      );
    const shellDecision = (command: string) => claudeDecision('Bash', { command });
    expectHookDeny(
      shellDecision(`printf '%s' replacement > ${entryPoint}`),
      'Use the native file edit tool',
    );
    expectHookAllow(shellDecision(`bun test ${realTest}`));
    expectHookAllow(shellDecision(`cat ${entryPoint}`));
    expectHookAllow(shellDecision(`printf '%s' test > ${realTest}`));
    expectHookDeny(
      claudeDecision('Write', {
        file_path: nodePath.join(project, entryPoint),
        content: 'export const attempts = () => 2;\n',
      }),
      'failing',
    );

    const request = {
      ticket: id,
      contractDigest: createHash('sha256').update(JSON.stringify(contract)).digest('hex'),
      argv: ['bun', 'test', realTest],
      cwd: '.',
      target: realTest,
      entryPoint,
      baselineRevision,
      inputs: [],
      expectedFailure,
    };
    const observe = async (target: string) => {
      const result = await run([
        'ticket',
        'observe-small-work-proof',
        JSON.stringify({ ...request, target, argv: ['bun', 'test', target] }),
      ]);
      expect(result.exitCode, result.stderr || result.stdout).toBe(0);
      const payload = JSON.parse(result.stdout).data;
      expect(payload.observation.expectedFailureObserved).toBe(true);
      return payload.observation;
    };
    const record = (
      observation: { tag: string },
      options: { relevanceTag?: string; relevant?: boolean; testTarget?: string } = {},
    ) => {
      writeFacts({
        request:
          options.testTarget === undefined ? request : { ...request, target: options.testTarget },
        observation,
        relevance: {
          observationTag: options.relevanceTag ?? observation.tag,
          relevant: options.relevant ?? true,
          explanation: 'The target calls the existing retry operation and expected two attempts.',
        },
      });
    };

    record(await observe(unrelatedTest));
    expect(editDecision().permission).toBe('deny');
    const intended = await observe(realTest);
    record(intended, { relevanceTag: 'f'.repeat(64) });
    expect(editDecision().permission).toBe('deny');
    record(intended, { relevant: false });
    expect(editDecision().permission).toBe('deny');
    record(intended, { testTarget: unrelatedTest });
    expect(editDecision().permission).toBe('deny');
    const validTest = readFileSync(nodePath.join(project, realTest), 'utf8');
    writeFileSync(
      nodePath.join(project, realTest),
      `throw new Error('${expectedFailure}');\n${validTest}`,
    );
    record(await observe(realTest), { relevant: false });
    expect(editDecision().permission).toBe('deny');
    writeFileSync(nodePath.join(project, realTest), validTest);

    const invented = await run([
      'ticket',
      'observe-small-work-proof',
      JSON.stringify({ ...request, entryPoint: realTest }),
    ]);
    expect(invented.exitCode).toBe(1);

    record(intended);
    const admitted = editDecision();
    expect(admitted.permission, admitted.agent_message).toBe('allow');

    writeFileSync(nodePath.join(project, entryPoint), 'export const attempts = () => 2;\n');
    const green = spawnSync('bun', ['test', realTest], { cwd: project, encoding: 'utf8' });
    expect(green.status, green.stderr).toBe(0);
    expect(editDecision().permission).toBe('allow');
    writeFileSync(nodePath.join(project, realTest), '// changed after the observed run\n');
    expect(editDecision().permission).toBe('deny');
  }, 60_000);
});
