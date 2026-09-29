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

describe('planning fallback after independent route exhaustion', () => {
  async function reviewThroughAdmission(
    hostContinuation: boolean,
  ): Promise<Record<string, unknown>> {
    const project = createTemporaryDirectory();
    projects.push(project);
    await createConfiguredProject(project);
    writePlanningInventories(project);
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
      `#!${process.execPath}\nif (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }\nif (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }\nif (${hostContinuation}) process.exit(7);\nlet input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { input += chunk; }); process.stdin.on('end', () => { const packet = JSON.parse(input.trim().split('\\n').pop()); console.log(JSON.stringify({ structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude', verdict: 'approve', summary: 'Current plan approved.', findings: [] } })); });\n`,
      { mode: 0o755 },
    );
    const target = `${ticket}/impl-plan.md`;
    const keyRoot = nodePath.join(project, '.review-keys');
    const environment = {
      PATH: `${reviewer}:/usr/bin:/bin`,
      SAFEWORD_AGENT_RUNTIME: 'claude',
      CLAUDE_PLUGIN_ROOT: reviewer,
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
    if (hostContinuation) {
      expect(output.data).toMatchObject({
        status: 'continuation_required',
        continuation: { tier: 'fresh-context', packet: { kind: 'plan-implementation' } },
      });
      const reviewOutput = {
        schema_version: 1,
        dispatch_id: output.data.continuation.packet.dispatch_id,
        reviewer_agent: 'claude',
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
          'fresh-context',
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
      actual_reviewer: 'claude',
      independence: 'reduced',
    });
    expect(output.findings).not.toContainEqual(
      expect.objectContaining({ code: 'REVIEW_INDEPENDENCE_DEGRADED' }),
    );
    const stamp = spawnSync(
      'bun',
      [
        nodePath.join(project, '.safeword/hooks/write-review-stamp.ts'),
        '--ticket',
        'FAL123-fallback',
        '--author-agent',
        'claude',
        '--reviewer-agent',
        'claude',
        '--independence',
        'reduced',
        '--review-id',
        output.data.review_id,
        '--phase',
        'plan-implementation',
      ],
      {
        cwd: project,
        encoding: 'utf8',
        env: {
          ...process.env,
          ...environment,
          CLAUDE_PROJECT_DIR: project,
          CLAUDE_SESSION_ID: 'fallback-fixture',
        },
      },
    );
    if (stamp.status !== 0) {
      throw new Error(`stamp failed: ${stamp.stdout}\n${stamp.stderr}\n${stamp.error ?? ''}`);
    }
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

  it('admits a sealed fresh-host review only after independent and headless routes fail', async () => {
    expect(await reviewThroughAdmission(true)).toMatchObject({ achieved_independence: 'reduced' });
  });
});
