import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { runReview } from '../../src/review/coordinator.js';
import { createConfiguredProject, createTemporaryDirectory } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';

vi.mock('../../src/review/capability-catalogue.js', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  reviewerCapabilityFailure: (_author: unknown, requestedModel: string | undefined) => {
    if (requestedModel === undefined) return 'reviewer_capability_unknown';
    return requestedModel === 'gpt-6-luna' ? 'reviewer_capability_weaker' : undefined;
  },
}));

const dispatchedPackets = vi.hoisted(() => [] as { dispatch_id: string }[]);
const dispatchedEfforts = vi.hoisted(() => [] as (string | undefined)[]);

function fixtureRejects(reviewer: string, model: string | undefined): boolean {
  return (
    (model === 'gpt-6-astra' && process.env.SAFEWORD_TEST_QUALIFIED_APPROVAL !== '1') ||
    (model === 'gpt-6-luna' && process.env.SAFEWORD_TEST_WEAKER_REJECTION === '1') ||
    (reviewer !== 'claude' &&
      model === undefined &&
      process.env.SAFEWORD_TEST_UNKNOWN_REJECTION === '1')
  );
}

function fixtureSummary(model: string | undefined): string {
  if (model === 'gpt-6-luna' && process.env.SAFEWORD_TEST_WEAKER_REJECTION === '1')
    return 'Weak rejection.';
  return (
    { 'gpt-6-luna': 'Weak approval.', 'gpt-6-astra': 'Qualified rejection.' }[model ?? ''] ??
    'Runtime-default approval.'
  );
}

vi.mock('../../src/review/runtime.js', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const RuntimeError = actual.ReviewRuntimeError as new (failure: string, message: string) => Error;
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
      if (process.env.SAFEWORD_TEST_REVIEWERS_FAIL === '1')
        return Promise.reject(new RuntimeError('process_failed', 'fixture reviewer failure'));
      return Promise.resolve({
        output: {
          schema_version: 1,
          dispatch_id: packet.dispatch_id,
          reviewer_agent: reviewer,
          verdict: fixtureRejects(reviewer, options.model) ? 'request_changes' : 'approve',
          summary: fixtureSummary(options.model),
          findings:
            fixtureRejects(reviewer, options.model) &&
            process.env.SAFEWORD_TEST_UNKNOWN_REJECTION === '1'
              ? [
                  {
                    severity: 'error',
                    message: `The unqualified reviewer found a blocking defect.${
                      process.env.SAFEWORD_TEST_UNSAFE_FEEDBACK === '1'
                        ? `\u{1B}[31m\u{202E}${'x'.repeat(3000)}`
                        : ''
                    }`,
                  },
                ]
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
        claude: [
          { reviewer: 'codex', model: 'gpt-6-luna' },
          { reviewer: 'codex', model: 'gpt-6-astra' },
        ],
      },
    }),
  );
  const ticket = '.project/tickets/WEK123-weaker-reviewer';
  mkdirSync(nodePath.join(project, ticket), { recursive: true });
  writeFileSync(
    nodePath.join(project, ticket, 'ticket.md'),
    '---\nid: WEK123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: truthful review\nout_of_scope: weaker approval\ndone_when: weaker reviewer is refused\nphase_anchors:\n  - scenario-gate: features/weaker-reviewer.feature\n---\n',
  );
  writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
  writeFileSync(
    nodePath.join(project, ticket, 'impl-plan.md'),
    '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nKeep review evidence truthful.\n\n## Decisions\n\nRequire qualified independent review.\n\n## Design alignment\n\nUse the current plan.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
  );
  mkdirSync(nodePath.join(project, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(project, 'features/weaker-reviewer.feature'),
    '@weaker-reviewer.BU1.R1\nFeature: Weaker reviewer\n  Scenario: Weaker approval\n    Given a weaker reviewer approves\n    When another independent reviewer requests changes\n    Then the weaker approval is discarded\n',
  );

  vi.stubEnv('SAFEWORD_AGENT_RUNTIME', 'claude');
  vi.stubEnv('SAFEWORD_AUTHOR_MODEL', 'claude-opus-5');
  return { project, ticket, configPath, config };
}

it('discards a weaker approval before a qualified rejection', async () => {
  const { project, ticket } = await planningFixture();
  const result = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });

  expect(result.state).toBe('action_required');
  expect(result.data).toMatchObject({
    status: 'changes_requested',
    independence: 'cross-agent',
    review_routes: [
      { model: 'gpt-6-luna', status: 'attempted', failure: 'reviewer_capability_weaker' },
      { model: 'gpt-6-astra', status: 'attempted' },
    ],
    reviewer_output: { summary: 'Qualified rejection.', verdict: 'request_changes' },
  });
  expect(JSON.stringify(result)).not.toContain('Weak approval.');
});

