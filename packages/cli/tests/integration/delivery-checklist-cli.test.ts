import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publicHandler } from '../../src/cli-protocol/public-handlers.js';
import type { CliResult } from '../../src/cli-protocol/result.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { appendDesignDecision } from '../../src/review/approval-ledger.js';

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

function executionPlan(
  currency: 'current_required' | 'compatible_earlier_allowed' = 'current_required',
): string {
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
    `| proof | command | integration | retained child process | real_boundary | ${currency} | {"type":"command","cwd":".","argv":[${JSON.stringify(process.execPath)},"-e","process.exit(0)"]} |`,
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

function settledPlan(finalOwner: 'contributor' | 'generic-human' | 'design-approval'): string {
  const implementationDigest = createHash('sha256').update('# Implementation Plan\n').digest('hex');
  return executionPlan()
    .split('\n')
    .map(line => {
      if (!/^\| item-\d+ \|/u.test(line)) return line;
      if (line.startsWith('| item-4 |')) return line;
      if (line.startsWith('| item-11 |') && finalOwner !== 'contributor') {
        const dependency =
          finalOwner === 'design-approval'
            ? `design-approval:ABC123:${implementationDigest}`
            : 'security-review';
        return `| item-11 | completion evidence | Deliver completion evidence. | human |  | pending_human | missing |  | ${dependency} |`;
      }
      return line.replace(
        /\| contributor \| proof \| open \| missing \| {2}\| {2}\|$/u,
        '| contributor |  | not_applicable | missing |  | No applicable delivery work. |',
      );
    })
    .join('\n');
}

function fixture(options: { plan?: string; designApprovalGate?: boolean } = {}): {
  root: string;
  planPath: string;
} {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-delivery-cli-'));
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
  const planPath = nodePath.join(ticketDirectory, 'execution-plan.md');
  mkdirSync(ticketDirectory, { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(root, '.safeword', 'config.json'),
    `${JSON.stringify({ designApprovalGate: options.designApprovalGate === true })}\n`,
  );
  writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), '---\ntype: feature\n---\n');
  writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), '# Implementation Plan\n');
  writeFileSync(planPath, options.plan ?? executionPlan());
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
  const definition = createExecutionPlanDeliveryDefinition(
    parsed,
    options.designApprovalGate === true,
  );
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

  it('distinguishes contributor completion, pending human work, and satisfied design approval', async () => {
    const contributor = fixture({ plan: settledPlan('contributor') });
    expect(await recordDeliveryProof(contributor.root, 'ABC123', 'item-4', 'proof')).toMatchObject({
      state: 'changed',
    });
    expect(observeDeliveryChecklist(contributor.root, 'ABC123')).toMatchObject({
      state: 'action_required',
      data: { readiness_state: 'contributor_work_complete' },
    });

    const pending = fixture({ plan: settledPlan('generic-human') });
    expect(await recordDeliveryProof(pending.root, 'ABC123', 'item-4', 'proof')).toMatchObject({
      state: 'changed',
    });
    expect(observeDeliveryChecklist(pending.root, 'ABC123')).toMatchObject({
      state: 'action_required',
      data: {
        readiness_state: 'ready_for_human_review',
        pending_human_items: ['item-11'],
      },
    });

    const approved = fixture({
      plan: settledPlan('design-approval'),
      designApprovalGate: true,
    });
    expect(await recordDeliveryProof(approved.root, 'ABC123', 'item-4', 'proof')).toMatchObject({
      state: 'changed',
    });
    const digest = createHash('sha256').update('# Implementation Plan\n').digest('hex');
    expect(
      appendDesignDecision(nodePath.join(approved.root, '.project', 'skill-invocations.log'), {
        ticket: 'ABC123',
        planDigest: digest,
        decision: 'approved',
        authorityRef: 'human:test',
      }),
    ).toEqual({ status: 'written' });
    expect(observeDeliveryChecklist(approved.root, 'ABC123')).toMatchObject({
      state: 'action_required',
      data: { readiness_state: 'human_approval_satisfied_merge_pending' },
    });
  });

  it('discloses full-diff egress before reviewing an earlier proof', async () => {
    const { root, planPath } = fixture({
      plan: executionPlan('compatible_earlier_allowed'),
    });
    const recorded = await recordDeliveryProof(root, 'ABC123', 'item-4', 'proof');
    const receipt = (recorded.data as { receipt_id?: string }).receipt_id;
    expect(receipt).toEqual(expect.any(String));
    git(root, ['add', '.project']);
    git(root, ['commit', '--quiet', '-m', 'record proof']);
    writeFileSync(nodePath.join(root, 'documentation.md'), '# Later documentation\n');
    git(root, ['add', 'documentation.md']);
    git(root, ['commit', '--quiet', '-m', 'document behavior']);
    const planBeforeConfirmation = readFileSync(planPath, 'utf8');

    const result = await publicHandler('ticket record-delivery-proof')({
      cwd: root,
      noInput: true,
      offline: false,
      operands: ['ABC123', 'item-4', 'proof'],
      options: {
        receipt,
        compatibleReason: 'The later commit changes documentation only.',
      },
    });

    expect(result).toMatchObject({
      state: 'action_required',
      changed: false,
      effects: { network: [] },
    });
    expect(result.findings[0]).toMatchObject({
      code: 'compatibility_review_confirmation_required',
      message: expect.stringContaining('complete contribution diff will leave this machine'),
    });
    expect(result.nextActions).toEqual([
      expect.objectContaining({
        command: expect.stringContaining('--confirm-egress'),
        requiresHuman: true,
      }),
    ]);
    expect(existsSync(nodePath.join(root, '.safeword', 'state', 'reviews'))).toBe(false);
    expect(readFileSync(planPath, 'utf8')).toBe(planBeforeConfirmation);
    expect(planBeforeConfirmation).toContain(
      `| item-4 | testing | Deliver testing. | contributor | proof | complete | current_revision_real_boundary |`,
    );
    expect(planBeforeConfirmation).not.toContain('reusable_earlier_revision');
    expect(planBeforeConfirmation).not.toContain('; compatible:');
  });
});
