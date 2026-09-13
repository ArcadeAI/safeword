import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CliResult } from '../../src/cli-protocol/result.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';

const review = vi.hoisted(() => ({ result: undefined as CliResult | undefined }));

vi.mock('../../src/review/job.js', () => ({
  reviewJobStatus: () => review.result,
}));

const { observeDeliveryChecklist, recordDeliveryProof } =
  await import('../../src/commands/delivery-checklist.js');

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

function git(cwd: string, arguments_: readonly string[]): string {
  return execFileSync('git', arguments_, { cwd, encoding: 'utf8' }).trim();
}

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
    `| proof | command | integration | retained child process | real_boundary | current_required | {"type":"command","cwd":".","argv":[${JSON.stringify(process.execPath)},"-e","process.exit(0)"]} |`,
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

function fixture(): { root: string; planPath: string } {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-delivery-cli-'));
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
  const planPath = nodePath.join(ticketDirectory, 'execution-plan.md');
  mkdirSync(ticketDirectory, { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(root, '.safeword', 'config.json'), '{}\n');
  writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), '---\ntype: feature\n---\n');
  writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), '# Implementation Plan\n');
  writeFileSync(planPath, executionPlan());
  writeFileSync(
    nodePath.join(root, '.project', 'skill-invocations.log'),
    '2026-09-12T00:00:00.000Z fixture review:ABC123-feature:phase@plan-execution author:codex reviewer:claude independence:cross-agent review-id:review-1\n',
  );
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'proof@example.com']);
  git(root, ['config', 'user.name', 'Proof Test']);
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'fixture']);

  const content = readFileSync(planPath, 'utf8');
  const parsed = parseDeliveryPlanContract(content);
  if (!parsed.ok) throw new Error(parsed.message);
  const definition = createExecutionPlanDeliveryDefinition(parsed, false);
  review.result = {
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
      review_kind: 'plan-execution',
      review_targets: [nodePath.relative(root, planPath)],
      reviewer_output: {
        schema_version: 1,
        dispatch_id: 'dispatch-1',
        reviewer_agent: 'claude',
        verdict: 'approve',
        summary: 'approved',
        findings: [],
        execution_plan_record: {
          slicing_decision: 'one_pull_request',
          rationale: 'One coherent change.',
          slices: [
            {
              name: 'Delivery CLI',
              purpose: 'Record delivery proof.',
              boundary: 'Public CLI.',
              prerequisites: [],
              proof: 'Integration test.',
              completion_signal: 'Receipt retained.',
              relies_on_unmerged_successor: false,
            },
          ],
          obligation_owners: [{ obligation: 'Delivery', slices: ['Delivery CLI'] }],
          decision_statuses: [{ decision: 'Use checklist', status: 'unchanged' }],
          accepted_scenarios_covered: true,
          accepted_approach_preserved: true,
          normalized_plan_digest: normalizedExecutionPlanDigest(content),
          delivery_definition: definition,
        },
      },
    },
  };
  return { root, planPath };
}

describe('Delivery Checklist CLI service', () => {
  beforeEach(() => {
    review.result = undefined;
  });

  it('records retained proof and immediately reports the next open obligation', async () => {
    const { root, planPath } = fixture();

    expect(observeDeliveryChecklist(root, 'ABC123')).toMatchObject({
      state: 'action_required',
      data: { readiness_state: 'contributor_work_incomplete' },
    });
    const recorded = await recordDeliveryProof(root, 'ABC123', 'item-4', 'proof');

    expect(recorded).toMatchObject({
      state: 'changed',
      data: {
        item_id: 'item-4',
        proof_id: 'proof',
        receipt_id: expect.any(String),
        next_open_obligation: 'Deliver outcome and scope.',
      },
    });
    expect(readFileSync(planPath, 'utf8')).toContain(
      '| item-4 | testing | Deliver testing. | contributor | proof | complete | current_revision_real_boundary |',
    );
    expect(
      readFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), 'utf8'),
    ).toContain('delivery-proof:v1:');

    git(root, ['add', '.project']);
    git(root, ['commit', '--quiet', '-m', 'record proof']);
    expect(observeDeliveryChecklist(root, 'ABC123')).toMatchObject({
      data: { readiness_state: 'contributor_work_incomplete' },
    });

    writeFileSync(nodePath.join(root, 'source.ts'), 'export const changed = true;\n');
    git(root, ['add', 'source.ts']);
    git(root, ['commit', '--quiet', '-m', 'change source']);
    expect(observeDeliveryChecklist(root, 'ABC123')).toMatchObject({
      data: {
        readiness_state: 'contributor_work_incomplete',
        open_contributor_items: expect.arrayContaining(['item-4']),
      },
    });
  });

  it('requires an admitted execution-plan review before projecting readiness', () => {
    const { root } = fixture();
    review.result = {
      schemaVersion: 1,
      ok: false,
      state: 'failed',
      changed: false,
      findings: [],
      effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
      errors: [],
      recovery: [],
      nextActions: [],
    };

    expect(observeDeliveryChecklist(root, 'ABC123')).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'review_required' }],
      data: { command: 'ticket delivery-checklist' },
    });
  });
});