it('exhausts when only a proven-weaker route is configured', async () => {
  const { project, ticket, configPath, config } = await planningFixture();
  writeFileSync(
    configPath,
    JSON.stringify({
      ...config,
      crossAgentReviewRoutes: { claude: [{ reviewer: 'codex', model: 'gpt-6-luna' }] },
    }),
  );
  const exhausted = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(exhausted.data).toMatchObject({
    status: 'continuation_required',
    continuation: { tier: 'fresh-context' },
    review_routes: [{ model: 'gpt-6-luna', failure: 'reviewer_capability_weaker' }],
  });
  expect(exhausted.findings).toContainEqual(
    expect.objectContaining({ code: 'REVIEW_CONTINUATION_REQUIRED' }),
  );
  expect(JSON.stringify(exhausted)).not.toContain('Weak approval.');
});

it('uses same-agent review after unqualified default routes', async () => {
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
    actual_reviewer: 'claude',
    independence: 'reduced',
    review_routes: [
      { reviewer: 'codex', status: 'attempted', failure: 'reviewer_capability_unknown' },
      { reviewer: 'opencode', status: 'attempted', failure: 'reviewer_capability_unknown' },
      { reviewer: 'claude', status: 'attempted' },
    ],
  });
});

it('applies qualification to product-plan quality reviews', async () => {
  const { project, ticket, configPath, config } = await planningFixture();
  writeFileSync(
    nodePath.join(project, ticket, 'spec.md'),
    '# Product Plan: Truthful review\n\n<!-- safeword:product-plan-contract:v1 -->\n\n## Product Bet\n\n- **Problem / Why now:** Builders need trustworthy planning review.\n- **Expected outcome:** Only current qualified approval advances.\n- **Success threshold:** Unverified review is labeled reduced.\n- **Project non-goals:** Inventing independent assurance.\n- **Persona outcome inventory:** Builder receives approval or a named refusal.\n- **Known facts:** The fixture has one Builder and one CLI surface.\n- **Assumptions:** none\n- **Unresolved product decisions:** none\n\n## Jobs To Be Done\n\n### approval.BU1 — Trust review\n\n**Persona:** Builder (BU)\n\n> When I request review, I want actual assurance reported, so I can decide whether to advance.\n\n#### approval.BU1.R1 — Preserve truthful assurance\n\nOnly current qualified approval advances.\n\n## Shape\n\n### M1 — Trust review\n\n- **Outcome:** Current review is labeled honestly.\n- **Non-goals:** Unqualified independence.\n\n## Surfaces\n\nAffected:\n- Safeword CLI\n',
  );
  writeFileSync(configPath, JSON.stringify(config));
  const product = await runReview({
    cwd: project,
    kind: 'quality-review',
    targets: [`${ticket}/spec.md`],
  });
  expect(product.data).toMatchObject({
    status: 'approved',
    actual_reviewer: 'claude',
    independence: 'reduced',
    review_routes: [
      { reviewer: 'codex', status: 'attempted', failure: 'reviewer_capability_unknown' },
      { reviewer: 'opencode', status: 'attempted', failure: 'reviewer_capability_unknown' },
      { reviewer: 'claude', status: 'attempted' },
    ],
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

it('requires independent policy to block host continuation after runtime failures', async () => {
  const { project, ticket, configPath, config } = await planningFixture();
  vi.stubEnv('SAFEWORD_TEST_REVIEWERS_FAIL', '1');
  writeFileSync(
    configPath,
    JSON.stringify({
      ...config,
      crossAgentReview: 'prefer',
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

  const requireConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(configPath, JSON.stringify({ ...requireConfig, crossAgentReview: 'require' }));
  const required = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(required.data).toMatchObject({ status: 'blocked' });
  expect((required.data as Record<string, unknown>).continuation).toBeUndefined();
});

it.each(['prefer', 'require'] as const)(
  'keeps an unqualified rejection under %s without accepting self-approval',
  async policy => {
    const { project, ticket, configPath, config } = await planningFixture();
    vi.stubEnv('SAFEWORD_TEST_REVIEWERS_FAIL', '0');
    vi.stubEnv('SAFEWORD_TEST_UNKNOWN_REJECTION', '1');
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReview: policy,
        crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }, { reviewer: 'claude' }] },
      }),
    );
    const unqualifiedRejection = await runReview({
      cwd: project,
      kind: 'plan-implementation',
      targets: [`${ticket}/impl-plan.md`],
      context: [`${ticket}/spec.md`],
    });
    expect(unqualifiedRejection.data).toMatchObject({
      status: 'blocked',
      independence: 'none',
      actual_reviewer: 'codex',
      reviewer_output: { verdict: 'request_changes' },
    });
    expect(unqualifiedRejection.findings).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        message: 'The unqualified reviewer found a blocking defect.',
      }),
    );
  },
);

