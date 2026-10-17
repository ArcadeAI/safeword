import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { afterAll, describe, expect, it, vi } from 'vitest';

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
import {
  EXECUTION_PLAN_SLICING_CASES,
  type SlicingAcceptanceCase,
} from '../fixtures/execution-plan-slicing-cases.js';
import { liveReviewerEnvironment } from '../fixtures/live-reviewer-profile.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCliWithLiteralArguments,
} from '../helpers.js';

const ACCEPTANCE_CASES = process.env.SAFEWORD_EXECUTION_PLAN_ACCEPTANCE === '1';
const cases = ACCEPTANCE_CASES ? EXECUTION_PLAN_SLICING_CASES : EXECUTION_PLAN_CONFORMANCE_CASES;

const PUBLIC_CLI = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_CLI === '1';
const CAN_RUN = process.env.SAFEWORD_RUN_EXECUTION_PLAN_LIVE === '1';
if (CAN_RUN && ACCEPTANCE_CASES && !PUBLIC_CLI) {
  throw new Error('Semantic acceptance requires SAFEWORD_EXECUTION_PLAN_LIVE_CLI=1');
}
const REVIEW_TIMEOUT_MS = reviewTimeoutMilliseconds({});
const LIVE_TEST_TIMEOUT_MS = REVIEW_TIMEOUT_MS + 60_000;
const reviewer = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER as ReviewAgent | undefined;
const model = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_MODEL?.trim() || undefined;
const resultsPath = process.env.SAFEWORD_EXECUTION_PLAN_RESULTS_PATH;
const results: ExecutionPlanConformanceResult[] = [];
const outputs: {
  case_id: string;
  dispatch_mode: 'cli' | 'headless';
  output: ReviewerOutput;
}[] = [];

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

