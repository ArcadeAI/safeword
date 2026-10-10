import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { reviewerScript } from '../fixtures/planning-reviewers.js';
import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
} from '../review-fixtures.js';

const projects: string[] = [];

afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
  cleanupTrustedReviewerDirectories();
});

it.each([
  ['claude', 'codex', false, 'absent', false],
  ['claude', 'codex', false, 'empty', false],
  ['codex', 'claude', false, 'absent', false],
  ['claude', 'codex', true, 'absent', false],
  ['codex', 'claude', true, 'absent', false],
  ['codex', 'claude', false, 'known', false],
  ['codex', 'claude', false, 'known', true],
] as const)(
  'tries the independent reviewer before fallback when %s precedes %s, codex failure is %s, author model is %s, and model is confirmed %s',
  // eslint-disable-next-line complexity -- The route-order matrix shares one real CLI fixture.
  async (first, second, codexFails, authorModelState, codexConfirmed) => {
    const authorKnown = authorModelState === 'known';
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
        crossAgentReviewRoutes: {
          claude: [
            {
              reviewer: first,
              ...(first === 'codex' && codexConfirmed && { model: 'gpt-6.1-sol' }),
            },
            { reviewer: second },
          ],
        },
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
    const packets = {
      claude: nodePath.join(reviewer, 'claude-packet.json'),
      codex: nodePath.join(reviewer, 'codex-packet.json'),
    };
    for (const agent of ['claude', 'codex'] as const) {
      const marker = agent === 'claude' ? sameAgentInvoked : independentInvoked;
      writeFileSync(
        nodePath.join(reviewer, agent),
        reviewerScript(agent, marker, packets[agent], codexFails, codexConfirmed),
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
          ...(authorKnown && { SAFEWORD_AUTHOR_MODEL: 'claude-opus-5' }),
          ...(authorModelState === 'empty' && { SAFEWORD_AUTHOR_MODEL: '' }),
        },
      },
    );
    const output = JSON.parse(reviewed.stdout);
    expect(output.data).toMatchObject({
      status: 'approved',
      actual_reviewer: codexFails || (authorKnown && !codexConfirmed) ? 'claude' : 'codex',
      independence: codexConfirmed ? 'cross-agent' : 'reduced',
    });
    expect(existsSync(independentInvoked)).toBe(true);
    expect(existsSync(sameAgentInvoked)).toBe(codexFails || (authorKnown && !codexConfirmed));
    if (authorKnown && !codexConfirmed) {
      expect(JSON.parse(readFileSync(packets.claude, 'utf8'))).toEqual(
        JSON.parse(readFileSync(packets.codex, 'utf8')),
      );
      expect(output.data.review_routes).toContainEqual(
        expect.objectContaining({
          reviewer: 'codex',
          failure: 'reviewer_capability_unknown',
          status: 'attempted',
        }),
      );
    }
    if (codexFails || (authorKnown && !codexConfirmed)) {
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
    } else if (!codexConfirmed) {
      expect(output.data.capability_failure).toBe('author_capability_unknown');
    }
  },
);
