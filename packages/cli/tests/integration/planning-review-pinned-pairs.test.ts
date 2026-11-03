import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import type { SealedCapabilityResults } from '../../src/review/capability-eval.js';
import { runReview } from '../../src/review/coordinator.js';
import { createConfiguredProject, createTemporaryDirectory } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';

// Qualify the latest pinned pair by resealing the shipped pair's observations under its own
// revision, so the coordinator must look past the first pinned revision to admit it.
vi.mock('../../src/review/capability-catalogue.generated.js', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const evaluation = await import('../../src/review/capability-eval.js');
  const corpus = await import('../fixtures/reviewer-capability-corpus.js');
  const evidenceDirectory = nodePath.join(
    import.meta.dirname,
    '../fixtures/reviewer-capability-evidence',
  );
  const shipped = (model: string) =>
    JSON.parse(
      readFileSync(nodePath.join(evidenceDirectory, `${model}.json`), 'utf8'),
    ) as SealedCapabilityResults;
  const [existing, latest] = corpus.REVIEWER_CAPABILITY_PINNED_PAIRS;
  const latestRevision = evaluation.capabilityRevision(
    evaluation.capabilityManifestForPair(corpus.REVIEWER_CAPABILITY_MANIFEST, latest),
    corpus.REVIEWER_CAPABILITY_RUBRICS,
  );
  const resealed: Record<string, SealedCapabilityResults> = {
    [latest.anthropic_model]: evaluation.sealCapabilityResults(
      'anthropic',
      latest.anthropic_model,
      latestRevision,
      shipped(existing.anthropic_model).runs,
      '2026-11-03',
    ),
    [latest.openai_model]: evaluation.sealCapabilityResults(
      'openai',
      latest.openai_model,
      latestRevision,
      shipped(existing.openai_model).runs,
      '2026-11-03',
    ),
  };
  const catalogue = evaluation.buildCapabilityCatalogue(
    corpus.REVIEWER_CAPABILITY_MANIFEST,
    corpus.REVIEWER_CAPABILITY_RUBRICS,
    corpus.REVIEWER_CAPABILITY_PINNED_PAIRS,
    model => resealed[model] ?? shipped(model),
  );
  return {
    ...actual,
    PACKAGED_CAPABILITY_REVISIONS: catalogue.revisions,
    PACKAGED_CAPABILITY_PAIRS: catalogue.pairs,
  };
});

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
        evidence_records: { schema_version: 1, records: [] },
        reviewer_agent: reviewer,
        verdict: 'approve',
        summary: 'Qualified approval.',
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

it('admits a second qualified pinned pair through the planning review route', async () => {
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
      crossAgentReviewRoutes: { claude: [{ reviewer: 'codex', model: 'gpt-6.1-sol' }] },
    }),
  );
  const ticket = '.project/tickets/PAR123-second-pair';
  mkdirSync(nodePath.join(project, ticket), { recursive: true });
  writeFileSync(
    nodePath.join(project, ticket, 'ticket.md'),
    '---\nid: PAR123\ntype: feature\nphase: plan-implementation\nstatus: in_progress\nproduct_plan_contract: v1\nscope: second pair review\nout_of_scope: route changes\ndone_when: second pair is admitted\nphase_anchors:\n  - scenario-gate: features/second-pair.feature\n---\n',
  );
  writeFileSync(nodePath.join(project, ticket, 'spec.md'), PLANNING_ROLE_PRODUCT);
  writeFileSync(
    nodePath.join(project, ticket, 'impl-plan.md'),
    '# Implementation Plan\n\n**Status:** planned\n\n## Approach\n\nAdmit every qualified pinned pair.\n\n## Decisions\n\nBind records to their own pair.\n\n## Design alignment\n\nUse the current plan.\n\n## Architecture applicability\n\nskip: no architecture records apply\n\n## Data applicability\n\nskip: no product data changes\n\n## Known deviations\n\nskip: none\n\n## Doc impact\n\nskip: no customer docs change\n\n## Assessment triggers\n\nRevisit if review authority changes.\n',
  );
  mkdirSync(nodePath.join(project, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(project, 'features/second-pair.feature'),
    '@second-pair.BU1.R1\nFeature: Second pair\n  Scenario: Qualified second pair\n    Given the latest pair has sealed evidence\n    When review runs\n    Then its reviewer is admitted\n',
  );
  vi.stubEnv('SAFEWORD_AGENT_RUNTIME', 'claude');
  vi.stubEnv('SAFEWORD_AUTHOR_MODEL', 'claude-opus-5-5');

  const result = await runReview({
    cwd: project,
    kind: 'plan-implementation',
    targets: [`${ticket}/impl-plan.md`],
    context: [`${ticket}/spec.md`],
  });

  expect(result.data).toMatchObject({
    status: 'approved',
    actual_reviewer: 'codex',
    independence: 'cross-agent',
    review_routes: [{ model: 'gpt-6.1-sol', status: 'attempted' }],
  });
  expect(JSON.stringify(result.data)).not.toContain('reviewer_capability_unknown');
});
