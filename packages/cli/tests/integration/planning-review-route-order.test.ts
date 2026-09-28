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

it.each([
  ['claude', 'codex', false],
  ['codex', 'claude', false],
  ['claude', 'codex', true],
  ['codex', 'claude', true],
] as const)(
  'tries the independent reviewer before fallback when %s precedes %s and codex failure is %s',
  async (first, second, codexFails) => {
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
        crossAgentReviewRoutes: { claude: [{ reviewer: first }, { reviewer: second }] },
      }),
    );
    const ticket = '.project/tickets/ORD123-independent-first';
    mkdirSync(nodePath.join(project, ticket), { recursive: true });
    writeFileSync(
      nodePath.join(project, ticket, 'ticket.md'),
      '---\nid: ORD123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve independent review\nout_of_scope: bypassing review\ndone_when: independent review runs first\nphase_anchors:\n  - scenario-gate: features/independent-first.feature\n---\n',
    );
    writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
    writeFileSync(
      nodePath.join(project, ticket, 'impl-plan.md'),
      '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve independent-first review.\n\n## Decisions\n\nUse the current review receipt.\n\n## Design alignment\n\nEnsure independent review is attempted first.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
    );
    mkdirSync(nodePath.join(project, 'features'), { recursive: true });
    writeFileSync(
      nodePath.join(project, 'features/independent-first.feature'),
      '@independent-first.BU1.R1\nFeature: Independent first\n  Scenario: Available independent route\n    Given both routes are available\n    When review runs\n    Then independent review runs first\n',
    );
    const reviewer = createTrustedReviewerDirectory('safeword-route-order-');
    const sameAgentInvoked = nodePath.join(reviewer, 'same-agent-invoked');
    const independentInvoked = nodePath.join(reviewer, 'independent-invoked');
    for (const agent of ['claude', 'codex'] as const) {
      const marker = agent === 'claude' ? sameAgentInvoked : independentInvoked;
      writeFileSync(
        nodePath.join(reviewer, agent),
        `#!${process.execPath}\nconst { writeFileSync } = require('node:fs');\nif (process.argv.includes('--version')) { console.log('${agent} 1.0.0'); process.exit(0); }\nif (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES[agent])}); process.exit(0); }\nwriteFileSync(${JSON.stringify(marker)}, 'yes');\n${agent === 'codex' && codexFails ? 'process.exit(7);' : ''}\nlet input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { input += chunk; }); process.stdin.on('end', () => { const packet = JSON.parse(input.trim().split('\\n').pop()); const output = { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: '${agent}', verdict: 'approve', summary: 'Review approved.', findings: [] }; console.log(JSON.stringify('${agent}' === 'codex' ? { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(output) } } : { structured_output: output })); });\n`,
        { mode: 0o755 },
      );
    }
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
    expect(output.data).toMatchObject({
      status: 'approved',
      actual_reviewer: codexFails ? 'claude' : 'codex',
      independence: codexFails ? 'reduced' : 'cross-agent',
    });
    expect(existsSync(independentInvoked)).toBe(true);
    expect(existsSync(sameAgentInvoked)).toBe(codexFails);
    if (codexFails) {
      expect(output.findings).toContainEqual(
        expect.objectContaining({ code: 'REVIEW_INDEPENDENCE_REDUCED' }),
      );
      expect(
        output.findings.some(
          (finding: { code: string; message: string }) =>
            /degraded/iu.test(`${finding.code} ${finding.message}`) ||
            /was not independent/iu.test(finding.message),
        ),
      ).toBe(false);
    }
  },
);
