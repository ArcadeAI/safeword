import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import process from 'node:process';

import { afterAll, describe, expect, it } from 'vitest';

import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import type { ReviewAgent, ReviewerOutput, ReviewPacket } from '../../src/review/contract.js';
import {
  EXECUTION_PLAN_CONFORMANCE_CASES,
  type ExecutionPlanConformanceCase,
  type ExecutionPlanConformanceResult,
} from '../../src/review/execution-plan-conformance.js';
import { reviewTimeoutMilliseconds, runHeadlessReviewer } from '../../src/review/runtime.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const CAN_RUN = process.env.SAFEWORD_RUN_EXECUTION_PLAN_LIVE === '1';
const REVIEW_TIMEOUT_MS = reviewTimeoutMilliseconds({});
const LIVE_TEST_TIMEOUT_MS = REVIEW_TIMEOUT_MS + 60_000;
const reviewer = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER as ReviewAgent | undefined;
const model = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_MODEL?.trim() || undefined;
const resultsPath = process.env.SAFEWORD_EXECUTION_PLAN_RESULTS_PATH;
const results: ExecutionPlanConformanceResult[] = [];

function packetFor(testCase: ExecutionPlanConformanceCase, assigned: ReviewAgent): ReviewPacket {
  const identity =
    model === undefined ? `${assigned} runtime default` : `${assigned} model ${model}`;
  const parsed = parseDeliveryPlanContract(testCase.execution_plan);
  if (!parsed.ok) throw new Error(`Invalid conformance fixture: ${parsed.message}`);
  const definition = createExecutionPlanDeliveryDefinition(parsed, false);
  return {
    schema_version: 1,
    dispatch_id: randomUUID(),
    kind: 'plan-execution',
    logical_files: [{ path: 'execution-plan.md', content: testCase.execution_plan }],
    context_files: [
      { path: 'impl-plan.md', content: testCase.implementation_plan },
      { path: 'scenario.feature', content: testCase.scenario },
      {
        path: 'reviewer-identity.md',
        content: `Assigned reviewer: ${identity}.`,
      },
    ],
    execution_plan_delivery_definition: definition,
    execution_plan_normalized_digest: normalizedExecutionPlanDigest(testCase.execution_plan),
  };
}

function recordOf(output: ReviewerOutput): NonNullable<ReviewerOutput['execution_plan_record']> {
  const record = output.execution_plan_record;
  if (record === undefined || record === null) throw new Error('Approval omitted its typed record');
  return record;
}

function assertApproval(testCase: ExecutionPlanConformanceCase, output: ReviewerOutput): void {
  expect(output.verdict).toBe('approve');
  const record = recordOf(output);
  expect(record.slicing_decision).toBe(testCase.expectation.slicing_decision);
  expect(record.accepted_scenarios_covered).toBe(true);
  expect(record.accepted_approach_preserved).toBe(true);
  expect(record.slices.map(slice => slice.name)).toEqual(testCase.expectation.slice_names);
  const expectedObligations = testCase.expectation.obligations ?? [];
  for (const obligation of expectedObligations) {
    expect(record.obligation_owners.map(owner => owner.obligation)).toContain(obligation);
  }
  const expectedDecisions = testCase.expectation.decisions ?? [];
  for (const decision of expectedDecisions) {
    expect(record.decision_statuses).toContainEqual({ decision, status: 'unchanged' });
  }
}

function assertDenial(testCase: ExecutionPlanConformanceCase, output: ReviewerOutput): void {
  expect(output.verdict).toBe('request_changes');
  expect(output.execution_plan_record).toBeNull();
  const explanation =
    `${output.summary}\n${output.findings.map(finding => finding.message).join('\n')}`.toLowerCase();
  const expectedTerms = testCase.expectation.finding_terms ?? [];
  for (const term of expectedTerms) {
    expect(explanation).toContain(term.toLowerCase());
  }
}

function assertCase(
  testCase: ExecutionPlanConformanceCase,
  output: ReviewerOutput,
  assigned: ReviewAgent,
  dispatchId: string,
): void {
  expect(output.reviewer_agent).toBe(assigned);
  expect(output.dispatch_id).toBe(dispatchId);
  expect(output.planning_destination).toBe(testCase.expectation.planning_destination);
  if (testCase.expectation.verdict === 'approve') assertApproval(testCase, output);
  else assertDenial(testCase, output);
}

afterAll(() => {
  if (CAN_RUN && resultsPath !== undefined) {
    writeFileSync(resultsPath, `${JSON.stringify(results, undefined, 2)}\n`, { mode: 0o600 });
  }
});

describe.skipIf(!CAN_RUN)('live Execution Plan semantic conformance', () => {
  it('requires one explicit reviewer identity and evidence destination', () => {
    expect(['claude', 'codex']).toContain(reviewer);
    expect(resultsPath).toBeTypeOf('string');
    expect(resultsPath).not.toBe('');
  });

  it.each(EXECUTION_PLAN_CONFORMANCE_CASES)(
    '$id',
    async testCase => {
      expect.hasAssertions();
      if (reviewer !== 'claude' && reviewer !== 'codex') {
        throw new Error('SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER must be claude or codex');
      }
      const directory = createTemporaryDirectory();
      const packet = packetFor(testCase, reviewer);
      let passed = false;
      try {
        const output = (await runHeadlessReviewer(reviewer, packet, directory, process.cwd(), {
          ...(model !== undefined && { model }),
          runDeadline: Date.now() + REVIEW_TIMEOUT_MS,
        })) as ReviewerOutput;
        try {
          assertCase(testCase, output, reviewer, packet.dispatch_id);
        } catch (error) {
          process.stderr.write(
            `Execution Plan reviewer output:\n${JSON.stringify(output, undefined, 2)}\n`,
          );
          throw error;
        }
        passed = true;
      } finally {
        results.push({
          case_id: testCase.id,
          reviewer,
          ...(model !== undefined && { model }),
          passed,
        });
        removeTemporaryDirectory(directory);
      }
    },
    LIVE_TEST_TIMEOUT_MS,
  );
});
