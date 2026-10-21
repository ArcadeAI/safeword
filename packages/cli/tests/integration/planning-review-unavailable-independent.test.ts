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

it('blocks planning fallback when the configured independent route is unavailable', async () => {
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
      crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }, { reviewer: 'claude' }] },
    }),
  );
  const ticket = '.project/tickets/UNA123-unavailable-independent-route';
  mkdirSync(nodePath.join(project, ticket), { recursive: true });
  writeFileSync(
    nodePath.join(project, ticket, 'ticket.md'),
    '---\nid: UNA123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve approval\nout_of_scope: anonymous approval\ndone_when: independent review precedes fallback\nphase_anchors:\n  - scenario-gate: features/unavailable-independent.feature\n---\n',
  );
  writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
  writeFileSync(
    nodePath.join(project, ticket, 'impl-plan.md'),
    '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve authenticated approval.\n\n## Decisions\n\nUse the current review receipt.\n\n## Design alignment\n\nEnsure independent review is attempted first.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
  );
  mkdirSync(nodePath.join(project, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(project, 'features/unavailable-independent.feature'),
    '@unavailable-independent.BU1.R1\nFeature: Independent first\n  Scenario: Independent route unavailable\n    Given the independent reviewer is not installed\n    When review runs\n    Then approval remains blocked\n',
  );
  const reviewer = createTrustedReviewerDirectory('safeword-unavailable-independent-');
  const invoked = nodePath.join(reviewer, 'invoked');
  writeFileSync(
    nodePath.join(reviewer, 'claude'),
    `#!${process.execPath}\nconst { writeFileSync } = require('node:fs');\nif (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }\nif (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }\nwriteFileSync(${JSON.stringify(invoked)}, 'yes');\nlet input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { input += chunk; }); process.stdin.on('end', () => { const packet = JSON.parse(input.trim().split('\\n').pop()); console.log(JSON.stringify({ structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude', verdict: 'approve', summary: 'Same-agent approval.', findings: [] } })); });\n`,
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
        SAFEWORD_AGENT_RUNTIME: 'claude',
        SAFEWORD_NO_UPDATE_CHECK: '1',
      },
    },
  );
  const output = JSON.parse(reviewed.stdout);
  expect(output.data).toMatchObject({ status: 'blocked', independence: 'none' });
  expect(output.findings).toContainEqual(
    expect.objectContaining({ code: 'REVIEW_ROUTES_EXHAUSTED' }),
  );
  expect(output.data.review_routes).toContainEqual(
    expect.objectContaining({ reviewer: 'codex', status: 'unavailable' }),
  );
  expect(existsSync(invoked)).toBe(false);
});