async function reviewThroughCli(
  testCase: ExecutionPlanConformanceCase,
  root: string,
  assigned: ReviewAgent,
): Promise<ReviewerOutput> {
  const relative = '.project/tickets/CASE01-conformance';
  const ticket = nodePath.join(root, relative);
  mkdirSync(ticket, { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  const author = assigned === 'claude' ? 'codex' : 'claude';
  writeFileSync(
    nodePath.join(root, '.safeword/config.json'),
    JSON.stringify({
      crossAgentReviewRoutes: { [author]: [{ reviewer: assigned, ...(model && { model }) }] },
    }),
  );
  writeFileSync(nodePath.join(ticket, 'execution-plan.md'), testCase.execution_plan);
  writeFileSync(
    nodePath.join(ticket, 'impl-plan.md'),
    `**Status:** planned\n\n${testCase.implementation_plan}`,
  );
  writeFileSync(nodePath.join(ticket, 'scenario.feature'), testCase.scenario);
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    '---\nid: CASE01\nslug: conformance\ntype: feature\nphase: plan-execution\nscope:\n  - Deliver the accepted obligations in the Implementation Plan.\nout_of_scope:\n  - Change the accepted approach.\ndone_when:\n  - Every accepted obligation has startable reviewed work.\n---\n',
  );
  const options = {
    cwd: root,
    timeout: LIVE_TEST_TIMEOUT_MS,
    env: liveReviewerEnvironment(assigned, author),
  };
  let invoked = await runCliWithLiteralArguments(
    [
      'review',
      'run',
      'plan-execution',
      `${relative}/execution-plan.md`,
      '--context',
      `${relative}/impl-plan.md`,
      '--context',
      `${relative}/scenario.feature`,
      '--context',
      `${relative}/ticket.md`,
      '--cwd',
      root,
      '--json',
      '--no-input',
    ],
    options,
  );
  let envelope = JSON.parse(invoked.stdout);
  if (envelope.findings?.some((finding: { code: string }) => finding.code === 'REVIEW_PENDING')) {
    await vi.waitFor(
      async () => {
        invoked = await runCliWithLiteralArguments(
          ['review', 'status', envelope.data.review_id, '--cwd', root, '--json'],
          options,
        );
        envelope = JSON.parse(invoked.stdout);
        expect(
          Boolean(
            envelope.findings?.some(
              (finding: { code: string }) => finding.code === 'REVIEW_PENDING',
            ),
          ),
        ).toBe(false);
      },
      { timeout: REVIEW_TIMEOUT_MS, interval: 1000 },
    );
  }
  expect(envelope.data?.actual_reviewer, invoked.stdout).toBe(assigned);
  expect(envelope.data?.independence, invoked.stdout).toBe('cross-agent');
  const output = envelope.data?.reviewer_output as ReviewerOutput | undefined;
  if (!output) throw new Error(`Public CLI did not return a reviewer output: ${invoked.stdout}`);
  expect(invoked.exitCode, invoked.stdout).toBe(testCase.expectation.verdict === 'approve' ? 0 : 2);
  expect(readFileSync(nodePath.join(ticket, 'execution-plan.md'), 'utf8')).toBe(
    testCase.execution_plan,
  );
  await assertCliDiscovery(testCase, root, ticket, output, options);
  return output;
}

async function assertCliDiscovery(
  testCase: ExecutionPlanConformanceCase,
  root: string,
  ticket: string,
  output: ReviewerOutput,
  options: Parameters<typeof runCliWithLiteralArguments>[1],
): Promise<void> {
  if (!testCase.id.includes('discovery')) return;
  if (output.verdict === 'request_changes') {
    const applied = await runCliWithLiteralArguments(
      ['ticket', 'approve-plan', 'CASE01', '--cwd', root, '--json', '--no-input'],
      options,
    );
    const disposition = JSON.parse(applied.stdout);
    expect(disposition.data?.planning_destination, applied.stdout).toBe(
      testCase.expectation.planning_destination,
    );
  }
  expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toContain(
    `phase: ${testCase.expectation.planning_destination}`,
  );
}

function recordOf(output: ReviewerOutput): NonNullable<ReviewerOutput['execution_plan_record']> {
  const record = output.execution_plan_record;
  if (record === undefined || record === null) throw new Error('Approval omitted its typed record');
  return record;
}

function assertSlicingRationale(id: string, rationale: string): void {
  expect(rationale.trim()).not.toBe('');
  const patterns: Record<string, readonly RegExp[]> = {
    'one-coherent-change': [
      /coher|cohes|insepar|coupl|atomic|single boundary|same (?:boundary|contract|outcome)/iu,
      /review|judg|contract|command|result/iu,
      /split|separat|independen|insepar|indivis/iu,
      /no |not |none |without|cannot|can't|insepar|indivis|artificial|would/iu,
    ],
    'several-ordered-changes': [
      /contract|schema/iu,
      /activat|rout/iu,
      /independent|separat|depend|order|before/iu,
    ],
  };
  const expectedPatterns = patterns[id] ?? [];
  for (const pattern of expectedPatterns) expect(rationale).toMatch(pattern);
}

function assertObligationOwners(
  testCase: ExecutionPlanConformanceCase,
  record: ReturnType<typeof recordOf>,
): void {
  const expectedObligations = testCase.expectation.obligations ?? [];
  for (const obligation of expectedObligations) {
    const prefix = `- ${obligation}: `;
    const ownerLine = testCase.execution_plan.split('\n').find(line => line.startsWith(prefix));
    if (ownerLine === undefined) throw new Error(`Missing expected owner: ${obligation}`);
    expect(record.obligation_owners).toContainEqual({
      obligation,
      slices: [ownerLine.slice(prefix.length)],
    });
  }
}

function assertAcceptanceRecord(
  testCase: ExecutionPlanConformanceCase,
  record: ReturnType<typeof recordOf>,
): void {
  assertSlicingRationale(testCase.id, record.rationale);
  for (const slice of record.slices) {
    expect(slice.relies_on_unmerged_successor).toBe(false);
    const fields = [slice.purpose, slice.boundary, slice.proof, slice.completion_signal];
    for (const field of fields) expect(field.trim()).not.toBe('');
  }
  if (testCase.id === 'ordered-schema-before-reader') {
    expect(
      record.slices.map(slice => ({ name: slice.name, prerequisites: slice.prerequisites })),
    ).toEqual([
      { name: 'Schema', prerequisites: [] },
      { name: 'Reader', prerequisites: ['Schema'] },
    ]);
  }
  const proofOwners: Record<string, readonly [string, string][]> = {
    'many-mechanical-edits': [['Contract mirrors', 'data-compatibility']],
    'few-files-two-outcomes': [
      ['Inert schema', 'data-compatibility'],
      ['Public activation', 'behavior-boundary'],
    ],
  };
  const expectedProofOwners = proofOwners[testCase.id] ?? [];
  for (const [name, proof] of expectedProofOwners) {
    expect(record.slices.find(slice => slice.name === name)?.proof).toContain(proof);
  }
  assertObligationOwners(testCase, record);
}

function assertApproval(testCase: ExecutionPlanConformanceCase, output: ReviewerOutput): void {
  expect(output.verdict).toBe('approve');
  const record = recordOf(output);
  expect(record.slicing_decision).toBe(testCase.expectation.slicing_decision);
  expect(record.accepted_scenarios_covered).toBe(true);
  expect(record.accepted_approach_preserved).toBe(true);
  expect(record.slices.map(slice => slice.name)).toEqual(testCase.expectation.slice_names);
  if (ACCEPTANCE_CASES) {
    assertAcceptanceRecord(testCase, record);
  } else {
    // Keep production route qualification independent of the stricter acceptance oracle.
    const obligations = testCase.expectation.obligations ?? [];
    for (const obligation of obligations) {
      expect(record.obligation_owners.map(owner => owner.obligation)).toContain(obligation);
    }
  }
  const expectedDecisions = testCase.expectation.decisions ?? [];
  for (const decision of expectedDecisions) {
    expect(record.decision_statuses).toContainEqual({ decision, status: 'unchanged' });
  }
}

function assertDenial(testCase: SlicingAcceptanceCase, output: ReviewerOutput): void {
  expect(output.verdict).toBe('request_changes');
  expect(output.execution_plan_record).toBeNull();
  const explanation =
    `${output.summary}\n${output.findings.map(finding => finding.message).join('\n')}`.toLowerCase();
  const expectedTerms = testCase.expectation.finding_terms ?? [];
  for (const term of expectedTerms) {
    expect(explanation).toContain(term.toLowerCase());
  }
  if (testCase.expectation.finding_subject !== undefined) {
    const subject = testCase.expectation.finding_subject.toLowerCase();
    const purposePatterns =
      testCase.id === 'two-independent-purposes'
        ? [/contract|schema/iu, /activat|public.*(?:command|rout)/iu, /separat|split|independen/iu]
        : [];
    expect(
      output.findings.some(finding => {
        const message = finding.message.toLowerCase();
        return (
          message.includes(subject) &&
          expectedTerms.every(term => message.includes(term.toLowerCase())) &&
          purposePatterns.every(pattern => pattern.test(message))
        );
      }),
      `One finding must name the affected slice and its missing field: ${subject}`,
    ).toBe(true);
  }
}

function assertCase(
  testCase: ExecutionPlanConformanceCase,
  output: ReviewerOutput,
  assigned: ReviewAgent,
  dispatchId: string | undefined,
): void {
  expect(output.reviewer_agent).toBe(assigned);
  // The public CLI owns dispatch binding; direct runtime probes own their packet.
  if (dispatchId !== undefined) expect(output.dispatch_id).toBe(dispatchId);
  expect(output.planning_destination).toBe(testCase.expectation.planning_destination);
  if (testCase.expectation.verdict === 'approve') assertApproval(testCase, output);
  else assertDenial(testCase, output);
}

function useLiveReviewerProfile(assigned: ReviewAgent): void {
  if (PUBLIC_CLI) return;
  const author = assigned === 'claude' ? 'codex' : 'claude';
  const environment = Object.entries(liveReviewerEnvironment(assigned, author));
  for (const [key, value] of environment) vi.stubEnv(key, value);
}

afterAll(() => {
  if (!CAN_RUN || resultsPath === undefined) {
    return;
  }

  writeFileSync(resultsPath, `${JSON.stringify(results, undefined, 2)}\n`, { mode: 0o600 });
  writeFileSync(`${resultsPath}.outputs.json`, `${JSON.stringify(outputs, undefined, 2)}\n`, {
    mode: 0o600,
  });
});

describe.skipIf(!CAN_RUN)('live Execution Plan semantic conformance', () => {
  it('requires one explicit reviewer identity and evidence destination', () => {
    expect(['claude', 'codex']).toContain(reviewer);
    expect(resultsPath).toBeTypeOf('string');
    expect(resultsPath).not.toBe('');
  });

  it.each(cases)(
    '$id',
    async testCase => {
      expect.hasAssertions();
      if (reviewer !== 'claude' && reviewer !== 'codex') {
        throw new Error('SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER must be claude or codex');
      }
      const directory = createTemporaryDirectory();
      let passed = false;
      useLiveReviewerProfile(reviewer);
      try {
        let output: ReviewerOutput;
        let expectedDispatchId: string | undefined;
        if (PUBLIC_CLI) {
          output = await reviewThroughCli(testCase, directory, reviewer);
        } else {
          const packet = packetFor(testCase, reviewer);
          expectedDispatchId = packet.dispatch_id;
          output = (await runHeadlessReviewer(reviewer, packet, directory, process.cwd(), {
            ...(model !== undefined && { model }),
            runDeadline: Date.now() + REVIEW_TIMEOUT_MS,
          })) as ReviewerOutput;
        }
        outputs.push({
          case_id: testCase.id,
          dispatch_mode: PUBLIC_CLI ? 'cli' : 'headless',
          output,
        });
        try {
          assertCase(testCase, output, reviewer, expectedDispatchId);
        } catch (error) {
          process.stderr.write(
            `Execution Plan reviewer output:\n${JSON.stringify(output, undefined, 2)}\n`,
          );
          throw error;
        }
        passed = true;
      } finally {
        results.push({
          case_id: ACCEPTANCE_CASES ? `acceptance:${testCase.id}` : testCase.id,
          reviewer,
          ...(model !== undefined && { model }),
          passed,
        });
        vi.unstubAllEnvs();
        removeTemporaryDirectory(directory);
      }
    },
    LIVE_TEST_TIMEOUT_MS,
  );
});
