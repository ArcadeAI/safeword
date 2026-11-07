import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { runReview } from '../../src/review/coordinator.js';
import { createConfiguredProject, createTemporaryDirectory } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';

const dispatchedPackets = vi.hoisted(() => [] as { dispatch_id: string }[]);
const dispatchedEfforts = vi.hoisted(() => [] as (string | undefined)[]);

/** Which configured fixture failure, if any, this reviewer launch raises. */
function fixtureFailure(
  reviewer: string,
  model: string | undefined,
): { readonly message: string; readonly terminal: boolean } | undefined {
  const environment = process.env;
  if (environment.SAFEWORD_TEST_REVIEWERS_FAIL === '1')
    return { message: 'fixture reviewer failure', terminal: false };
  if (
    environment.SAFEWORD_TEST_PRIMARY_FAILS === '1' &&
    (model === undefined || model === 'gpt-6.1-sol')
  )
    return { message: 'fixture primary failure', terminal: false };
  if (model !== undefined && model === environment.SAFEWORD_TEST_TERMINAL_MODEL)
    return { message: 'fixture alternate could not be stopped', terminal: true };
  if (environment.SAFEWORD_TEST_TERMINAL_FAILURE === '1' && reviewer !== 'claude')
    return { message: 'fixture reviewer could not be stopped', terminal: true };
  return undefined;
}

function fixtureRejects(reviewer: string): boolean {
  return reviewer !== 'claude' && process.env.SAFEWORD_TEST_INDEPENDENT_REJECTION === '1';
}

vi.mock('../../src/review/runtime.js', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const RuntimeError = actual.ReviewRuntimeError as new (
    failure: string,
    message: string,
    terminal?: boolean,
  ) => Error;
  return {
    ...actual,
    runHeadlessReviewerWithProvenance: (
      reviewer: string,
      packet: { dispatch_id: string },
      _workspace: unknown,
      _sourceRoot: unknown,
      options: { model?: string; effort?: string },
    ) => {
      dispatchedPackets.push(packet);
      dispatchedEfforts.push(options.effort);
      const failure = fixtureFailure(reviewer, options.model);
      if (failure !== undefined)
        return Promise.reject(
          new RuntimeError('process_failed', failure.message, failure.terminal),
        );
      return Promise.resolve({
        output: {
          schema_version: 1,
          dispatch_id: packet.dispatch_id,
          evidence_records: { schema_version: 1, records: [] },
          reviewer_agent: reviewer,
          verdict: fixtureRejects(reviewer) ? 'request_changes' : 'approve',
          summary: fixtureRejects(reviewer) ? 'Independent rejection.' : 'Review approval.',
          findings: fixtureRejects(reviewer)
            ? [{ severity: 'error', message: 'The independent reviewer found a blocking defect.' }]
            : [],
        },
        confirmedModel:
          options.model === undefined ? undefined : { provider: 'openai', model: options.model },
      });
    },
  };
});

const projects: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  dispatchedPackets.length = 0;
  dispatchedEfforts.length = 0;
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
});

async function planningFixture() {
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
        claude: [{ reviewer: 'codex', model: 'gpt-6-sol' }],
      },
    }),
  );
  const ticket = '.project/tickets/OUT123-route-outcomes';
  mkdirSync(nodePath.join(project, ticket), { recursive: true });
  writeFileSync(
    nodePath.join(project, ticket, 'ticket.md'),
    '---\nid: OUT123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: truthful review\nout_of_scope: blocking on independence\ndone_when: review never blocks on independence\nphase_anchors:\n  - scenario-gate: features/route-outcomes.feature\n---\n',
  );
  writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
  writeFileSync(
    nodePath.join(project, ticket, 'impl-plan.md'),
    '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nKeep review evidence truthful.\n\n## Decisions\n\nRequire qualified independent review.\n\n## Design alignment\n\nUse the current plan.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
  );
  mkdirSync(nodePath.join(project, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(project, 'features/route-outcomes.feature'),
    '@route-outcomes.BU1.R1\nFeature: Route outcomes\n  Scenario: Independent first\n    Given an independent reviewer\n    When review runs\n    Then its verdict is recorded\n',
  );

  vi.stubEnv('SAFEWORD_AGENT_RUNTIME', 'claude');
  return { project, ticket, configPath, config };
}

