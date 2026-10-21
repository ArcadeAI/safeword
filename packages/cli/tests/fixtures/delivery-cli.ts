import { createHmac } from 'node:crypto';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect } from 'vitest';

import type { CliResult } from '../../src/cli-protocol/result.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { runCli } from '../helpers.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

type PlanningReviewKind = 'scenario-gate' | 'plan-implementation' | 'plan-execution';

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

export function executionPlan(): string {
  const rows = CATEGORIES.map(
    (category, index) =>
      `| item-${index + 1} | ${category} | Deliver ${category}. | contributor | proof | open | missing |  |  |`,
  );
  return [
    '# Execution Plan',
    '',
    '**Status:** planned',
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

export function featureFixture(
  designApprovalGate = false,
  phase = 'plan-execution',
  plan = executionPlan(),
): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-'));
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
  const featurePath = nodePath.join(root, 'features', 'feature.feature');
  const implementationPath = nodePath.join(ticketDirectory, 'impl-plan.md');
  const executionPath = nodePath.join(ticketDirectory, 'execution-plan.md');
  mkdirSync(ticketDirectory, { recursive: true });
  mkdirSync(nodePath.dirname(featurePath), { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(root, '.safeword', 'config.json'),
    `${JSON.stringify({
      designApprovalGate,
      crossAgentReviewRoutes: {
        codex: [{ reviewer: 'claude', model: 'opus' }],
      },
    })}\n`,
  );
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    `---\ntype: feature\nphase: ${phase}\n---\n`,
  );
  writeFileSync(featurePath, 'Feature: Accepted behavior\n');
  writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Product Plan\n');
  writeFileSync(implementationPath, '# Implementation Plan\n');
  writeFileSync(executionPath, plan);
  writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), '');
  return root;
}

export function legacyFeatureFixture(phase: 'implement' | 'verify'): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-legacy-'));
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-legacy');
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    `---\ntype: feature\nphase: ${phase}\n---\n`,
  );
  return root;
}

export function installReviewer(): string {
  const directory = createTrustedReviewerDirectory('safeword-prerequisite-');
  const bin = nodePath.join(directory, 'bin');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'claude');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if [ "${'$'}{1:-}" = "--version" ]; then printf 'claude 1.0.0\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES.claude}'
  exit 0
fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
record=$(printenv SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD || true)
verdict=$(printenv SAFEWORD_REVIEW_FAKE_VERDICT || true)
finding=$(printenv SAFEWORD_REVIEW_FAKE_FINDING || true)
if [ "$verdict" = "request_changes" ] && printf '%s' "$payload" | /usr/bin/grep -q '"kind":"delivery-compatibility"'; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"earlier proof is incompatible","findings":[{"severity":"error","message":"%s"}]}\n' "$dispatch_id" "$finding"
elif [ "$verdict" = "request_changes" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"plan needs repair","findings":[{"severity":"error","message":"%s"}],"planning_destination":"plan-execution","execution_plan_record":null}\n' "$dispatch_id" "$finding"
elif [ -n "$record" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved","findings":[],"planning_destination":"plan-execution","execution_plan_record":%s}\n' "$dispatch_id" "$record"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved","findings":[]}\n' "$dispatch_id"
fi
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function admitPlanExecutionFixture(
  root: string,
  reviewId: string,
  target: string,
  executionPlanRecord: Record<string, unknown>,
): void {
  const path = nodePath.join(root, '.safeword', 'state', 'reviews', `${reviewId}.json`);
  const record = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const { integrity: _integrity, ...unsigned } = record;
  const result: CliResult = {
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
      review_kind: 'plan-execution',
      review_targets: [target],
      author_agent: 'codex',
      actual_reviewer: 'claude',
      independence: 'reduced',
      reviewer_output: {
        schema_version: 1,
        dispatch_id: 'plan-execution-fixture',
        evidence_records: { schema_version: 1, records: [] },
        reviewer_agent: 'claude',
        verdict: 'approve',
        summary: 'approved fixture',
        findings: [],
        planning_destination: 'plan-execution',
        execution_plan_record: executionPlanRecord,
      },
    },
  };
  const completed = {
    ...unsigned,
    state: 'completed',
    updated_at: '2026-09-13T00:00:00.000Z',
    result,
  };
  const key = Buffer.from(
    readFileSync(
      nodePath.join(root, '.review-keys', 'safeword', 'review-integrity.key'),
      'utf8',
    ).trim(),
    'hex',
  );
  const integrity = createHmac('sha256', key)
    .update(realpathSync.native(root))
    .update('\0')
    .update(JSON.stringify(completed))
    .digest('hex');
  writeFileSync(path, `${JSON.stringify({ ...completed, integrity })}\n`);
}

export function rejectAdmittedScenarioReview(root: string): void {
  const ledger = readFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), 'utf8');
  const reviewId = /phase@scenario-gate[^\n]*review-id:(\S+)/.exec(ledger)?.[1];
  if (reviewId === undefined) throw new Error('scenario-gate review id missing');
  const path = nodePath.join(root, '.safeword', 'state', 'reviews', `${reviewId}.json`);
  const record = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const { integrity: _integrity, ...unsigned } = record;
  const result = { ...(unsigned.result as Record<string, unknown>) };
  const data = { ...(result.data as Record<string, unknown>) };
  result.data = {
    ...data,
    status: 'changes_requested',
    reviewer_output: {
      ...(data.reviewer_output as Record<string, unknown>),
      verdict: 'request_changes',
    },
  };
  const changed = { ...unsigned, result };
  const key = Buffer.from(
    readFileSync(
      nodePath.join(root, '.review-keys', 'safeword', 'review-integrity.key'),
      'utf8',
    ).trim(),
    'hex',
  );
  const integrity = createHmac('sha256', key)
    .update(realpathSync.native(root))
    .update('\0')
    .update(JSON.stringify(changed))
    .digest('hex');
  writeFileSync(path, `${JSON.stringify({ ...changed, integrity })}\n`);
}

