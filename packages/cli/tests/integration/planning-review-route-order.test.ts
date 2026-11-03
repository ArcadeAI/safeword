import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

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

function reviewerScript(
  agent: 'claude' | 'codex',
  marker: string,
  packetPath: string,
  codexFails: boolean,
  codexConfirmed: boolean,
): string {
  const help =
    agent === 'codex' && codexConfirmed
      ? `process.argv.includes('app-server') ? '--stdio --config' : ${JSON.stringify(REVIEWER_CAPABILITIES.codex)}`
      : JSON.stringify(REVIEWER_CAPABILITIES[agent]);
  const review =
    agent === 'codex' && codexConfirmed
      ? String.raw`let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const message = JSON.parse(buffer.slice(0, index));
    buffer = buffer.slice(index + 1);
    if (message.id === 1) console.log(JSON.stringify({ id: 1, result: {} }));
    if (message.id === 2) console.log(JSON.stringify({ id: 2, result: { thread: { id: 'thread-1' }, model: message.params.model, modelProvider: 'openai' } }));
    if (message.id === 3) {
      const packet = JSON.parse(message.params.input[0].text.trim().split('\n').pop());
      console.log(JSON.stringify({ id: 3, result: { turn: { id: 'turn-1' } } }));
      console.log(JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', items: [{ type: 'agentMessage', phase: 'final_answer', text: JSON.stringify(reviewOutput(packet)) }] } } }));
    }
  }
});`
      : String.raw`let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').pop());
  const output = reviewOutput(packet);
  console.log(JSON.stringify('${agent}' === 'codex' ? { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(output) } } : { structured_output: output }));
});`;
  return `#!${process.execPath}
const { writeFileSync } = require('node:fs');
if (process.argv.includes('--version')) { console.log('${agent} 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${help}); process.exit(0); }
writeFileSync(${JSON.stringify(marker)}, 'yes');
${agent === 'codex' && codexFails ? 'process.exit(7);' : ''}
function reviewOutput(packet) {
  writeFileSync(${JSON.stringify(packetPath)}, JSON.stringify(packet));
  return { schema_version: 1, dispatch_id: packet.dispatch_id, evidence_records: { schema_version: 1, records: [] }, reviewer_agent: '${agent}', verdict: 'approve', summary: 'Review approved.', findings: [] };
}
${review}
`;
}

/** The qualified pair, or the latest pinned pair that has no sealed evidence yet. */
function routePair(pinnedUnqualified: boolean): { author: string; reviewer: string } {
  return pinnedUnqualified
    ? { author: 'claude-opus-5-5', reviewer: 'gpt-6.1-sol' }
    : { author: 'claude-opus-5', reviewer: 'gpt-6-astra' };
}

/** A pinned pair without sealed evidence earns no review credit: no reviewer runs and nothing falls back. */
function assertPinnedPairRefused(
  output: { data: Record<string, unknown>; findings: { code: string }[] },
  independentInvoked: string,
  sameAgentInvoked: string,
): void {
  expect(output.data).toMatchObject({
    status: 'blocked',
    independence: 'none',
    capability_failure: 'reviewer_capability_unknown',
    review_routes: [
      expect.objectContaining({
        reviewer: 'codex',
        model: 'gpt-6.1-sol',
        status: 'skipped',
        failure: 'reviewer_capability_unknown',
      }),
      expect.objectContaining({ reviewer: 'claude', status: 'unattempted' }),
    ],
  });
  expect(output.findings).toContainEqual(
    expect.objectContaining({ code: 'REVIEWER_CAPABILITY_UNKNOWN' }),
  );
  expect(existsSync(independentInvoked)).toBe(false);
  expect(existsSync(sameAgentInvoked)).toBe(false);
}

async function assertQualifiedAdmission(
  flags: { authorKnown: boolean; codexConfirmed: boolean; codexFails: boolean },
  project: string,
  reviewer: string,
  reviewId: string,
): Promise<void> {
  if (!flags.authorKnown || !flags.codexConfirmed || flags.codexFails) return;
  const bun = spawnSync('which', ['bun'], { encoding: 'utf8' });
  expect(bun.status).toBe(0);
  const environment = {
    ...process.env,
    SAFEWORD_AGENT_RUNTIME: 'claude',
    CLAUDE_SESSION_ID: 'qualified-route-order',
    SAFEWORD_AUTHOR_MODEL: 'claude-opus-5',
    SAFEWORD_PLUGIN_CLI: testCliPath,
    SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(reviewer, '.review-keys'),
  };
  const stamped = spawnSync(
    bun.stdout.trim(),
    [
      '.safeword/hooks/write-review-stamp.ts',
      '--ticket',
      'ORD123-independent-first',
      '--phase',
      'plan-implementation',
      '--author-agent',
      'claude',
      '--reviewer-agent',
      'codex',
      '--independence',
      'cross-agent',
      '--review-id',
      reviewId,
    ],
    { cwd: project, encoding: 'utf8', env: environment },
  );
  expect(stamped.status, stamped.stdout + stamped.stderr).toBe(0);
  const admitted = await runCli(
    ['ticket', 'approve-plan', 'ORD123', '--cwd', project, '--json', '--no-input'],
    { cwd: project, env: environment },
  );
  expect(admitted.exitCode, admitted.stdout).toBe(0);
  expect(JSON.parse(admitted.stdout).data).toMatchObject({
    achieved_independence: 'cross-agent',
  });
}

