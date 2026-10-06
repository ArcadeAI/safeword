import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

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
import {
  reviewTimeoutMilliseconds,
  runHeadlessReviewerWithProvenance,
} from '../../src/review/runtime.js';
import {
  assertTestCliFresh,
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
} from '../helpers.js';

const CAN_RUN = process.env.SAFEWORD_RUN_EXECUTION_PLAN_LIVE === '1';
const REVIEW_TIMEOUT_MS = reviewTimeoutMilliseconds();
const LIVE_TEST_TIMEOUT_MS = REVIEW_TIMEOUT_MS + 60_000;
const reviewer = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER as ReviewAgent | undefined;
const model = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_MODEL?.trim() || undefined;
const resultsPath = process.env.SAFEWORD_EXECUTION_PLAN_RESULTS_PATH;
const results: ExecutionPlanConformanceResult[] = [];

async function liveReviewer(
  assigned: ReviewAgent,
  directory: string,
  packet: ReviewPacket,
): Promise<ReviewerOutput> {
  const profileKey = assigned === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR';
  const profile =
    assigned === 'codex'
      ? process.env.SAFEWORD_EXECUTION_PLAN_LIVE_CODEX_HOME
      : process.env.SAFEWORD_EXECUTION_PLAN_LIVE_CLAUDE_CONFIG_DIR;
  if (!profile)
    throw new Error(`${assigned} live proof requires its explicitly authenticated profile`);
  const previousProfile = process.env[profileKey];
  if (assigned === 'claude' && profile === 'default')
    Reflect.deleteProperty(process.env, profileKey);
  else process.env[profileKey] = profile;
  try {
    const execution = await runHeadlessReviewerWithProvenance(
      assigned,
      packet,
      directory,
      process.cwd(),
      {
        ...(model !== undefined && { model }),
        runDeadline: Date.now() + REVIEW_TIMEOUT_MS,
      },
    );
    if (model !== undefined) {
      expect(execution.confirmedModel).toEqual({
        provider: assigned === 'codex' ? 'openai' : 'anthropic',
        model,
      });
    }
    return execution.output as ReviewerOutput;
  } finally {
    if (previousProfile === undefined) Reflect.deleteProperty(process.env, profileKey);
    else process.env[profileKey] = previousProfile;
  }
}

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
      { path: 'scenario.feature', content: testCase.accepted_scenario },
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
    expect(
      record.obligation_owners.some(
        owner =>
          owner.obligation === obligation ||
          owner.obligation.startsWith(`${obligation}, `) ||
          owner.obligation.startsWith(`${obligation}: `),
      ),
    ).toBe(true);
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
  assertSemanticOutcome(testCase, output);
}

