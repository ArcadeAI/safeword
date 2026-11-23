import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  consequentialDecisions,
  type SmallWorkFacts,
} from '../../templates/hooks/lib/small-work-classification.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  spawnHookScript,
  ticketFolderBySlug,
  ticketIdBySlug,
} from '../helpers.js';

describe('installed small-work routing', () => {
  const slug = 'polish-command-output';
  const sessionId = 'small-work-routing';
  let fixture: string;
  let project: string;

  beforeEach(() => {
    fixture = createTemporaryDirectory();
    project = nodePath.join(fixture, 'project');
    mkdirSync(project);
  });

  afterEach(() => {
    removeTemporaryDirectory(fixture);
  });

  function environment() {
    return {
      NODE_ENV: 'test',
      SAFEWORD_PLUGIN_CLI: nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
      SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(fixture, 'keys'),
      CLAUDE_PROJECT_DIR: project,
    };
  }

  function git(...args: string[]): string {
    return execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
  }

  function editDecision(path: string, content: string) {
    const decision = spawnSync('bun', ['.safeword/hooks/cursor/pre-tool-quality.ts'], {
      cwd: project,
      encoding: 'utf8',
      timeout: 15_000,
      env: { ...process.env, ...environment() },
      input: JSON.stringify({
        conversation_id: sessionId,
        workspace_roots: [project],
        tool_name: 'Write',
        tool_input: { file_path: nodePath.join(project, path), content },
      }),
    });
    expect(decision.status, decision.stderr).toBe(0);
    return JSON.parse(decision.stdout) as { permission: string; agent_message: string };
  }

  async function passingProof(ticketId: string, facts: object) {
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
      'baseline',
    );
    const target = './status.test.ts';
    writeFileSync(
      nodePath.join(project, target),
      `import { test } from 'bun:test';
import { ready } from './src/caller';
test('public status stays ready', () => {
  if (ready !== true) throw new Error('status contract changed');
});
`,
    );
    const request = {
      ticket: ticketId,
      contractDigest: createHash('sha256').update(JSON.stringify(facts)).digest('hex'),
      argv: ['bun', 'test', target],
      cwd: '.',
      entryPoint: 'src/status.ts',
      baselineRevision: git('rev-parse', 'HEAD'),
      target,
      inputs: ['src/caller.ts'],
      expectation: 'pass',
      expectedFailure: '',
    };
    const result = await runCli(
      ['ticket', 'observe-small-work-proof', JSON.stringify(request), '--json'],
      { cwd: project, env: environment() },
    );
    expect(result.exitCode, result.stderr || result.stdout).toBe(0);
    const { observation } = JSON.parse(result.stdout).data;
    expect(observation.passingRunObserved).toBe(true);
    return {
      evaluation: {
        base: request.baselineRevision,
        fileLimit: 2,
        surfaceLimit: 1,
        aboveFileLimit: false,
        aboveSurfaceLimit: false,
        declaredSurfaces: ['CLI'],
        surfacePaths: [
          ...['src/status.ts', 'status.test.ts', 'src/a.ts', 'src/b.ts'].map(path => ({
            path,
            surfaces: ['CLI'],
          })),
          { path: 'src/ui.ts', surfaces: ['Cursor'] },
        ],
      },
      request,
      observation,
      relevance: {
        observationTag: observation.tag,
        relevant: true,
        explanation: 'The public caller returns ready and the assertion fails if it changes.',
      },
    };
  }

  it.each(['task', 'feature'] as const)(
    'advances an in-progress %s at intake when a ticket edit records a public contract change',
    async type => {
      git('init', '-q');
      git(
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.test',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--allow-empty',
        '-qm',
        'baseline',
      );
      const installation = await runCli(
        ['install', '--agents=cursor', '--no-modify', '--offline'],
        { cwd: project },
      );
      expect(installation.exitCode, installation.stderr).toBe(0);
      const creation = await runCli(
        ['ticket', 'new', slug, '--type', 'task', '--goal', 'Rename a field'],
        {
          cwd: project,
        },
      );
      expect(creation.exitCode, creation.stderr).toBe(0);
      const ticketId = ticketIdBySlug(project, slug);
      const ticket = nodePath.join(ticketFolderBySlug(project, slug), 'ticket.md');
      const facts = {
        schemaVersion: 1,
        scope: 'Rename a public response field',
        outcome: 'Publish the replacement field',
        decisions: Object.fromEntries(consequentialDecisions.map(name => [name, 'settled'])),
        introducesUserFlow: false,
        multipleUserFlows: false,
        newPersistentState: false,
        changesSharedContract: true,
        changesBehavior: true,
        verification: 'new-regression',
      };
      const original = readFileSync(ticket, 'utf8').replace('type: task', () => `type: ${type}`);
      const edited = `${original}\n## Safeword small-work facts\n\n\`\`\`json\n${JSON.stringify(facts)}\n\`\`\`\n`;
      writeFileSync(ticket, edited);
      const notify = () =>
        spawnHookScript(nodePath.join(project, '.safeword/hooks/post-tool-quality.ts'), project, {
          session_id: sessionId,
          tool_name: 'Write',
          tool_input: { file_path: ticket, content: edited },
        });
      const first = notify();
      expect(first.status, first.stderr).toBe(0);
      const promoted = readFileSync(ticket, 'utf8');
      expect(promoted, first.stderr || first.stdout).toMatch(/^type: feature$/m);
      expect(first.stdout).toContain('shared public contract changes');
      expect(promoted).toMatch(/^phase: define-behavior$/m);
      expect(promoted).toMatch(/^small_work_pending_phase: plan-implementation$/m);
      expect(promoted).toContain(`id: ${ticketId}`);
      expect(promoted).toContain(JSON.stringify(facts));
      expect(notify().stdout).not.toContain('shared public contract changes');
      expect(readFileSync(ticket, 'utf8')).toBe(promoted);
    },
  );

  it.each(['public contract', 'private helper'] as const)(
    'checks a valid task at the installed edit boundary for a %s change',
    async boundary => {
      const publicContract = boundary === 'public contract';
      const installation = await runCli(
        ['install', '--agents=cursor', '--no-modify', '--offline'],
        {
          cwd: project,
        },
      );
      expect(installation.exitCode, installation.stderr).toBe(0);

      mkdirSync(nodePath.join(project, 'src'));
      writeFileSync(
        nodePath.join(project, 'src/status.ts'),
        'export const status = { ready: true };\n',
      );
      writeFileSync(
        nodePath.join(project, 'src/caller.ts'),
        "import { status } from './status';\nexport const ready = status.ready;\n",
      );
      const creation = await runCli(
        ['ticket', 'new', slug, '--type', 'task', '--goal', 'Polish the status command output'],
        { cwd: project },
      );
      expect(creation.exitCode, creation.stderr).toBe(0);

      const ticketId = ticketIdBySlug(project, slug);
      const ticket = nodePath.join(ticketFolderBySlug(project, slug), 'ticket.md');
      const declaration = readFileSync(ticket, 'utf8');
      expect(declaration).toMatch(/^type: task$/m);

      // This fixture supplies the discovery. Live host interpretation is a separate proof.
      const facts = {
        schemaVersion: 1,
        scope: 'Polish the status command output',
        outcome: 'Keep the existing caller working',
        decisions: Object.fromEntries(
          consequentialDecisions.map(decision => [
            decision,
            publicContract && decision === 'compatibility' ? 'unresolved' : 'settled',
          ]),
        ),
        introducesUserFlow: false,
        multipleUserFlows: false,
        newPersistentState: false,
        changesSharedContract: false,
        changesBehavior: publicContract,
        verification: 'new-regression',
      } satisfies Omit<SmallWorkFacts, 'decisions'> & { decisions: Record<string, string> };
      const classification = await runCli(
        ['ticket', 'classify-small-work', JSON.stringify(facts), '--json'],
        { cwd: project },
      );
      expect(classification.exitCode, classification.stderr).toBe(0);
      expect(JSON.parse(classification.stdout)).toMatchObject({
        data: { route: publicContract ? 'feature' : 'task' },
      });
      const observation = publicContract ? undefined : await passingProof(ticketId, facts);
      const { evaluation, ...proof } = observation ?? {};
      writeFileSync(
        ticket,
        `${declaration}\n## Inline test specification\n\n` +
          `- Expected behavior: Keep the JSON status readable by its caller.\n` +
          `- Proof boundary: src/caller.ts reads the status command response.\n` +
          `- Proof method: Exercise the caller with the status output.\n\n` +
          `## Discoveries\n\n${
            publicContract
              ? '- Compatibility is unresolved: src/caller.ts consumes the public `ready` field from src/status.ts.\n'
              : '- The caller still receives the same public `ready` field.\n'
          }\n## Safeword small-work facts\n\n\`\`\`json\n${JSON.stringify({ ...facts, evaluation, proof })}\n\`\`\`\n`,
      );
      writeFileSync(
        nodePath.join(project, '.project', `quality-state-cursor-${sessionId}.json`),
        JSON.stringify({
          activeTicket: ticketId,
          locSinceCommit: 0,
          lastCommitHash: '',
          recentFailures: [],
          incrementedPatterns: [],
        }),
      );

      const decision = editDecision(
        'src/status.ts',
        publicContract
          ? 'export const status = { available: true };\n'
          : 'const ready = () => true; export const status = { ready: ready() };\n',
      );
      expect(decision.permission, decision.agent_message).toBe(publicContract ? 'deny' : 'allow');
      const writtenTicket = readFileSync(ticket, 'utf8');
      expect(writtenTicket).toContain('## Discoveries');
      if (publicContract) {
        expect(decision.agent_message).toMatch(/compatib|contract/i);
        expect(writtenTicket).toMatch(/^type: feature$/m);
        expect(writtenTicket).toMatch(/^phase: define-behavior$/m);
        expect(writtenTicket).toMatch(/^small_work_pending_phase: plan-implementation$/m);
        expect(writtenTicket).toContain('src/caller.ts consumes');
      } else {
        expect(writtenTicket).toMatch(/^type: task$/m);
        const surfaces = editDecision('src/ui.ts', 'export const ui = true;');
        expect(surfaces.permission).toBe('deny');
        expect(surfaces.agent_message).toContain('file or surface threshold');

        writeFileSync(nodePath.join(project, 'src/a.ts'), 'export const a = true;');
        git('add', 'src/a.ts');
        git(
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.test',
          '-c',
          'commit.gpgsign=false',
          'commit',
          '-qm',
          'first admitted path',
        );
        const acrossCommit = editDecision('src/b.ts', 'export const b = true;');
        expect(acrossCommit.permission).toBe('deny');
        expect(acrossCommit.agent_message).toContain('file or surface threshold');

        const configFile = nodePath.join(project, '.safeword/config.json');
        const config = JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>;
        writeFileSync(
          configFile,
          JSON.stringify({ ...config, smallWorkThresholds: { files: 'two' } }),
        );
        const malformed = await runCli(
          ['ticket', 'classify-small-work', JSON.stringify(facts), '--json'],
          { cwd: project },
        );
        expect(malformed.exitCode).toBe(1);
        expect(JSON.parse(malformed.stdout)).toMatchObject({
          state: 'failed',
          errors: [{ code: 'INVALID_SMALL_WORK_THRESHOLDS' }],
        });
        const blocked = editDecision('src/status.ts', 'export const status = { ready: true };');
        expect(blocked.permission).toBe('deny');
        expect(blocked.agent_message).toContain('thresholds must be positive');
      }
    },
    60_000,
  );
});
