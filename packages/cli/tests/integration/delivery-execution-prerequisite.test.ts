import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findCommandDefinition } from '../../src/cli-protocol/catalog.js';
import { publicHandler } from '../../src/cli-protocol/public-handlers.js';
import type { CliResult } from '../../src/cli-protocol/result.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';

const reviews = vi.hoisted(() => new Map<string, CliResult>());

vi.mock('../../src/review/job.js', () => ({
  reviewJobStatus: (_cwd: string, id: string) => reviews.get(id),
}));

const CATEGORIES = [
  'outcome and scope',
  'resolved decisions',
  'dependency and pull-request decomposition',
  'testing',
  'data and compatibility',
  'monitoring and failure signals',
  'security and privacy',
  'rollout and rollback',
  'documentation',
  'ownership and human dependencies',
  'completion evidence',
] as const;

function executionPlan(): string {
  const rows = CATEGORIES.map(
    (category, index) =>
      `| item-${index + 1} | ${category} | Deliver ${category}. | contributor | proof | open | missing |  |  |`,
  );
  return [
    '# Execution Plan',
    '',
    '## Proof specifications',
    '',
    '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| proof | command | integration | public prerequisite | real_boundary | current_required | {"type":"command","cwd":".","argv":[${JSON.stringify(process.execPath)},"--version"]} |`,
    '',
    '## Delivery checklist',
    '',
    '<!-- safeword:delivery-checklist:v1 -->',
    '',
    '| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function reviewResult(
  kind: 'scenario-gate' | 'plan-implementation' | 'plan-execution',
  target: string,
  plan?: string,
): CliResult {
  let executionPlanRecord: Record<string, unknown> | undefined;
  if (kind === 'plan-execution' && plan !== undefined) {
    const parsed = parseDeliveryPlanContract(plan);
    if (!parsed.ok) throw new Error(parsed.message);
    executionPlanRecord = {
      slicing_decision: 'one_pull_request',
      rationale: 'One coherent contribution.',
      slices: [
        {
          name: 'Contribution',
          purpose: 'Deliver the contribution.',
          boundary: 'Public prerequisite.',
          prerequisites: [],
          proof: 'Integration test.',
          completion_signal: 'The prerequisite is observable.',
          relies_on_unmerged_successor: false,
        },
      ],
      obligation_owners: [{ obligation: 'Contribution', slices: ['Contribution'] }],
      decision_statuses: [{ decision: 'Use the accepted plans', status: 'unchanged' }],
      accepted_scenarios_covered: true,
      accepted_approach_preserved: true,
      normalized_plan_digest: normalizedExecutionPlanDigest(plan),
      delivery_definition: createExecutionPlanDeliveryDefinition(parsed, false),
    };
  }
  return {
    schemaVersion: 1,
    ok: true,
    state: 'healthy',
    changed: false,
    findings: [],
    effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
    errors: [],
    recovery: [],
    nextActions: [],
    data: {
      command: 'review status',
      status: 'approved',
      review_kind: kind,
      review_targets: [target],
      author_agent: 'codex',
      actual_reviewer: 'claude',
      independence: 'cross-agent',
      reviewer_output: {
        schema_version: 1,
        dispatch_id: `${kind}-dispatch`,
        reviewer_agent: 'claude',
        verdict: 'approve',
        summary: 'approved',
        findings: [],
        ...(executionPlanRecord !== undefined && {
          execution_plan_record: executionPlanRecord,
        }),
      },
    },
  };
}

function featureFixture(
  admitted: readonly ('scenario-gate' | 'plan-implementation' | 'plan-execution')[],
): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-'));
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
  const featurePath = nodePath.join(root, 'features', 'feature.feature');
  const implementationPath = nodePath.join(ticketDirectory, 'impl-plan.md');
  const executionPath = nodePath.join(ticketDirectory, 'execution-plan.md');
  const plan = executionPlan();
  mkdirSync(ticketDirectory, { recursive: true });
  mkdirSync(nodePath.dirname(featurePath), { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(root, '.safeword', 'config.json'), '{}\n');
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    '---\ntype: feature\nphase: plan-execution\n---\n',
  );
  writeFileSync(featurePath, 'Feature: Accepted behavior\n');
  writeFileSync(implementationPath, '# Implementation Plan\n');
  writeFileSync(executionPath, plan);
  const targets = {
    'scenario-gate': nodePath.relative(root, featurePath),
    'plan-implementation': nodePath.relative(root, implementationPath),
    'plan-execution': nodePath.relative(root, executionPath),
  } as const;
  const lines = admitted.map(kind => {
    const id = `${kind}-review`;
    reviews.set(id, reviewResult(kind, targets[kind], plan));
    return `2026-09-13T00:00:00.000Z fixture review:ABC123-feature:phase@${kind} author:codex reviewer:claude independence:cross-agent review-id:${id}`;
  });
  writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), `${lines.join('\n')}\n`);
  return root;
}