function assertSemanticOutcome(
  testCase: ExecutionPlanConformanceCase,
  output: ReviewerOutput,
): void {
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
        const output = await liveReviewer(reviewer, directory, packet);
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

// Exercise the public coordinator as well as the external semantic judgment.
// This is deliberately opt-in: default acceptance must not masquerade as a live eval.
const CLI_LIVE = process.env.SAFEWORD_RUN_EXECUTION_PLAN_CLI_LIVE === '1';
const CLI_CASES = process.env.SAFEWORD_EXECUTION_PLAN_CLI_LIVE_CASES?.split(',') ?? [];
const selectedCases = EXECUTION_PLAN_CONFORMANCE_CASES.filter(testCase =>
  CLI_CASES.includes(testCase.id),
);
if (
  CLI_LIVE &&
  (CLI_CASES.length === 0 ||
    new Set(CLI_CASES).size !== CLI_CASES.length ||
    selectedCases.length !== CLI_CASES.length)
) {
  throw new Error('CLI live proof requires unique named conformance cases');
}

const CLI_REVIEW_BOUND_MS = 240_000;

describe.skipIf(!CLI_LIVE)('installed CLI semantic conformance', () => {
  it.each(selectedCases)(
    '$id',
    // eslint-disable-next-line complexity -- One bounded public CLI journey owns dispatch, pending status, judgment, and cancellation.
    async testCase => {
      assertTestCliFresh();
      expect(reviewer).toBe('claude');
      expect(model).toBeTruthy();
      if (reviewer !== 'claude' || model === undefined) {
        throw new Error('CLI live proof requires an explicit Claude reviewer and model');
      }
      const liveProfile = process.env.SAFEWORD_EXECUTION_PLAN_LIVE_CLAUDE_CONFIG_DIR;
      if (!liveProfile)
        throw new Error('CLI live proof requires its explicitly authenticated Claude profile');
      const directory = createTemporaryDirectory();
      const env = {
        // Only this opt-in review subprocess uses the supplied profile; lifecycle fixtures stay sandboxed.
        CLAUDE_CONFIG_DIR: liveProfile,
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_REVIEW_FOREGROUND_MS: '100',
        SAFEWORD_NO_UPDATE_CHECK: '1',
        SAFEWORD_REVIEW_RUN_BOUND_MS: String(CLI_REVIEW_BOUND_MS),
        SAFEWORD_REVIEW_TIMEOUT_MS: String(CLI_REVIEW_BOUND_MS - 60_000),
      };
      let pendingId: string | undefined;
      const invoke = (args: string[]) =>
        runCli(['--json', '--no-input', 'review', ...args, '--cwd', directory], {
          cwd: directory,
          env,
          timeout: 30_000,
          // Empty selects cwd in Claude; remove the override for its default profile.
          unsetEnv: liveProfile === 'default' ? ['CLAUDE_CONFIG_DIR'] : [],
        });
      try {
        mkdirSync(nodePath.join(directory, '.safeword'));
        writeFileSync(
          nodePath.join(directory, '.safeword/config.json'),
          JSON.stringify({
            crossAgentReviewRoutes: { codex: [{ reviewer, model }] },
          }),
        );
        const ticketPath = '.project/tickets/LIVE01-semantic-proof';
        mkdirSync(nodePath.join(directory, ticketPath), { recursive: true });
        writeFileSync(
          nodePath.join(directory, ticketPath, 'ticket.md'),
          '---\nid: LIVE01\ntype: feature\nphase: plan-execution\nstatus: in_progress\n---\n',
        );
        writeFileSync(
          nodePath.join(directory, ticketPath, 'execution-plan.md'),
          testCase.execution_plan,
        );
        writeFileSync(
          nodePath.join(directory, ticketPath, 'impl-plan.md'),
          testCase.implementation_plan,
        );
        writeFileSync(nodePath.join(directory, 'scenario.feature'), testCase.accepted_scenario);
        let result = await invoke([
          'run',
          'plan-execution',
          `${ticketPath}/execution-plan.md`,
          '--context',
          `${ticketPath}/impl-plan.md`,
          '--context',
          'scenario.feature',
        ]);
        let response = JSON.parse(result.stdout);
        const deadline = Date.now() + CLI_REVIEW_BOUND_MS + 15_000;
        while (response.data?.status === 'pending') {
          pendingId = response.data.review_id;
          if (typeof pendingId !== 'string') throw new Error('Pending review omitted its ID');
          if (Date.now() >= deadline)
            throw new Error(`Live review ${pendingId} exceeded its bound`);
          await delay(1000);
          result = await invoke(['status', pendingId]);
          response = JSON.parse(result.stdout);
        }
        pendingId = undefined;
        process.stdout.write(`Live CLI evidence ${testCase.id}: ${JSON.stringify(response)}\n`);
        expect(result.timedOut).toBe(false);
        expect(response.errors, JSON.stringify(response)).toEqual([]);
        expect(response.data?.actual_reviewer).toBe(reviewer);
        expect(response.data?.independence).toBe('cross-agent');
        expect(response.data?.status).toBe(
          testCase.expectation.verdict === 'approve' ? 'approved' : 'changes_requested',
        );
        const output = response.data?.reviewer_output as ReviewerOutput;
        expect(output, JSON.stringify(response)).toBeDefined();
        expect(output.reviewer_agent).toBe(reviewer);
        assertSemanticOutcome(testCase, output);
        if (testCase.id.includes('discovery-returns-to-implementation-planning')) {
          const applied = await runCli(
            ['--json', '--no-input', 'ticket', 'approve-plan', 'LIVE01', '--cwd', directory],
            {
              cwd: directory,
              env,
              timeout: 30_000,
              unsetEnv: liveProfile === 'default' ? ['CLAUDE_CONFIG_DIR'] : [],
            },
          );
          const transition = JSON.parse(applied.stdout);
          expect(transition.errors, applied.stdout).toEqual([]);
          expect(transition.findings).toContainEqual(
            expect.objectContaining({ code: 'EXECUTION_DISCOVERY_APPLIED' }),
          );
          expect(transition.data.planning_destination).toBe('plan-implementation');
          expect(readFileSync(nodePath.join(directory, ticketPath, 'ticket.md'), 'utf8')).toContain(
            'phase: plan-implementation',
          );
        }
      } finally {
        // The fixture owns exactly one job, including when initial dispatch times out
        // before returning its ID. Cancel the latest local job before removing it.
        const cancelled = await invoke(
          pendingId === undefined ? ['cancel'] : ['cancel', pendingId],
        );
        expect(cancelled.timedOut, 'cancellation must settle before fixture cleanup').toBe(false);
        removeTemporaryDirectory(directory);
      }
    },
    CLI_REVIEW_BOUND_MS + 60_000,
  );
});