it('records an unrated pinned selector as an independent review', async () => {
  const { project, ticket } = await planningFixture();
  const result = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(result.state).toBe('healthy');
  expect(result.data).toMatchObject({
    status: 'approved',
    actual_reviewer: 'codex',
    independence: 'cross-agent',
    review_routes: [{ reviewer: 'codex', model: 'gpt-6-sol', status: 'attempted' }],
  });
  expect((result.data as Record<string, unknown>).capability_failure).toBeUndefined();
  expect(dispatchedPackets).toHaveLength(1);
});

it('records default routes as independent without any author model', async () => {
  const { project, ticket, configPath, config } = await planningFixture();
  writeFileSync(configPath, JSON.stringify(config));
  const defaulted = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(defaulted.data).toMatchObject({
    status: 'approved',
    actual_reviewer: 'codex',
    independence: 'cross-agent',
  });
});

it('records product-plan quality reviews by the default independent route', async () => {
  const { project, ticket, configPath, config } = await planningFixture();
  writeFileSync(
    nodePath.join(project, ticket, 'spec.md'),
    '# Product Plan: Truthful review\n\n<!-- safeword:product-plan-contract:v1 -->\n\n## Product Bet\n\n- **Problem / Why now:** Builders need trustworthy planning review.\n- **Expected outcome:** Review outcomes are labeled honestly.\n- **Success threshold:** Same-agent review is labeled reduced.\n- **Project non-goals:** Inventing independent assurance.\n- **Persona outcome inventory:** Builder receives approval or a named refusal.\n- **Known facts:** The fixture has one Builder and one CLI surface.\n- **Assumptions:** none\n- **Unresolved product decisions:** none\n\n## Jobs To Be Done\n\n### approval.BU1 — Trust review\n\n**Persona:** Builder (BU)\n\n> When I request review, I want actual assurance reported, so I can decide whether to advance.\n\n#### approval.BU1.R1 — Preserve truthful assurance\n\nReview outcomes are labeled honestly.\n\n## Shape\n\n### M1 — Trust review\n\n- **Outcome:** Current review is labeled honestly.\n- **Non-goals:** Blocking on independence.\n\n## Surfaces\n\nAffected:\n- Safeword CLI\n',
  );
  writeFileSync(configPath, JSON.stringify(config));
  const product = await runReview({
    cwd: project,
    kind: 'quality-review',
    targets: [`${ticket}/spec.md`],
  });
  expect(product.data).toMatchObject({
    status: 'approved',
    actual_reviewer: 'codex',
    independence: 'cross-agent',
  });
});

it('preserves ordinary non-planning cross-agent review', async () => {
  const { project, configPath, config } = await planningFixture();
  writeFileSync(configPath, JSON.stringify(config));
  writeFileSync(nodePath.join(project, 'notes.md'), '# Ordinary review\n\nNo planning contract.\n');
  const ordinary = await runReview({
    cwd: project,
    kind: 'quality-review',
    targets: ['notes.md'],
  });
  expect(ordinary.data).toMatchObject({
    status: 'approved',
    actual_reviewer: 'codex',
    independence: 'cross-agent',
  });
  expect((ordinary.data as Record<string, unknown>).review_routes).toBeUndefined();
});

it('blocks planning policy off while retaining ordinary review', async () => {
  const { project, ticket, configPath, config } = await planningFixture();
  writeFileSync(nodePath.join(project, 'notes.md'), '# Ordinary review\n\nNo planning contract.\n');
  writeFileSync(configPath, JSON.stringify({ ...config, crossAgentReview: 'off' }));
  for (const [kind, target] of [
    ['quality-review', `${ticket}/spec.md`],
    ['plan-implementation', `${ticket}/impl-plan.md`],
  ] as const) {
    const disabled = await runReview({ cwd: project, kind, targets: [target] });
    expect(disabled.state).toBe('action_required');
    expect(disabled.findings).toContainEqual(
      expect.objectContaining({ code: 'PLANNING_REVIEW_POLICY_OFF' }),
    );
    expect(disabled.data).toMatchObject({ status: 'blocked', review_policy: 'off' });
  }
  const ordinaryOff = await runReview({
    cwd: project,
    kind: 'quality-review',
    targets: ['notes.md'],
  });
  expect(ordinaryOff.data).toMatchObject({ status: 'existing_route' });
});

