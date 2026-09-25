import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import process from 'node:process';

import { afterAll, describe, expect, it } from 'vitest';

import type {
  ExecutionPlanChecklistDefinitionItem,
  ExecutionPlanDeliveryDefinition,
  ExecutionPlanProofSpecification,
  ReviewAgent,
  ReviewerOutput,
  ReviewPacket,
} from '../../src/review/contract.js';
import {
  EXECUTION_PLAN_CONFORMANCE_CASES,
  type ExecutionPlanConformanceCase,
  type ExecutionPlanConformanceResult,
} from '../../src/review/execution-plan-conformance.js';
import { reviewTimeoutMilliseconds, runHeadlessReviewer } from '../../src/review/runtime.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const CAN_RUN = process.env.SAFEWORD_RUN_EXECUTION_PLAN_LIVE === '1';
const REVIEW_TIMEOUT_MS = reviewTimeoutMilliseconds({});
const reviewer = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER as ReviewAgent | undefined;
const model = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_MODEL?.trim() || undefined;
const resultsPath = process.env.SAFEWORD_EXECUTION_PLAN_RESULTS_PATH;
const results: ExecutionPlanConformanceResult[] = [];
const JSON_NULL = JSON.parse('null') as null;

it.each(EXECUTION_PLAN_CONFORMANCE_CASES)(
  'builds the $id live packet from its fixture',
  testCase => {
    const packet = packetFor(testCase, 'claude');
    expect(
      packet.execution_plan_delivery_definition?.checklist_items.length,
    ).toBeGreaterThanOrEqual(11);
    expect(packet.execution_plan_delivery_definition?.proof_specifications.length).toBeGreaterThan(
      0,
    );
    expect(packet.execution_plan_normalized_digest).toMatch(/^[a-f0-9]{64}$/u);
  },
);

function tableRows(section: string, columns: number): string[][] {
  return section
    .split('\n')
    .filter(line => line.startsWith('|'))
    .slice(2)
    .map(line =>
      line
        .slice(1, -1)
        .split('|')
        .map(cell => cell.trim()),
    )
    .filter(row => row.length === columns);
}

/** The corpus owns these fixed table fixtures; PR4 owns the production parser. */
function fixtureDefinition(plan: string): ExecutionPlanDeliveryDefinition {
  const proofSection = plan
    .split('## Proof specifications\n', 2)[1]
    ?.split('## Delivery checklist\n', 1)[0];
  const checklistSection = plan.split('## Delivery checklist\n', 2)[1];
  if (proofSection === undefined || checklistSection === undefined) {
    throw new Error('Conformance fixture has no delivery contract');
  }
  const proof_specifications = tableRows(proofSection, 7).map(row => ({
    proof_id: row[0] ?? '',
    method: row[1] as ExecutionPlanProofSpecification['method'],
    scope: row[2] as ExecutionPlanProofSpecification['scope'],
    boundary_exercised: row[3] ?? '',
    qualifies_as: row[4] as ExecutionPlanProofSpecification['qualifies_as'],
    currency: row[5] as ExecutionPlanProofSpecification['currency'],
    invocation: JSON.parse(row[6] ?? '') as ExecutionPlanProofSpecification['invocation'],
  }));
  const checklist_items = tableRows(checklistSection, 9).map(row => {
    const disposition = row[5];
    const reviewed_disposition: ExecutionPlanChecklistDefinitionItem['reviewed_disposition'] =
      disposition === 'not_applicable' || disposition === 'pending_human' ? disposition : JSON_NULL;
    return {
      id: row[0] ?? '',
      category: row[1] ?? '',
      obligation: row[2] ?? '',
      owner: row[3] as 'contributor' | 'human',
      required_proof: row[4] ?? '',
      reviewed_disposition,
      reviewed_detail: reviewed_disposition === JSON_NULL ? JSON_NULL : (row[8] ?? ''),
    };
  });
  if (proof_specifications.length === 0 || checklist_items.length === 0) {
    throw new Error('Conformance fixture delivery tables are empty');
  }
  return { schema_version: 1, design_approval_gate: false, proof_specifications, checklist_items };
}

function packetFor(testCase: ExecutionPlanConformanceCase, assigned: ReviewAgent): ReviewPacket {
  const identity =
    model === undefined ? `${assigned} runtime default` : `${assigned} model ${model}`;
  return {
    schema_version: 1,
    dispatch_id: randomUUID(),
    kind: 'plan-execution',
    logical_files: [{ path: 'execution-plan.md', content: testCase.execution_plan }],
    context_files: [
      { path: 'impl-plan.md', content: testCase.implementation_plan },
      { path: 'scenario.feature', content: testCase.scenario },
      { path: 'reviewer-identity.md', content: `Assigned reviewer: ${identity}.` },
    ],
    execution_plan_delivery_definition: fixtureDefinition(testCase.execution_plan),
    execution_plan_normalized_digest: createHash('sha256')
      .update(testCase.execution_plan)
      .digest('hex'),
  };
}

afterAll(() => {
  if (CAN_RUN && resultsPath !== undefined) {
    writeFileSync(resultsPath, `${JSON.stringify(results, undefined, 2)}\n`, { mode: 0o600 });
  }
});

describe.skipIf(!CAN_RUN)('live Execution Plan semantic conformance', () => {
  it('requires an explicit reviewer and results destination', () => {
    expect(['claude', 'codex']).toContain(reviewer);
    expect(resultsPath).toBeTypeOf('string');
    expect(resultsPath).not.toBe('');
  });

  it.each(EXECUTION_PLAN_CONFORMANCE_CASES)(
    '$id',
    async testCase => {
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
        expect(output.reviewer_agent).toBe(reviewer);
        expect(output.dispatch_id).toBe(packet.dispatch_id);
        expect(output.planning_destination).toBe(testCase.expectation.planning_destination);
        expect(output.verdict).toBe(testCase.expectation.verdict);
        if (output.verdict === 'approve') {
          expect(output.execution_plan_record?.slicing_decision).toBe(
            testCase.expectation.slicing_decision,
          );
          expect(output.execution_plan_record?.slices.map(slice => slice.name)).toEqual(
            testCase.expectation.slice_names,
          );
        } else {
          expect(output.execution_plan_record).toBeNull();
          const explanation =
            `${output.summary}\n${output.findings.map(finding => finding.message).join('\n')}`.toLowerCase();
          const findingTerms = testCase.expectation.finding_terms ?? [];
          for (const term of findingTerms) {
            expect(explanation).toContain(term.toLowerCase());
          }
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
    REVIEW_TIMEOUT_MS + 60_000,
  );
});
