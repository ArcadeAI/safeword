import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { runReview } from '../../src/review/coordinator.js';
import { createConfiguredProject, createTemporaryDirectory } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';

vi.mock('../../src/review/capability-catalogue.js', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  reviewerCapabilityFailure: (_author: unknown, requestedModel: string) =>
    requestedModel === 'gpt-6-luna' ? 'reviewer_capability_weaker' : undefined,
}));

vi.mock('../../src/review/runtime.js', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runHeadlessReviewerWithProvenance: (
    _reviewer: unknown,
    packet: { dispatch_id: string },
    _workspace: unknown,
    _sourceRoot: unknown,
    options: { model: string },
  ) =>
    Promise.resolve({
      output: {
        schema_version: 1,
        dispatch_id: packet.dispatch_id,
        reviewer_agent: 'codex',
        verdict: options.model === 'gpt-6-luna' ? 'approve' : 'request_changes',
        summary: options.model === 'gpt-6-luna' ? 'Weak approval.' : 'Qualified rejection.',
        findings: [],
      },
      confirmedModel: { provider: 'openai', model: options.model },
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
});