it.each(['prefer', 'require'] as const)(
  'hands a %s planning review to the host after every route fails instead of blocking',
  async policy => {
    const { project, ticket, configPath, config } = await planningFixture();
    vi.stubEnv('SAFEWORD_TEST_REVIEWERS_FAIL', '1');
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReview: policy,
        crossAgentReviewRoutes: {
          claude: [{ reviewer: 'codex', model: 'gpt-6-astra' }, { reviewer: 'claude' }],
        },
      }),
    );
    const continuation = await runReview({
      cwd: project,
      kind: 'plan-implementation',
      targets: [`${ticket}/impl-plan.md`],
      context: [`${ticket}/spec.md`],
    });
    expect(continuation.data).toMatchObject({
      status: 'continuation_required',
      independence: 'none',
      continuation: {
        tier: 'fresh-context',
        instructions: expect.stringContaining('Review only the bounded files in this packet.'),
        packet: { dispatch_id: expect.any(String) },
      },
      review_routes: [
        { reviewer: 'codex', status: 'attempted', failure: 'process_failed' },
        { reviewer: 'claude', status: 'attempted', failure: 'process_failed' },
      ],
    });
    expect(dispatchedPackets.at(-1)).toBe(dispatchedPackets.at(-2));
  },
);

it.each(['prefer', 'require'] as const)(
  'returns an independent rejection under %s as the final verdict',
  async policy => {
    const { project, ticket, configPath, config } = await planningFixture();
    vi.stubEnv('SAFEWORD_TEST_INDEPENDENT_REJECTION', '1');
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReview: policy,
        crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }, { reviewer: 'claude' }] },
      }),
    );
    const rejection = await runReview({
      cwd: project,
      kind: 'plan-implementation',
      targets: [`${ticket}/impl-plan.md`],
      context: [`${ticket}/spec.md`],
    });
    expect(rejection.data).toMatchObject({
      status: 'changes_requested',
      independence: 'cross-agent',
      actual_reviewer: 'codex',
      reviewer_output: { verdict: 'request_changes' },
    });
    expect(dispatchedPackets).toHaveLength(1);
  },
);

it('hands a planning review to the host when the run budget cannot fund any route', async () => {
  const { project, ticket } = await planningFixture();
  // A route needs at least the per-review timeout; a smaller run bound funds none.
  vi.stubEnv('SAFEWORD_REVIEW_TIMEOUT_MS', '5000');
  vi.stubEnv('SAFEWORD_REVIEW_RUN_BOUND_MS', '1000');
  const result = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(result.data).toMatchObject({
    status: 'continuation_required',
    continuation: { tier: 'fresh-context' },
    review_routes: [{ reviewer: 'codex', status: 'unattempted' }],
  });
  expect(result.findings.map(finding => finding.code)).not.toContain('REVIEW_ROUTES_EXHAUSTED');
  expect(dispatchedPackets).toHaveLength(0);
});

it('hands a planning review to the host after a terminal reviewer failure without launching more reviewers', async () => {
  const { project, ticket, configPath, config } = await planningFixture();
  vi.stubEnv('SAFEWORD_TEST_TERMINAL_FAILURE', '1');
  writeFileSync(
    configPath,
    JSON.stringify({
      ...config,
      crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }, { reviewer: 'claude' }] },
    }),
  );
  const result = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(result.data).toMatchObject({
    status: 'continuation_required',
    continuation: { tier: 'fresh-context' },
    review_routes: [
      { reviewer: 'codex', status: 'attempted', failure: 'process_failed' },
      { reviewer: 'claude', status: 'unattempted' },
    ],
  });
  expect(result.findings.map(finding => finding.code)).not.toContain('REVIEW_ROUTES_EXHAUSTED');
  expect(dispatchedPackets).toHaveLength(1);
});

it('launches no further reviewer after an ordinary review alternate cannot be stopped', async () => {
  const { project, configPath, config } = await planningFixture();
  vi.stubEnv('SAFEWORD_TEST_PRIMARY_FAILS', '1');
  vi.stubEnv('SAFEWORD_TEST_TERMINAL_MODEL', 'alt-model');
  const { crossAgentReviewRoutes: _routes, ...withoutRoutes } = config as Record<string, unknown>;
  writeFileSync(
    configPath,
    JSON.stringify({ ...withoutRoutes, crossAgentReviewAlternateModel: { codex: 'alt-model' } }),
  );
  writeFileSync(nodePath.join(project, 'notes.md'), '# Ordinary review\n\nNo planning contract.\n');
  const result = await runReview({ cwd: project, kind: 'quality-review', targets: ['notes.md'] });
  expect(result.data).toMatchObject({
    status: 'blocked',
    alternate_model: 'alt-model',
    alternate_model_failure: 'process_failed',
  });
  expect(dispatchedPackets).toHaveLength(2);
});

it('uses the pinned medium effort for planning review', async () => {
  const { project, ticket } = await planningFixture();
  await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(dispatchedEfforts).toEqual(['medium']);
  expect(dispatchedPackets).toHaveLength(1);
});