function admittedReviewId(
  root: string,
  reviewKind: PlanningReviewKind,
  target: string,
  executionPlanRecord: Record<string, unknown>,
  reviewed: Awaited<ReturnType<typeof runCli>>,
): string {
  const result = JSON.parse(reviewed.stdout) as { data?: { review_id?: string } };
  const id = result.data?.review_id;
  if (id === undefined) throw new Error(`${reviewKind} review id missing`);
  if (reviewKind === 'plan-execution' && reviewed.exitCode === 2) {
    expect(reviewed.stdout).toContain('REVIEW_ROUTES_EXHAUSTED');
    admitPlanExecutionFixture(root, id, target, executionPlanRecord);
  } else {
    expect(reviewed.exitCode, reviewed.stdout).toBe(0);
  }
  return id;
}

export async function admitThroughInstalledCli(
  root: string,
  admitted: readonly PlanningReviewKind[] = [
    'scenario-gate',
    'plan-implementation',
    'plan-execution',
  ],
  designApprovalGate = false,
  slicingDecision: 'one_pull_request' | 'multiple_pull_requests' = 'one_pull_request',
): Promise<void> {
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
  const plan = readFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), 'utf8');
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) throw new Error(parsed.message);
  const slices =
    slicingDecision === 'one_pull_request'
      ? [
          {
            name: 'Contribution',
            purpose: 'Deliver the contribution.',
            boundary: 'Public prerequisite.',
            prerequisites: [] as string[],
            proof: 'Integration test.',
            completion_signal: 'The prerequisite is observable.',
            relies_on_unmerged_successor: false,
          },
        ]
      : [
          {
            name: 'Foundation',
            purpose: 'Deliver the prerequisite.',
            boundary: 'Shared contract.',
            prerequisites: [] as string[],
            proof: 'Contract test.',
            completion_signal: 'The contract is independently usable.',
            relies_on_unmerged_successor: false,
          },
          {
            name: 'Contribution',
            purpose: 'Deliver the contribution.',
            boundary: 'Public prerequisite.',
            prerequisites: ['Foundation'],
            proof: 'Integration test.',
            completion_signal: 'The prerequisite is observable.',
            relies_on_unmerged_successor: false,
          },
        ];
  const record = {
    slicing_decision: slicingDecision,
    rationale:
      slicingDecision === 'one_pull_request'
        ? 'One coherent contribution.'
        : 'Two independently provable dependency-ordered changes.',
    slices,
    obligation_owners: [{ obligation: 'Contribution', slices: slices.map(slice => slice.name) }],
    decision_statuses: [{ decision: 'Use the accepted plans', status: 'unchanged' }],
    accepted_scenarios_covered: true,
    accepted_approach_preserved: true,
    normalized_plan_digest: normalizedExecutionPlanDigest(plan),
    delivery_definition: createExecutionPlanDeliveryDefinition(parsed, designApprovalGate),
  };
  const bin = installReviewer();
  const implementationTarget = nodePath.relative(
    root,
    nodePath.join(ticketDirectory, 'impl-plan.md'),
  );
  const executionTarget = nodePath.relative(
    root,
    nodePath.join(ticketDirectory, 'execution-plan.md'),
  );
  const specContext = nodePath.relative(root, nodePath.join(ticketDirectory, 'spec.md'));
  const requests = [
    ['scenario-gate', 'features/feature.feature', [specContext], undefined],
    [
      'plan-implementation',
      implementationTarget,
      ['features/feature.feature', specContext],
      undefined,
    ],
    [
      'plan-execution',
      executionTarget,
      [implementationTarget, 'features/feature.feature'],
      JSON.stringify(record),
    ],
  ] as const;
  const stamps: string[] = [];
  const reviewKeyRoot = nodePath.join(root, '.review-keys');
  for (const [reviewKind, target, context, executionRecord] of requests) {
    if (!admitted.includes(reviewKind)) continue;
    const reviewed = await runCli(
      [
        'review',
        'run',
        reviewKind,
        target,
        ...context.flatMap(contextPath => ['--context', contextPath]),
        '--json',
        '--no-input',
        '--cwd',
        root,
      ],
      {
        cwd: root,
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          NODE_ENV: 'test',
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_NO_UPDATE_CHECK: '1',
          SAFEWORD_REVIEW_KEY_ROOT: reviewKeyRoot,
          ...(executionRecord !== undefined && {
            SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: executionRecord,
          }),
        },
      },
    );
    const id = admittedReviewId(root, reviewKind, target, record, reviewed);
    // This Codex host supplies no verified author model. Preserve the real
    // coordinator's reduced assurance while testing the downstream gates.
    stamps.push(
      `2026-09-13T00:00:00.000Z fixture review:ABC123-feature:phase@${reviewKind} author:codex reviewer:claude independence:reduced review-id:${id}`,
    );
  }
  writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), `${stamps.join('\n')}\n`);
}
