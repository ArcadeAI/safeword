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

type RouteCase = {
  first: 'claude' | 'codex';
  second: 'claude' | 'codex';
  codexFails: boolean;
  authorModelState: 'absent' | 'empty' | 'known';
  codexConfirmed: boolean;
  qualification: 'current' | 'unknown' | 'unknown-headless-failed' | 'unknown-require';
};

function routeConfig(config: object, { first, second, codexConfirmed, qualification }: RouteCase) {
  const requireIndependent = qualification === 'unknown-require';
  const unknownPair = qualification !== 'current';
  return {
    ...config,
    ...(requireIndependent && { crossAgentReview: 'require' }),
    crossAgentReviewRoutes: {
      claude: [
        {
          reviewer: first,
          ...(first === 'codex' &&
            codexConfirmed && {
              model: unknownPair ? 'gpt-6.1-sol-unqualified' : 'gpt-6.1-sol',
            }),
        },
        ...(requireIndependent ? [] : [{ reviewer: second }]),
      ],
    },
  };
}

async function runRouteCase({
  first,
  second,
  codexFails,
  authorModelState,
  codexConfirmed,
  qualification,
}: RouteCase) {
  const authorKnown = authorModelState === 'known';
  const project = createTemporaryDirectory();
  projects.push(project);
  await createConfiguredProject(project);
  writePlanningInventories(project);
  const configPath = nodePath.join(project, '.safeword/config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(
    configPath,
    JSON.stringify(
      routeConfig(config, {
        first,
        second,
        codexFails,
        authorModelState,
        codexConfirmed,
        qualification,
      }),
    ),
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
    const script = reviewerScript(agent, marker, packets[agent], codexFails, codexConfirmed);
    const failed = agent === 'claude' && qualification === 'unknown-headless-failed';
    const producer = failed
      ? script.replace(
          'function reviewOutput(packet)',
          'process.exit(7);\nfunction reviewOutput(packet)',
        )
      : script;
    if (failed) expect(producer).not.toBe(script);
    writeFileSync(nodePath.join(reviewer, agent), producer, { mode: 0o755 });
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
  return { output, packets, sameAgentInvoked, independentInvoked };
}

it.each([
  ['claude', 'codex', false, 'absent', false],
  ['claude', 'codex', false, 'empty', false],
  ['codex', 'claude', false, 'absent', false],
  ['claude', 'codex', true, 'absent', false],
  ['codex', 'claude', true, 'absent', false],
  ['codex', 'claude', false, 'known', false],
  ['codex', 'claude', false, 'known', true],
] as const)(
  'selects permitted routes when %s precedes %s, codex failure is %s, author model is %s, and model is confirmed %s',
  async (first, second, codexFails, authorModelState, codexConfirmed) => {
    const authorKnown = authorModelState === 'known';
    const usesFallback = codexFails || (authorKnown && !codexConfirmed);
    const { output, packets, sameAgentInvoked, independentInvoked } = await runRouteCase({
      first,
      second,
      codexFails,
      authorModelState,
      codexConfirmed,
      qualification: 'current',
    });
    expect(output.data).toMatchObject({
      status: 'approved',
      actual_reviewer: usesFallback ? 'claude' : 'codex',
      independence: codexConfirmed ? 'cross-agent' : 'reduced',
    });
    expect(existsSync(independentInvoked)).toBe(true);
    expect(existsSync(sameAgentInvoked)).toBe(usesFallback);
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
    if (usesFallback) {
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

it.each(['unknown', 'unknown-headless-failed', 'unknown-require'] as const)(
  'preserves the permitted fallback after %s qualification',
  async qualification => {
    const requireIndependent = qualification === 'unknown-require';
    const { output, sameAgentInvoked, independentInvoked } = await runRouteCase({
      first: 'codex',
      second: 'claude',
      codexFails: false,
      authorModelState: 'known',
      codexConfirmed: true,
      qualification,
    });
    expect(existsSync(independentInvoked)).toBe(false);
    expect(output.data.review_routes, JSON.stringify(output)).toBeDefined();
    expect(output.data.review_routes[0]).toEqual({
      reviewer: 'codex',
      model: 'gpt-6.1-sol-unqualified',
      independence: 'cross-agent',
      status: 'skipped',
      failure: 'reviewer_capability_unknown',
    });
    expect(
      output.effects.network.every((effect: { target: string }) => effect.target === 'claude'),
    ).toBe(true);
    if (requireIndependent) {
      expect(output.data).toMatchObject({
        status: 'blocked',
        independence: 'none',
        capability_failure: 'reviewer_capability_unknown',
      });
      expect(existsSync(sameAgentInvoked)).toBe(false);
      expect(output.findings).toContainEqual(
        expect.objectContaining({ code: 'REVIEWER_CAPABILITY_UNKNOWN' }),
      );
      expect(output.recovery[0].description).toMatch(/pin.+supported.+model/iu);
    } else if (qualification === 'unknown-headless-failed') {
      expect(existsSync(sameAgentInvoked)).toBe(true);
      expect(output.data).toMatchObject({
        status: 'continuation_required',
        independence: 'none',
        continuation: { tier: 'fresh-context' },
      });
      expect(output.data.review_routes[1]).toMatchObject({
        reviewer: 'claude',
        status: 'attempted',
        failure: 'process_failed',
      });
    } else {
      expect(existsSync(sameAgentInvoked)).toBe(true);
      expect(output.data).toMatchObject({
        status: 'approved',
        actual_reviewer: 'claude',
        independence: 'reduced',
      });
      expect(output.findings).toContainEqual(
        expect.objectContaining({ code: 'REVIEW_INDEPENDENCE_REDUCED' }),
      );
    }
  },
);
