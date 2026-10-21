import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import {
  admitThroughInstalledCli,
  featureFixture,
  installReviewer,
} from '../fixtures/delivery-cli.js';
import { assertTestCliFresh, runCli } from '../helpers.js';
import { cleanupTrustedReviewerDirectories } from '../review-fixtures.js';

const FOLDER = '.project/tickets/ABC123-feature';
const TARGET = `${FOLDER}/execution-plan.md`;
const SIBLING = '.project/tickets/XYZ789-sibling';
const RECOVERY = `safeword review run plan-execution --context ${FOLDER}/impl-plan.md --context features/feature.feature -- ${TARGET}`;
const roots: string[] = [];

interface PrerequisiteResult {
  state: string;
  findings: { code: string; message: string }[];
  next_actions: { command: string }[];
  data: { grants_authority: boolean; prerequisite_status?: string };
}

beforeAll(assertTestCliFresh);
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function fixture() {
  const root = featureFixture();
  roots.push(root);
  // Identical bytes cannot stand in for the reviewed artifact's kind or ticket.
  writeFileSync(
    nodePath.join(root, FOLDER, 'impl-plan.md'),
    readFileSync(nodePath.join(root, TARGET)),
  );
  await admitThroughInstalledCli(root, ['scenario-gate', 'plan-implementation']);
  const ledgerPath = nodePath.join(root, '.project/skill-invocations.log');
  const upstream = readFileSync(ledgerPath, 'utf8');
  const implementationId = /phase@plan-implementation[^\n]*review-id:(\S+)/u.exec(upstream)?.[1];
  if (implementationId === undefined) throw new Error('Missing genuine Implementation review');
  return { root, ledgerPath, upstream, implementationId };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

function claim(project: Fixture, ids: readonly string[]): void {
  const stamps = ids.map(
    id =>
      `2026-10-21T00:00:00.000Z fixture review:ABC123-feature:phase@plan-execution author:codex reviewer:claude independence:reduced review-id:${id}`,
  );
  writeFileSync(project.ledgerPath, `${project.upstream}${stamps.join('\n')}\n`);
}

async function executionReview(project: Fixture, sibling = false): Promise<string> {
  const folder = sibling ? SIBLING : FOLDER;
  if (sibling)
    cpSync(nodePath.join(project.root, FOLDER), nodePath.join(project.root, SIBLING), {
      recursive: true,
    });
  const target = `${folder}/execution-plan.md`;
  const plan = readFileSync(nodePath.join(project.root, target), 'utf8');
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) throw new Error(parsed.message);
  const bin = installReviewer();
  const record = {
    slicing_decision: 'one_pull_request',
    rationale: 'One receipt identity boundary.',
    slices: [
      {
        name: 'Receipt diagnosis',
        purpose: 'Explain refusal without granting authority.',
        boundary: 'Public execution prerequisite.',
        prerequisites: [],
        proof: 'The public CLI names the mismatch.',
        completion_signal: 'The required review is named.',
        relies_on_unmerged_successor: false,
      },
    ],
    obligation_owners: [{ obligation: 'Receipt diagnosis', slices: ['Receipt diagnosis'] }],
    decision_statuses: [{ decision: 'Preserve admission rules.', status: 'unchanged' }],
    accepted_scenarios_covered: true,
    accepted_approach_preserved: true,
    normalized_plan_digest: normalizedExecutionPlanDigest(plan),
    delivery_definition: createExecutionPlanDeliveryDefinition(parsed, false),
  };
  const reviewed = await runCli(
    [
      'review',
      'run',
      'plan-execution',
      target,
      '--context',
      `${folder}/impl-plan.md`,
      '--context',
      'features/feature.feature',
      '--json',
      '--no-input',
      '--cwd',
      project.root,
    ],
    {
      cwd: project.root,
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        NODE_ENV: 'test',
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(project.root, '.review-keys'),
        SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: JSON.stringify(record),
      },
    },
  );
  expect(reviewed.exitCode, reviewed.stdout).toBe(0);
  const output = JSON.parse(reviewed.stdout);
  expect(output.data).toMatchObject({ status: 'approved', review_kind: 'plan-execution' });
  expect(typeof output.data.review_id).toBe('string');
  return output.data.review_id as string;
}

async function prerequisite(project: Fixture) {
  const ticketPath = nodePath.join(project.root, FOLDER, 'ticket.md');
  const before = readFileSync(ticketPath);
  const ledgerBefore = readFileSync(project.ledgerPath);
  const result = await runCli(
    ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', project.root],
    {
      cwd: project.root,
      env: {
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(project.root, '.review-keys'),
      },
    },
  );
  expect(readFileSync(ticketPath)).toEqual(before);
  expect(readFileSync(project.ledgerPath)).toEqual(ledgerBefore);
  const output = JSON.parse(result.stdout) as PrerequisiteResult;
  expect(output.data.grants_authority).toBe(false);
  return { ...result, output };
}

describe('Execution Plan receipt identity recovery through the public CLI', () => {
  it('admits the genuine current matching receipt as a positive control', async () => {
    const project = await fixture();
    claim(project, [await executionReview(project)]);
    const result = await prerequisite(project);
    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.output).toMatchObject({
      state: 'healthy',
      data: { prerequisite_status: 'satisfied' },
      next_actions: [],
    });
  });

  it('names the actual and required kind and reruns the required review', async () => {
    const project = await fixture();
    claim(project, [project.implementationId]);
    const result = await prerequisite(project);
    expect(result.exitCode, result.stdout).toBe(2);
    expect(result.output.state).toBe('action_required');
    expect(result.output.findings).toEqual([
      {
        code: 'mismatched_execution_plan_review_kind',
        message: expect.stringMatching(/plan-implementation.*plan-execution/u),
        severity: 'warning',
      },
    ]);
    expect(result.output.next_actions.map(action => action.command)).toEqual([RECOVERY]);
    expect(result.output.data.prerequisite_status).toBeUndefined();
  });

  it('names a sibling-ticket mismatch even when the reviewed plan bytes are identical', async () => {
    const project = await fixture();
    const id = await executionReview(project, true);
    expect(readFileSync(nodePath.join(project.root, SIBLING, 'execution-plan.md'))).toEqual(
      readFileSync(nodePath.join(project.root, TARGET)),
    );
    claim(project, [id]);
    const result = await prerequisite(project);
    expect(result.exitCode, result.stdout).toBe(2);
    expect(result.output.state).toBe('action_required');
    expect(result.output.findings).toEqual([
      {
        code: 'mismatched_execution_plan_review_ticket',
        message: expect.stringMatching(/different ticket/iu),
        severity: 'warning',
      },
    ]);
    expect(result.output.next_actions.map(action => action.command)).toEqual([RECOVERY]);
    expect(result.output.data.prerequisite_status).toBeUndefined();
  });
});
