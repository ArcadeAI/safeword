import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
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

it.each(['prefer', 'require'] as const)(
  'labels a Codex-authored planning review with unknown author capability under %s',
  async policy => {
    const project = createTemporaryDirectory();
    projects.push(project);
    await createConfiguredProject(project);
    writePlanningInventories(project);
    const configPath = nodePath.join(project, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReview: policy,
        crossAgentReviewRoutes: { codex: [{ reviewer: 'claude' }] },
      }),
    );
    const ticket = '.project/tickets/AUT123-unknown-author-capability';
    mkdirSync(nodePath.join(project, ticket), { recursive: true });
    writeFileSync(
      nodePath.join(project, ticket, 'ticket.md'),
      '---\nid: AUT123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve approval\nout_of_scope: anonymous approval\ndone_when: unknown author capability is explicit\nphase_anchors:\n  - scenario-gate: features/author-capability.feature\n---\n',
    );
    writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
    writeFileSync(
      nodePath.join(project, ticket, 'impl-plan.md'),
      '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve authenticated approval.\n\n## Decisions\n\nUse the current review receipt.\n\n## Design alignment\n\nEnsure independent review is attempted first.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
    );
    mkdirSync(nodePath.join(project, 'features'), { recursive: true });
    writeFileSync(
      nodePath.join(project, 'features/author-capability.feature'),
      '@author-capability.BU1.R1\nFeature: Capability truth\n  Scenario: Unknown author model\n    Given Codex has no verified author model\n    When a different reviewer approves\n    Then independence remains unverified\n',
    );
    const reviewer = createTrustedReviewerDirectory('safeword-author-capability-');
    const invoked = nodePath.join(reviewer, 'invoked');
    writeFileSync(
      nodePath.join(reviewer, 'claude'),
      `#!${process.execPath}\nconst { writeFileSync } = require('node:fs');\nif (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }\nif (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }\nwriteFileSync(${JSON.stringify(invoked)}, 'yes');\nlet input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { input += chunk; }); process.stdin.on('end', () => { const packet = JSON.parse(input.trim().split('\\n').pop()); console.log(JSON.stringify({ structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude', verdict: 'approve', summary: 'Reviewer approval.', findings: [{ severity: 'warning', message: 'Check the migration note.' }] } })); });\n`,
      { mode: 0o755 },
    );
    const reviewed = await runCli(
      [
        'review',
        'run',
        'plan-implementation',
        `${ticket}/impl-plan.md`,
        '--context',
        `${ticket}/spec.md`,
        '--cwd',
        project,
        '--json',
        '--no-input',
      ],
      {
        cwd: project,
        env: {
          PATH: `${reviewer}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );
    const output = JSON.parse(reviewed.stdout);
    expect(reviewed.exitCode).toBe(policy === 'prefer' ? 0 : 2);
    expect(output.state).toBe(policy === 'prefer' ? 'healthy' : 'action_required');
    expect(output.data).toMatchObject({
      status: policy === 'prefer' ? 'approved' : 'blocked',
      independence: policy === 'prefer' ? 'reduced' : 'none',
      actual_reviewer: 'claude',
      capability_failure: 'author_capability_unknown',
    });
    expect(output.findings).toContainEqual(
      expect.objectContaining({ code: 'AUTHOR_CAPABILITY_UNKNOWN' }),
    );
    expect(output.findings).toContainEqual(
      expect.objectContaining({ code: 'REVIEWER_FINDING', message: 'Check the migration note.' }),
    );
    expect(existsSync(invoked)).toBe(true);
  },
);
