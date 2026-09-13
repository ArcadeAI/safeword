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

const review = vi.hoisted(() => ({
  result: undefined as CliResult | undefined,
  compatibilityResult: undefined as CliResult | undefined,
  starts: [] as unknown[],
}));

vi.mock('../../src/review/job.js', () => ({
  reviewJobStatus: () => review.result,
  startReviewJob: (input: unknown) => {
    review.starts.push(input);
    const result = review.compatibilityResult;
    if (result === undefined) return Promise.resolve(result);
    const request = input as { targets: string[] };
    const data = result.data as Record<string, unknown> | undefined;
    return Promise.resolve({
      ...result,
      data: data === undefined ? data : { ...data, review_targets: request.targets },
    });
  },
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
  writeFileSync(nodePath.join(root, '.gitignore'), '.safeword/state/\n');
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

async function earlierProofFixture(change: string | Buffer = '# Later documentation\n'): Promise<{
  readonly root: string;
  readonly planPath: string;
  readonly receipt: string;
}> {
  const created = fixture({ plan: executionPlan('compatible_earlier_allowed') });
  const recorded = await recordDeliveryProof(created.root, 'ABC123', 'item-4', 'proof');
  const receipt = (recorded.data as { receipt_id?: string }).receipt_id;
  if (receipt === undefined) throw new Error('delivery receipt missing');
  git(created.root, ['add', '.project']);
  git(created.root, ['commit', '--quiet', '-m', 'record proof']);
  writeFileSync(nodePath.join(created.root, 'later-change'), change);
  git(created.root, ['add', 'later-change']);
  git(created.root, ['commit', '--quiet', '-m', 'later change']);
  return { ...created, receipt };
}

function compatibilityReviewResult(input: {
  readonly status: string;
  readonly finding?: string;
  readonly independence?: string;
}): CliResult {
  return {
    schemaVersion: 1,
    ok: true,
    state: 'action_required',
    changed: false,
    findings:
      input.finding === undefined
        ? []
        : [{ code: input.finding, message: input.finding, severity: 'warning' }],
    effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
    errors: [],
    recovery:
      input.finding === 'REVIEW_AUTHENTICATION_REQUIRED'
        ? [
            {
              command: 'claude auth login',
              description: 'Sign in to Claude, then retry.',
              requiresHuman: true,
            },
          ]
        : [],
    nextActions: [],
    data: {
      command: 'review run',
      status: input.status,
      review_id: 'compatibility-review-1',
      review_kind: 'delivery-compatibility',
      author_agent: 'codex',
      assigned_reviewer: 'claude',
      actual_reviewer: 'claude',
      independence: input.independence ?? 'cross-agent',
      reviewer_output: {
        schema_version: 1,
        dispatch_id: 'dispatch-compatibility-1',
        reviewer_agent: 'claude',
        verdict: input.status === 'approved' ? 'approve' : 'request_changes',
        summary: input.status,
        findings: [],
      },
    },
  };
}

describe('Delivery Checklist CLI service', () => {
  beforeEach(() => {
    review.result = undefined;
    review.compatibilityResult = undefined;
    review.starts = [];
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
    const reason = 'The later commit changes documentation only.';
    const planBeforeConfirmation = readFileSync(planPath, 'utf8');

    const result = await publicHandler('ticket record-delivery-proof')({
      cwd: root,
      noInput: true,
      offline: false,
      operands: ['ABC123', 'item-4', 'proof'],
      options: {
        receipt,
        compatibleReason: reason,
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

  it('dispatches the exact earlier-proof request only after egress confirmation', async () => {
    const { root, planPath } = fixture({
      plan: executionPlan('compatible_earlier_allowed'),
    });
    const recorded = await recordDeliveryProof(root, 'ABC123', 'item-4', 'proof');
    const proofData = recorded.data as {
      receipt_id?: string;
      producing_revision?: string;
    };
    const receipt = proofData.receipt_id;
    const producingRevision = proofData.producing_revision;
    expect(receipt).toEqual(expect.any(String));
    expect(producingRevision).toEqual(expect.any(String));
    git(root, ['add', '.project']);
    git(root, ['commit', '--quiet', '-m', 'record proof']);
    writeFileSync(nodePath.join(root, 'documentation.md'), '# Later documentation\n');
    git(root, ['add', 'documentation.md']);
    git(root, ['commit', '--quiet', '-m', 'document behavior']);
    const reviewedRevision = git(root, ['rev-parse', 'HEAD']);
    const currentPlan = readFileSync(planPath, 'utf8');
    const parsed = parseDeliveryPlanContract(currentPlan);
    if (!parsed.ok) throw new Error(parsed.message);
    const reason = 'The later commit changes documentation only.';
    const definitionDigest = createHash('sha256')
      .update(JSON.stringify(createExecutionPlanDeliveryDefinition(parsed, false)))
      .digest('hex');
    const reasonDigest = createHash('sha256').update(reason).digest('hex');
    review.compatibilityResult = {
      schemaVersion: 1,
      ok: true,
      state: 'action_required',
      changed: false,
      findings: [],
      effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
      errors: [],
      recovery: [],
      nextActions: [],
      data: { command: 'review run', status: 'pending', review_id: 'compatibility-review-1' },
    };

    const result = await publicHandler('ticket record-delivery-proof')({
      cwd: root,
      noInput: true,
      offline: false,
      operands: ['ABC123', 'item-4', 'proof'],
      options: {
        receipt,
        compatibleReason: reason,
        confirmEgress: true,
      },
    });

    expect(result).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'compatibility_review_pending' }],
      effects: {
        network: [{ kind: 'review', target: 'configured external reviewer' }],
      },
    });
    expect(result.nextActions).toEqual([
      expect.objectContaining({
        command: expect.stringContaining('--confirm-egress'),
        requiresHuman: false,
      }),
    ]);
    expect(review.starts).toEqual([
      expect.objectContaining({
        cwd: root,
        kind: 'delivery-compatibility',
        targets: [expect.stringMatching(/^\.safeword\/state\/reviews\/requests\/.+\.md$/u)],
      }),
    ]);
    const target = (review.starts[0] as { targets: string[] }).targets[0];
    expect(target).toEqual(expect.any(String));
    if (target === undefined) throw new Error('compatibility request target missing');
    const request = readFileSync(nodePath.join(root, target), 'utf8');
    expect(request).toContain('Ticket: `ABC123`');
    expect(request).toContain('Checklist item: `item-4`');
    expect(request).toContain('Proof ID: `proof`');
    expect(request).toContain(`Retained definition digest: \`${definitionDigest}\``);
    expect(request).toContain(`Delivery receipt: \`${receipt}\``);
    expect(request).toContain(`Reason digest: \`${reasonDigest}\``);
    expect(request).toContain(`Producing revision: \`${producingRevision}\``);
    expect(request).toContain(`Reviewed revision: \`${reviewedRevision}\``);
    expect(request).toContain(reason);
    expect(request).toContain('diff --git a/documentation.md b/documentation.md');
    expect(readFileSync(planPath, 'utf8')).not.toContain('reusable_earlier_revision');
  });

  it('records an approved compatibility review before reusing earlier proof', async () => {
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
    review.compatibilityResult = {
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
        command: 'review run',
        status: 'approved',
        review_id: 'compatibility-review-1',
        review_kind: 'delivery-compatibility',
        author_agent: 'codex',
        assigned_reviewer: 'claude',
        actual_reviewer: 'claude',
        independence: 'cross-agent',
        reviewer_output: {
          schema_version: 1,
          dispatch_id: 'dispatch-compatibility-1',
          reviewer_agent: 'claude',
          verdict: 'approve',
          summary: 'Documentation-only delta is compatible.',
          findings: [],
        },
      },
    };

    const result = await publicHandler('ticket record-delivery-proof')({
      cwd: root,
      noInput: true,
      offline: false,
      operands: ['ABC123', 'item-4', 'proof'],
      options: {
        receipt,
        compatibleReason: 'The later commit changes documentation only.',
        confirmEgress: true,
      },
    });

    expect(result).toMatchObject({
      state: 'changed',
      data: { item_id: 'item-4', receipt_id: receipt },
    });
    expect(readFileSync(planPath, 'utf8')).toContain(
      `| item-4 | testing | Deliver testing. | contributor | proof | complete | reusable_earlier_revision |`,
    );
    expect(readFileSync(planPath, 'utf8')).toContain(
      `receipt:${receipt}; compatible:The later commit changes documentation only.`,
    );
    expect(
      readFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), 'utf8'),
    ).toContain('delivery-compatibility:v1:');
    expect(
      (observeDeliveryChecklist(root, 'ABC123').data as { open_contributor_items: string[] })
        .open_contributor_items,
    ).not.toContain('item-4');
  });

  it.each([
    [
      'changes_requested',
      undefined,
      'cross-agent',
      'compatibility_review_denied',
      "safeword ticket record-delivery-proof 'ABC123' 'item-4' 'proof'",
    ],
    [
      'blocked',
      'REVIEW_AUTHENTICATION_REQUIRED',
      'none',
      'compatibility_review_authentication_required',
      'claude auth login',
    ],
    [
      'blocked',
      'REVIEW_ROUTES_EXHAUSTED',
      'none',
      'compatibility_review_unavailable',
      "safeword ticket record-delivery-proof 'ABC123' 'item-4' 'proof'",
    ],
    [
      'existing_route',
      'REVIEW_NOT_REQUESTED',
      'none',
      'compatibility_review_disabled',
      "safeword ticket record-delivery-proof 'ABC123' 'item-4' 'proof'",
    ],
    ['approved', undefined, 'degraded', 'compatibility_review_stale', '--confirm-egress'],
  ])(
    'maps review outcome %s/%s to its compatibility recovery',
    async (status, finding, independence, expectedCode, expectedAction) => {
      const { root, planPath, receipt } = await earlierProofFixture();
      review.compatibilityResult = compatibilityReviewResult({
        status,
        independence,
        ...(finding !== undefined && { finding }),
      });

      const result = await publicHandler('ticket record-delivery-proof')({
        cwd: root,
        noInput: true,
        offline: false,
        operands: ['ABC123', 'item-4', 'proof'],
        options: {
          receipt,
          compatibleReason: 'The later commit changes documentation only.',
          confirmEgress: true,
        },
      });

      expect(result).toMatchObject({
        state: 'action_required',
        findings: [{ code: expectedCode }],
      });
      expect(result.nextActions).toEqual([
        expect.objectContaining({ command: expect.stringContaining(expectedAction) }),
      ]);
      expect(readFileSync(planPath, 'utf8')).not.toContain('reusable_earlier_revision');
      expect(
        readFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), 'utf8'),
      ).not.toContain('delivery-compatibility:v1:');
    },
  );

  it.each([
    ['secret', `token ghp_${'a'.repeat(36)}\n`, 'compatibility_sensitive_content'],
    ['binary', Buffer.from([0, 1, 2, 3]), 'compatibility_diff_unavailable'],
  ])('refuses a %s compatibility diff without egress', async (_name, change, expectedCode) => {
    const { root, receipt } = await earlierProofFixture(change);

    const result = await publicHandler('ticket record-delivery-proof')({
      cwd: root,
      noInput: true,
      offline: false,
      operands: ['ABC123', 'item-4', 'proof'],
      options: {
        receipt,
        compatibleReason: 'The later commit is unrelated.',
        confirmEgress: true,
      },
    });

    expect(result).toMatchObject({
      state: 'action_required',
      findings: [{ code: expectedCode }],
      effects: { network: [] },
    });
    expect(review.starts).toEqual([]);
  });
});
