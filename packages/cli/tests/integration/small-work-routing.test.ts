import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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
  sourceHookEnvironment,
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

  function initializeRepo() {
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

  it.each([
    { type: 'task', changesSharedContract: true },
    { type: 'feature', changesSharedContract: true },
    { type: 'task', changesSharedContract: false },
  ] as const)(
    'reconciles a $type at intake after a ticket edit (public contract changed: $changesSharedContract)',
    async ({ type, changesSharedContract }) => {
      initializeRepo();
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
        scope: changesSharedContract
          ? 'Rename a public response field'
          : 'Correct a private helper',
        outcome: changesSharedContract
          ? 'Publish the replacement field'
          : 'Return the correct value',
        decisions: Object.fromEntries(consequentialDecisions.map(name => [name, 'settled'])),
        introducesUserFlow: false,
        multipleUserFlows: false,
        newPersistentState: false,
        changesSharedContract,
        changesBehavior: true,
        verification: 'new-regression',
      };
      const original = readFileSync(ticket, 'utf8').replace('type: task', () => `type: ${type}`);
      const ticketWithFacts = `${original}\n## Safeword small-work facts\n\n\`\`\`json\n${JSON.stringify(facts)}\n\`\`\`\n`;
      const edited =
        type === 'feature' ? ticketWithFacts.replaceAll('\n', '\r\n') : ticketWithFacts;
      const notify = (content = edited) =>
        spawnHookScript(nodePath.join(project, '.safeword/hooks/post-tool-quality.ts'), project, {
          session_id: sessionId,
          tool_name: 'Write',
          tool_input: { file_path: ticket, content },
        });
      if (type === 'task' && changesSharedContract) {
        const incomplete = edited.replace(JSON.stringify(facts), '{}');
        writeFileSync(ticket, incomplete);
        const draftEdit = notify(incomplete);
        expect(draftEdit.status, draftEdit.stderr).toBe(0);
        expect(draftEdit.stdout).not.toContain('Small-work classification');
        expect(readFileSync(ticket, 'utf8')).toBe(incomplete);

        const mergeHead = nodePath.join(project, '.git', 'MERGE_HEAD');
        writeFileSync(mergeHead, `${git('rev-parse', 'HEAD')}\n`);
        writeFileSync(ticket, edited);
        const mergeEdit = notify();
        expect(mergeEdit.status, mergeEdit.stderr).toBe(0);
        expect(mergeEdit.stdout).not.toContain('now needs feature planning');
        expect(readFileSync(ticket, 'utf8')).toBe(edited);
        unlinkSync(mergeHead);
      }
      writeFileSync(ticket, edited);
      const first = notify();
      expect(first.status, first.stderr).toBe(0);
      const promoted = readFileSync(ticket, 'utf8');
      if (!changesSharedContract) {
        expect(promoted).toBe(edited);
        expect(first.stdout).not.toContain('now needs feature planning');
        return;
      }
      expect(promoted, first.stderr || first.stdout).toMatch(/^type: feature$/m);
      expect(first.stdout).toContain('shared public contract changes');
      expect(first.stdout).toContain('Reread the ticket before editing it again.');
      if (type === 'feature') expect(promoted.replaceAll('\r\n', '')).not.toContain('\n');
      expect(promoted).toMatch(/^phase: define-behavior$/m);
      expect(promoted).toMatch(/^small_work_pending_phase: plan-implementation$/m);
      expect(promoted).toContain(`id: ${ticketId}`);
      expect(promoted).toContain(JSON.stringify(facts));
      expect(notify().stdout).not.toContain('shared public contract changes');
      expect(readFileSync(ticket, 'utf8')).toBe(promoted);
    },
  );

  async function verifyDesignPromotion(alreadyApproved: boolean) {
    initializeRepo();
    const install = await runCli(['install', '--agents=cursor', '--no-modify', '--offline'], {
      cwd: project,
    });
    expect(install.exitCode, install.stderr).toBe(0);
    const creation = await runCli(['ticket', 'new', slug, '--type', 'task'], { cwd: project });
    expect(creation.exitCode, creation.stderr).toBe(0);
    const ticketId = ticketIdBySlug(project, slug);
    const directory = ticketFolderBySlug(project, slug);
    const ticket = nodePath.join(directory, 'ticket.md');
    const scenario = nodePath.join(directory, 'approved.feature');
    writeFileSync(
      scenario,
      'Feature: Response behavior\n  Scenario: Existing consumer\n    Then the existing response stays readable\n',
    );
    writeFileSync(
      nodePath.join(directory, 'test-definitions.md'),
      `Feature source: \`${nodePath.relative(project, scenario)}\`\n`,
    );
    const linkedProof = '\n## Investigation\n\nRED: existing caller reads the ready field.\n';
    const facts = {
      schemaVersion: 1,
      scope: 'Resolve response contract design',
      outcome: 'Preserve approved consumer behavior',
      decisions: Object.fromEntries(consequentialDecisions.map(name => [name, 'settled'])),
      introducesUserFlow: false,
      multipleUserFlows: false,
      newPersistentState: false,
      changesSharedContract: true,
      changesBehavior: true,
      verification: 'new-regression',
    };
    writeFileSync(
      ticket,
      `${readFileSync(ticket, 'utf8')}${linkedProof}\n## Safeword small-work facts\n\n\`\`\`json\n${JSON.stringify(facts)}\n\`\`\`\n`,
    );
    const coordinator = nodePath.join(fixture, 'coordinator.js');
    const statusFile = nodePath.join(fixture, 'receipt.json');
    writeFileSync(
      coordinator,
      `console.log(await Bun.file(${JSON.stringify(statusFile)}).text());`,
    );
    const reviewId = 'fixture-scenario-review';
    const publishStatus = (status: string, target = scenario) => {
      writeFileSync(
        statusFile,
        JSON.stringify({
          data: {
            review_id: reviewId,
            status,
            review_kind: 'scenario-gate',
            review_targets: [target],
            author_agent: 'claude',
            actual_reviewer: 'codex',
            independence: 'cross-agent',
          },
        }),
      );
      writeFileSync(
        nodePath.join(project, '.project', 'skill-invocations.log'),
        `2026-11-23T00:00:00Z fixture review:${nodePath.basename(directory)}:phase@scenario-gate author:claude reviewer:codex independence:cross-agent review-id:${reviewId}\n`,
      );
    };
    const resume = (session: string) => {
      const result = spawnSync(
        'bun',
        [nodePath.join(project, '.safeword/hooks/post-tool-quality.ts')],
        {
          cwd: project,
          encoding: 'utf8',
          env: sourceHookEnvironment(project, { SAFEWORD_PLUGIN_CLI: coordinator }),
          input: JSON.stringify({
            session_id: session,
            tool_name: 'Write',
            tool_input: { file_path: ticket, content: readFileSync(ticket, 'utf8') },
          }),
        },
      );
      expect(result.status, result.stderr).toBe(0);
      return readFileSync(ticket, 'utf8');
    };
    if (alreadyApproved) {
      publishStatus('approved');
    } else {
      const promoted = resume('promotion');
      expect(promoted).toMatch(/^phase: define-behavior$/m);
      expect(promoted).toMatch(/^small_work_pending_phase: plan-implementation$/m);
      writeFileSync(ticket, promoted.replace('phase: define-behavior', 'phase: scenario-gate'));
      publishStatus('stale');
      const waiting = resume('restart-with-stale-approval');
      expect(waiting).toMatch(/^phase: scenario-gate$/m);
      expect(waiting).toMatch(/^small_work_pending_phase: plan-implementation$/m);
      writeFileSync(nodePath.join(project, '.safeword', 'config.json'), '{"reviewGate":false}');
      const manualAdvance = editDecision(
        nodePath.relative(project, ticket),
        waiting.replace('phase: scenario-gate', 'phase: plan-implementation'),
      );
      expect(manualAdvance.permission).toBe('deny');
      expect(manualAdvance.agent_message).toContain('waiting for current approval');
      const unrelated = nodePath.join(directory, 'unrelated.feature');
      writeFileSync(unrelated, 'Feature: Unrelated behavior\n');
      publishStatus('approved', unrelated);
      expect(resume('restart-with-unrelated-approval')).toBe(waiting);
      publishStatus('approved');
    }
    const planned = resume('restart-with-current-approval');
    expect(planned).toContain(`id: ${ticketId}\n`);
    expect(planned).toMatch(/^type: feature$/m);
    expect(planned).not.toContain('small_work_pending_phase:');
    expect(planned).toContain(linkedProof);
    expect(resume('another-restart')).toBe(planned);
    return planned;
  }

  it('promotes public-contract design immediately with current behavior approval', async () => {
    const planned = await verifyDesignPromotion(true);
    expect(planned).toMatch(/^phase: plan-implementation$/m);
  });

  it('resumes the saved design destination only after current behavior approval', async () => {
    const planned = await verifyDesignPromotion(false);
    expect(planned).toMatch(/^phase: plan-implementation$/m);
  });

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