it('uses the pinned medium effort for planning qualification', async () => {
  const { project, ticket } = await planningFixture();
  await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(dispatchedEfforts).toEqual(['medium', 'medium']);
});

it('discards a proven-weaker rejection before taking a qualified verdict', async () => {
  const { project, ticket } = await planningFixture();
  vi.stubEnv('SAFEWORD_TEST_WEAKER_REJECTION', '1');
  const result = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });
  expect(result.data).toMatchObject({
    status: 'changes_requested',
    independence: 'cross-agent',
    review_routes: [
      { model: 'gpt-6-luna', failure: 'reviewer_capability_weaker' },
      { model: 'gpt-6-astra', status: 'attempted' },
    ],
    reviewer_output: { summary: 'Qualified rejection.' },
  });
  expect(JSON.stringify(result)).not.toContain('Weak rejection.');
});

it.each([false, true])(
  'keeps safe unqualified feedback when a qualified reviewer approves (unsafe text: %s)',
  async unsafe => {
    const { project, ticket, configPath, config } = await planningFixture();
    vi.stubEnv('SAFEWORD_TEST_UNKNOWN_REJECTION', '1');
    vi.stubEnv('SAFEWORD_TEST_QUALIFIED_APPROVAL', '1');
    vi.stubEnv('SAFEWORD_TEST_UNSAFE_FEEDBACK', unsafe ? '1' : '0');
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReviewRoutes: {
          claude: [{ reviewer: 'codex' }, { reviewer: 'codex', model: 'gpt-6-astra' }],
        },
      }),
    );
    const result = await runReview({
      cwd: project,
      kind: 'plan-implementation',
      targets: [`${ticket}/impl-plan.md`],
      context: [`${ticket}/spec.md`],
    });
    expect(result.data).toMatchObject({
      status: 'approved',
      independence: 'cross-agent',
      reviewer_output: { verdict: 'approve', findings: [] },
      review_routes: [
        { status: 'attempted', failure: 'reviewer_capability_unknown' },
        { status: 'attempted', model: 'gpt-6-astra' },
      ],
    });
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('The unqualified reviewer found a blocking defect.'),
      }),
    );
    const retained = result.findings.filter(
      finding => finding.code === 'REVIEW_UNQUALIFIED_FEEDBACK',
    );
    for (const finding of retained) {
      expect(finding.message).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
      expect(finding.message.match(/[\s\S]/gu)?.length ?? 0).toBeLessThanOrEqual(2000);
    }
    expect(retained).toHaveLength(2);
    expect(retained.map(finding => finding.severity)).toEqual(['info', 'warning']);
  },
);