it.each([
  ['claude', 'codex', false, 'absent', false],
  ['claude', 'codex', false, 'empty', false],
  ['codex', 'claude', false, 'absent', false],
  ['claude', 'codex', true, 'absent', false],
  ['codex', 'claude', true, 'absent', false],
  ['codex', 'claude', false, 'known', false],
  ['codex', 'claude', false, 'known', true],
  ['codex', 'claude', false, 'pinned-unqualified', true],
] as const)(
  'tries the independent reviewer before fallback when %s precedes %s, codex failure is %s, author model is %s, and model is confirmed %s',
  // eslint-disable-next-line complexity -- The route-order matrix shares one real CLI fixture.
  async (first, second, codexFails, authorModelState, codexConfirmed) => {
    // The latest pinned pair has no sealed evidence yet, so its confirmed reviewer stays unqualified.
    const pinnedUnqualified = authorModelState === 'pinned-unqualified';
    const authorKnown = authorModelState === 'known' || pinnedUnqualified;
    const capabilityRefused = authorKnown && !codexConfirmed;
    const pair = routePair(pinnedUnqualified);
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
              ...(first === 'codex' && codexConfirmed && { model: pair.reviewer }),
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
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(reviewer, '.review-keys'),
          ...(authorKnown && {
            SAFEWORD_AUTHOR_MODEL: pair.author,
          }),
          ...(authorModelState === 'empty' && { SAFEWORD_AUTHOR_MODEL: '' }),
        },
      },
    );
    const output = JSON.parse(reviewed.stdout);
    if (pinnedUnqualified) {
      assertPinnedPairRefused(output, independentInvoked, sameAgentInvoked);
      return;
    }
    expect(output.data).toMatchObject({
      status: 'approved',
      actual_reviewer: codexFails || capabilityRefused ? 'claude' : 'codex',
      independence: codexConfirmed ? 'cross-agent' : 'reduced',
    });
    await assertQualifiedAdmission(
      { authorKnown, codexConfirmed, codexFails },
      project,
      reviewer,
      output.data.review_id,
    );
    expect(existsSync(independentInvoked)).toBe(true);
    expect(existsSync(sameAgentInvoked)).toBe(codexFails || capabilityRefused);
    if (capabilityRefused) {
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
    if (codexFails || capabilityRefused) {
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

it.each(['unqualified-model', 'gpt-6-luna'])(
  'blocks explicit %s without launching any route when no independent attempt exists',
  async model => {
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
          claude: [{ reviewer: 'codex', model }, { reviewer: 'claude' }],
        },
      }),
    );
    const ticket = '.project/tickets/PRQ123-qualification';
    mkdirSync(nodePath.join(project, ticket), { recursive: true });
    writeFileSync(
      nodePath.join(project, ticket, 'ticket.md'),
      '---\nid: PRQ123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: accepted behavior\nout_of_scope: new behavior\ndone_when: qualified review\nphase_anchors:\n  - scenario-gate: features/qualification.feature\n---\n',
    );
    mkdirSync(nodePath.join(project, 'features'), { recursive: true });
    writeFileSync(
      nodePath.join(project, 'features/qualification.feature'),
      '@independent-first.BU1.R1\nFeature: Qualification\n  Scenario: Refuse unqualified model\n    Given a configured reviewer\n    When review runs\n    Then the unqualified model is skipped\n',
    );
    writeFileSync(
      nodePath.join(project, ticket, 'impl-plan.md'),
      '# Implementation Plan\n\n**Status:** planned\n\n## Approach\nPreserve review.\n\n## Decisions\nUse accepted behavior.\n\n## Design alignment\nPreserve scope.\n\n## Architecture applicability\nskip: no architecture changes\n\n## Data applicability\nskip: no data changes\n\n## Known deviations\nskip: none\n\n## Doc impact\nskip: no docs\n\n## Assessment triggers\nRevisit if review changes.\n',
    );
    writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
    const reviewer = createTrustedReviewerDirectory('safeword-prequalification-');
    const marker = nodePath.join(reviewer, 'independent-launched');
    const fallback = nodePath.join(reviewer, 'fallback-launched');
    for (const agent of ['claude', 'codex'] as const)
      writeFileSync(
        nodePath.join(reviewer, agent),
        reviewerScript(
          agent,
          agent === 'codex' ? marker : fallback,
          nodePath.join(reviewer, `${agent}-packet`),
          false,
          false,
        ),
        { mode: 0o755 },
      );
    const result = await runCli(
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
          PATH: `${reviewer}:${process.env.PATH ?? ''}`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_AUTHOR_MODEL: 'claude-opus-5',
        },
      },
    );
    const output = JSON.parse(result.stdout);
    expect(result.exitCode, result.stdout + result.stderr).toBe(2);
    expect(existsSync(marker), 'unqualified exact selector must never launch inference').toBe(
      false,
    );
    expect(existsSync(fallback), result.stdout + result.stderr).toBe(false);
    expect(output.data).toMatchObject({
      status: 'blocked',
      independence: 'none',
    });
    expect(output.data.review_routes).toContainEqual(
      expect.objectContaining({
        reviewer: 'codex',
        model,
        status: 'skipped',
        failure: 'reviewer_capability_unknown',
      }),
    );
  },
);