function legacyFeatureFixture(phase: 'implement' | 'verify'): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-legacy-'));
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-legacy');
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    `---\ntype: feature\nphase: ${phase}\n---\n`,
  );
  return root;
}

describe('delivery execution prerequisite', () => {
  beforeEach(() => {
    reviews.clear();
  });

  it('is registered as a public observe-only CLI command', () => {
    expect(findCommandDefinition('ticket execution-prerequisite')).toMatchObject({
      name: 'ticket execution-prerequisite',
      effectClass: 'observe',
      networkPolicy: 'never',
      syntax: 'execution-prerequisite <ticketId>',
    });
  });

  it('returns a satisfied deny-only verdict for all three admitted planning contracts', async () => {
    const root = featureFixture(['scenario-gate', 'plan-implementation', 'plan-execution']);

    const result = await publicHandler('ticket execution-prerequisite')({
      cwd: root,
      noInput: true,
      offline: false,
      operands: ['ABC123'],
      options: {},
    });

    expect(result).toMatchObject({
      state: 'healthy',
      data: {
        command: 'ticket execution-prerequisite',
        prerequisite_status: 'satisfied',
        grants_authority: false,
      },
    });
  });

  it('reports every missing prerequisite once in deterministic planning order', async () => {
    const root = featureFixture([]);

    const result = await publicHandler('ticket execution-prerequisite')({
      cwd: root,
      noInput: true,
      offline: false,
      operands: ['ABC123'],
      options: {},
    });

    expect(result).toMatchObject({ state: 'action_required' });
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_accepted_scenarios',
      'missing_accepted_approach',
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.nextActions).toHaveLength(3);
  });

  it.each([
    ['accepted scenarios', ['plan-implementation', 'plan-execution'], 'missing_accepted_scenarios'],
    [
      'accepted implementation approach',
      ['scenario-gate', 'plan-execution'],
      'missing_accepted_approach',
    ],
    [
      'admitted Delivery Checklist',
      ['scenario-gate', 'plan-implementation'],
      'missing_admitted_delivery_checklist',
    ],
  ] as const)(
    'denies only the missing %s prerequisite with one repair',
    async (_label, admitted, expectedCode) => {
      const root = featureFixture(admitted);

      const result = await publicHandler('ticket execution-prerequisite')({
        cwd: root,
        noInput: true,
        offline: false,
        operands: ['ABC123'],
        options: {},
      });

      expect(result.findings.map(finding => finding.code)).toEqual([expectedCode]);
      expect(result.nextActions).toHaveLength(1);
    },
  );

  it.each(['task', 'patch'] as const)('keeps %s work outside the feature contract', async type => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-small-'));
    const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-small');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), `---\ntype: ${type}\n---\n`);

    const result = await publicHandler('ticket execution-prerequisite')({
      cwd: root,
      noInput: true,
      offline: false,
      operands: ['ABC123'],
      options: {},
    });

    expect(result).toMatchObject({
      state: 'healthy',
      data: { prerequisite_status: 'not_applicable', grants_authority: false },
    });
  });

  it.each(['implement', 'verify'] as const)(
    'keeps a legacy feature already in %s outside the new prerequisite',
    async phase => {
      const root = legacyFeatureFixture(phase);

      const result = await publicHandler('ticket execution-prerequisite')({
        cwd: root,
        noInput: true,
        offline: false,
        operands: ['ABC123'],
        options: {},
      });

      expect(result).toMatchObject({
        state: 'healthy',
        data: { prerequisite_status: 'not_applicable', grants_authority: false },
      });
    },
  );
});
