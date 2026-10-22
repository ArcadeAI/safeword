import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  runCli,
  testCliPath,
} from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const projects: string[] = [];

afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function assertPolicyFlip(
  enabled: boolean,
  project: string,
  ticket: string,
  environment: Record<string, string>,
): Promise<void> {
  if (!enabled) return;
  const configPath = nodePath.join(project, '.safeword/config.json');
  const previous = readFileSync(configPath, 'utf8');
  writeFileSync(
    configPath,
    JSON.stringify({ ...JSON.parse(previous), crossAgentReview: 'require' }),
  );
  const refused = await runCli(
    ['ticket', 'approve-plan', 'FAL123', '--cwd', project, '--json', '--no-input'],
    { cwd: project, env: environment },
  );
  expect(refused.exitCode, refused.stdout).toBe(2);
  expect(JSON.parse(refused.stdout).findings).toContainEqual(
    expect.objectContaining({
      message: expect.stringContaining('current require policy needs cross-agent review'),
    }),
  );
  expect(readFileSync(nodePath.join(project, ticket, 'ticket.md'), 'utf8')).toContain(
    'phase: plan-implementation',
  );
  writeFileSync(configPath, previous);
}

describe('planning fallback after independent route exhaustion', () => {
  // eslint-disable-next-line complexity -- The fixture exercises one end-to-end review and admission path across host variants.
  async function reviewThroughAdmission(
    hostContinuation: boolean,
    author: 'claude' | 'cursor' | 'opencode' = 'claude',
    independentOnly = false,
    failedFirstSameAgent = false,
    options: { selfReview?: boolean; flipPolicy?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    const project = createTemporaryDirectory();
    projects.push(project);
    await createConfiguredProject(project);
    writePlanningInventories(project);
    if (independentOnly || failedFirstSameAgent) {
      const configPath = nodePath.join(project, '.safeword/config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      writeFileSync(
        configPath,
        JSON.stringify({
          ...config,
          crossAgentReviewRoutes: {
            [author]: failedFirstSameAgent
              ? [
                  { reviewer: 'codex' },
                  { reviewer: 'claude', model: 'no-such-model' },
                  { reviewer: 'claude' },
                ]
              : [{ reviewer: 'codex', model: 'gpt-6-astra' }],
          },
        }),
      );
    }
    const ticket = '.project/tickets/FAL123-fallback';
    mkdirSync(nodePath.join(project, ticket), { recursive: true });
    writeFileSync(
      nodePath.join(project, ticket, 'ticket.md'),
      '---\nid: FAL123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve approval\nout_of_scope: anonymous approval\ndone_when: current review advances\nphase_anchors:\n  - scenario-gate: features/fallback.feature\n---\n',
    );
    writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
    writeFileSync(
      nodePath.join(project, ticket, 'impl-plan.md'),
      '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve authenticated approval.\n\n## Decisions\n\nUse the current review receipt.\n\n## Design alignment\n\nEnsure review is honest.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
    );
    mkdirSync(nodePath.join(project, 'features'), { recursive: true });
    writeFileSync(
      nodePath.join(project, 'features/fallback.feature'),
      '@fallback.BU1.R1\nFeature: Honest fallback\n  Scenario: Current review advances\n    Given a current review\n    When the builder advances\n    Then the achieved independence is recorded\n',
    );
    const reviewer = createTrustedReviewerDirectory('safeword-planning-fallback-');
    mkdirSync(nodePath.join(reviewer, 'runtime'));
    symlinkSync(testCliPath, nodePath.join(reviewer, 'runtime/cli.js'));
    const bun = spawnSync('which', ['bun'], { encoding: 'utf8' });
    expect(bun.status).toBe(0);
    symlinkSync(bun.stdout.trim(), nodePath.join(reviewer, 'bun'));
    writeFileSync(
      nodePath.join(reviewer, 'codex'),
      `#!${process.execPath}\nif (process.argv.includes('--version')) { console.log('codex 1.0.0'); process.exit(0); }\nif (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.codex)}); process.exit(0); }\nprocess.exit(7);\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      nodePath.join(reviewer, 'claude'),
      `#!${process.execPath}\nif (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }\nif (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }\nif (${hostContinuation} || process.argv.includes('no-such-model')) process.exit(7);\nlet input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { input += chunk; }); process.stdin.on('end', () => { const packet = JSON.parse(input.trim().split('\\n').pop()); console.log(JSON.stringify({ structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id, evidence_records: { schema_version: 1, records: [] }, reviewer_agent: 'claude', verdict: 'approve', summary: 'Current plan approved.', findings: [] } })); });\n`,
      { mode: 0o755 },
    );
    const target = `${ticket}/impl-plan.md`;
    const keyRoot = nodePath.join(reviewer, '.review-keys');
    const environment = {
      PATH: `${reviewer}:/usr/bin:/bin`,
      SAFEWORD_AGENT_RUNTIME: author,
      CLAUDE_PLUGIN_ROOT: reviewer,
      SAFEWORD_PLUGIN_CLI: nodePath.join(reviewer, 'runtime/cli.js'),
      SAFEWORD_REVIEW_KEY_ROOT: keyRoot,
      SAFEWORD_REVIEW_TIMEOUT_MS: '3000',
      SAFEWORD_REVIEW_RUN_BOUND_MS: '10000',
      SAFEWORD_NO_UPDATE_CHECK: '1',
    };
    const result = await runCli(
      [
        'review',
        'run',
        'plan-implementation',
        target,
        '--context',
        `${ticket}/spec.md`,
        '--cwd',
        project,
        '--json',
        '--no-input',
      ],
      {
        cwd: project,
        env: environment,
      },
    );
    const output = JSON.parse(result.stdout);
    if (failedFirstSameAgent) {
      expect(result.exitCode, result.stdout).toBe(0);
      expect(output.data.review_routes).toMatchObject([
        { reviewer: 'codex', status: 'attempted' },
        {
          reviewer: 'claude',
          model: 'no-such-model',
          status: 'attempted',
          failure: expect.any(String),
        },
        { reviewer: 'claude', status: 'attempted' },
      ]);
    }
    if (hostContinuation) {
      expect(output.data).toMatchObject({
        status: 'continuation_required',
        continuation: { tier: 'fresh-context', packet: { kind: 'plan-implementation' } },
      });
      if (options.selfReview) {
        const second = await runCli(
          [
            'review',
            'run',
            'plan-implementation',
            target,
            '--context',
            `${ticket}/spec.md`,
            '--cwd',
            project,
            '--json',
            '--no-input',
          ],
          { cwd: project, env: environment },
        );
        const secondOutput = JSON.parse(second.stdout);
        expect(secondOutput.data.status).toBe('continuation_required');
        expect(secondOutput.data.review_id).not.toBe(output.data.review_id);
        expect(secondOutput.data.continuation.packet.dispatch_id).not.toBe(
          output.data.continuation.packet.dispatch_id,
        );
        const failed = await runCli(
          [
            'review',
            'continue',
            output.data.review_id,
            '--tier',
            'fresh-context',
            '--failure',
            'unsupported',
            '--cwd',
            project,
            '--json',
            '--no-input',
          ],
          { cwd: project, env: environment },
        );
        expect(JSON.parse(failed.stdout).data).toMatchObject({
          status: 'continuation_required',
          continuation: {
            tier: 'self-review',
            packet: { dispatch_id: output.data.continuation.packet.dispatch_id },
          },
        });
      }
      const pending = await runCli(
        ['ticket', 'approve-plan', 'FAL123', '--cwd', project, '--json', '--no-input'],
        { cwd: project, env: environment },
      );
      expect(pending.exitCode).toBe(2);
      expect(readFileSync(nodePath.join(project, ticket, 'ticket.md'), 'utf8')).toContain(
        'phase: plan-implementation',
      );
      const reviewOutput = {
        schema_version: 1,
        dispatch_id: output.data.continuation.packet.dispatch_id,
        evidence_records: { schema_version: 1, records: [] },
        reviewer_agent: author,
        verdict: 'approve',
        summary: 'Current plan approved in a fresh host context.',
        findings: [],
      };
      writeFileSync(
        nodePath.join(project, 'host-review.json'),
        `${JSON.stringify(reviewOutput)}\n`,
      );
      const continued = await runCli(
        [
          'review',
          'continue',
          output.data.review_id,
          '--tier',
          options.selfReview ? 'self-review' : 'fresh-context',
          '--output',
          'host-review.json',
          '--offline',
          '--cwd',
          project,
          '--json',
          '--no-input',
        ],
        { cwd: project, env: environment },
      );
      expect(continued.exitCode, continued.stdout).toBe(0);
      Object.assign(output, JSON.parse(continued.stdout));
    }
    expect(output.data).toMatchObject({
      status: 'approved',
      review_kind: 'plan-implementation',
      actual_reviewer: author === 'opencode' ? 'claude' : author,
      independence: 'reduced',
    });
    expect(output.findings).not.toContainEqual(
      expect.objectContaining({ code: 'REVIEW_INDEPENDENCE_DEGRADED' }),
    );
    if (author === 'cursor') {
      const shellGate = spawnSync('bun', ['.safeword/hooks/cursor/before-shell-execution.ts'], {
        cwd: project,
        encoding: 'utf8',
        input: JSON.stringify({
          workspace_roots: [project],
          conversation_id: 'fallback-fixture',
          command: `bun "${project}/.safeword/hooks/write-review-stamp.ts" --phase plan-implementation`,
        }),
        env: { ...process.env, ...environment },
      });
      expect(shellGate.status, shellGate.stderr).toBe(0);
      expect(JSON.parse(shellGate.stdout)).toEqual({ permission: 'allow' });
    }
    const stampArguments = [
      nodePath.join(project, '.safeword/hooks/write-review-stamp.ts'),
      '--ticket',
      'FAL123-fallback',
      '--author-agent',
      author,
      '--reviewer-agent',
      author === 'opencode' ? 'claude' : author,
      '--independence',
      'reduced',
      '--review-id',
      output.data.review_id,
      '--phase',
      'plan-implementation',
    ];
    const stampOptions = {
      cwd: project,
      encoding: 'utf8' as const,
      env: {
        ...process.env,
        ...environment,
        CLAUDE_PROJECT_DIR: project,
        CLAUDE_SESSION_ID: author === 'claude' ? 'fallback-fixture' : undefined,
        CLAUDE_CODE_SESSION_ID: undefined,
        CODEX_THREAD_ID: undefined,
      },
    };
    if (author === 'opencode') {
      const unclaimed = [...stampArguments];
      unclaimed.splice(unclaimed.indexOf('--independence'), 2);
      const missingClaim = spawnSync('bun', unclaimed, stampOptions);
      expect(missingClaim.status).not.toBe(0);
      expect(missingClaim.stdout).toContain('missing run identity');
      const skipped = spawnSync(
        'bun',
        [...stampArguments, '--skip', 'review is unnecessary'],
        stampOptions,
      );
      expect(skipped.status).not.toBe(0);
      expect(skipped.stdout).toContain('missing run identity');
      const wrongReviewer = [...stampArguments];
      wrongReviewer[wrongReviewer.indexOf('--reviewer-agent') + 1] = 'opencode';
      const mismatched = spawnSync('bun', wrongReviewer, stampOptions);
      expect(mismatched.status).not.toBe(0);
      expect(mismatched.stdout).toContain('recorded "reviewer: claude"');
      const planPath = nodePath.join(project, target);
      const reviewedPlan = readFileSync(planPath, 'utf8');
      writeFileSync(planPath, `${reviewedPlan}\nChanged after review.\n`);
      const stale = spawnSync('bun', stampArguments, stampOptions);
      expect(stale.status).not.toBe(0);
      expect(stale.stdout).toContain('stale');
      writeFileSync(planPath, reviewedPlan);
      const forged = [...stampArguments];
      forged[forged.indexOf('--review-id') + 1] = '00000000-0000-4000-8000-000000000000';
      const rejected = spawnSync('bun', forged, stampOptions);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stdout).toContain('did not approve');
    }
    const stamp = spawnSync('bun', stampArguments, stampOptions);
    if (stamp.status !== 0) {
      throw new Error(`stamp failed: ${stamp.stdout}\n${stamp.stderr}\n${stamp.error ?? ''}`);
    }
    await assertPolicyFlip(options.flipPolicy === true, project, ticket, environment);
    const approved = await runCli(
      ['ticket', 'approve-plan', 'FAL123', '--cwd', project, '--json', '--no-input'],
      { cwd: project, env: environment },
    );
    expect(approved.exitCode, approved.stdout).toBe(0);
    expect(JSON.parse(approved.stdout).data).toMatchObject({ achieved_independence: 'reduced' });
    expect(readFileSync(nodePath.join(project, ticket, 'ticket.md'), 'utf8')).toContain(
      'phase: plan-execution',
    );
    return JSON.parse(approved.stdout).data as Record<string, unknown>;
  }

  it('records a successful same-agent headless review as reduced independence', async () => {
    expect(await reviewThroughAdmission(false)).toMatchObject({ achieved_independence: 'reduced' });
  });

  it('keeps a completed same-agent fallback after an earlier same-agent route fails', async () => {
    expect(await reviewThroughAdmission(false, 'claude', false, true)).toMatchObject({
      achieved_independence: 'reduced',
    });
  });

  it('admits a sealed fresh-host review only after independent and headless routes fail', async () => {
    expect(await reviewThroughAdmission(true)).toMatchObject({ achieved_independence: 'reduced' });
  });

  it('admits bounded self-review with reduced independence and distinct real job dispatches', async () => {
    expect(
      await reviewThroughAdmission(true, 'claude', false, false, { selfReview: true }),
    ).toMatchObject({ achieved_independence: 'reduced' });
  });

  it('refuses a reduced receipt after policy changes to require', async () => {
    expect(
      await reviewThroughAdmission(false, 'claude', false, false, { flipPolicy: true }),
    ).toMatchObject({ achieved_independence: 'reduced' });
  });

  it('admits fresh-host review after all configured independent routes fail without a headless route', async () => {
    expect(await reviewThroughAdmission(true, 'claude', true)).toMatchObject({
      achieved_independence: 'reduced',
    });
  });

  it('admits a Cursor host review through its shell bridge without a Claude session', async () => {
    expect(await reviewThroughAdmission(true, 'cursor')).toMatchObject({
      achieved_independence: 'reduced',
    });
  });

  it('admits an OpenCode-authored review through its authenticated receipt without a Claude session', async () => {
    expect(await reviewThroughAdmission(false, 'opencode')).toMatchObject({
      achieved_independence: 'reduced',
    });
  });
});
