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

vi.mock('../../src/review/runtime.js', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runHeadlessReviewerWithProvenance: (
    reviewer: string,
    packet: { dispatch_id: string },
    _workspace: unknown,
    _sourceRoot: unknown,
    options: { model?: string },
  ) =>
    Promise.resolve({
      output: {
        schema_version: 1,
        dispatch_id: packet.dispatch_id,
        reviewer_agent: reviewer,
        verdict: options.model === 'gpt-6-astra' ? 'request_changes' : 'approve',
        summary:
          {
            'gpt-6-luna': 'Weak approval.',
            'gpt-6-astra': 'Qualified rejection.',
          }[options.model ?? ''] ?? 'Runtime-default approval.',
        findings: [],
      },
      confirmedModel:
        options.model === undefined ? undefined : { provider: 'openai', model: options.model },
    }),
}));

const projects: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
});

it('discards a weaker approval and continues to the next independent route', async () => {
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
    status: 'blocked',
    capability_failure: 'reviewer_capability_weaker',
  });
  expect(exhausted.findings).toContainEqual(
    expect.objectContaining({ code: 'REVIEWER_CAPABILITY_WEAKER' }),
  );
  expect(JSON.stringify(exhausted)).not.toContain('Weak approval.');

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

  writeFileSync(
    nodePath.join(project, ticket, 'spec.md'),
    '# Product Plan: Truthful review\n\n<!-- safeword:product-plan-contract:v1 -->\n\n## Product Bet\n\n- **Problem / Why now:** Builders need trustworthy planning review.\n- **Expected outcome:** Only current qualified approval advances.\n- **Success threshold:** Unverified review is labeled reduced.\n- **Project non-goals:** Inventing independent assurance.\n- **Persona outcome inventory:** Builder receives approval or a named refusal.\n- **Known facts:** The fixture has one Builder and one CLI surface.\n- **Assumptions:** none\n- **Unresolved product decisions:** none\n\n## Jobs To Be Done\n\n### approval.BU1 — Trust review\n\n**Persona:** Builder (BU)\n\n> When I request review, I want actual assurance reported, so I can decide whether to advance.\n\n#### approval.BU1.R1 — Preserve truthful assurance\n\nOnly current qualified approval advances.\n\n## Shape\n\n### M1 — Trust review\n\n- **Outcome:** Current review is labeled honestly.\n- **Non-goals:** Unqualified independence.\n\n## Surfaces\n\nAffected:\n- Safeword CLI\n',
  );
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
