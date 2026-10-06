import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import process from 'node:process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

it('keeps ordinary checklist progress out of live review identity', () => {
  const plan = EXECUTION_PLAN_CONFORMANCE_CASES[0]?.execution_plan;
  if (plan === undefined) throw new Error('Missing conformance fixture');
  const progressed = plan.replace(
    '| open | missing | | |',
    '| complete | current_revision_real_boundary | rev-1 | passing receipt |',
  );
  expect(progressed).not.toBe(plan);
  expect(normalizedFixtureDigest(progressed)).toBe(normalizedFixtureDigest(plan));
});

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

function normalizedFixtureDigest(plan: string): string {
  const normalized = plan
    .split('\n')
    .map(line => {
      const columns = line.slice(1, -1).split('|');
      if (
        !line.startsWith('| item-') ||
        columns.length !== 9 ||
        (columns[5]?.trim() !== 'open' && columns[5]?.trim() !== 'complete')
      ) {
        return line;
      }
      const stable = columns.slice(0, 5).join('|');
      return `|${stable}| <progress> | <progress> | <progress> | <progress> |`;
    })
    .join('\n');
  return createHash('sha256').update(normalized).digest('hex');
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
    execution_plan_normalized_digest: normalizedFixtureDigest(testCase.execution_plan),
  };
}

function assertApproval(testCase: ExecutionPlanConformanceCase, output: ReviewerOutput): void {
  const record = output.execution_plan_record;
  expect(record).toBeDefined();
  expect(record).not.toBeNull();
  expect(record?.slicing_decision).toBe(testCase.expectation.slicing_decision);
  expect(record?.accepted_scenarios_covered).toBe(true);
  expect(record?.accepted_approach_preserved).toBe(true);
  expect(record?.slices.map(slice => slice.name)).toEqual(testCase.expectation.slice_names);
  assertAcceptedCoverage(testCase, output);
}

function assertAcceptedCoverage(
  testCase: ExecutionPlanConformanceCase,
  output: ReviewerOutput,
): void {
  const record = output.execution_plan_record;
  const obligations = testCase.expectation.obligations ?? [];
  for (const obligation of obligations) {
    expect(record?.obligation_owners.map(owner => owner.obligation)).toContain(obligation);
  }
  const decisions = testCase.expectation.decisions ?? [];
  for (const decision of decisions) {
    expect(record?.decision_statuses).toContainEqual({ decision, status: 'unchanged' });
  }
}

function assertDenial(testCase: ExecutionPlanConformanceCase, output: ReviewerOutput): void {
  expect(output.execution_plan_record).toBeNull();
  const explanation =
    `${output.summary}\n${output.findings.map(finding => finding.message).join('\n')}`.toLowerCase();
  const findingTerms = testCase.expectation.finding_terms ?? [];
  for (const term of findingTerms) {
    expect(explanation).toContain(term.toLowerCase());
  }
}

afterAll(() => {
  if (CAN_RUN && resultsPath !== undefined) {
    writeFileSync(resultsPath, `${JSON.stringify(results, undefined, 2)}\n`, { mode: 0o600 });
  }
});

describe.skipIf(!CAN_RUN)('live Execution Plan semantic conformance', () => {
  const testClaudeConfigDirectory = process.env.CLAUDE_CONFIG_DIR;

  beforeAll(() => {
    // The base Vitest profile deliberately has no login. An opt-in live review
    // must use the operator's authenticated Claude profile, not that fixture.
    if (reviewer === 'claude') delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterAll(() => {
    if (testClaudeConfigDirectory !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = testClaudeConfigDirectory;
    }
  });

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
        if (output.verdict === 'approve') assertApproval(testCase, output);
        else assertDenial(testCase, output);
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
