import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  // Ledger position owns precedence; these timestamps intentionally disagree.
  const stamps = ids.map(
    (id, index) =>
      `2026-10-${index === 0 ? '22' : '21'}T00:00:00.000Z fixture review:ABC123-feature:phase@plan-execution author:codex reviewer:claude independence:reduced review-id:${id}`,
  );
  writeFileSync(project.ledgerPath, `${project.upstream}${stamps.join('\n')}\n`);
}

async function executionReview(
  project: Fixture,
  sibling = false,
  kind: 'plan-execution' | 'plan-implementation' = 'plan-execution',
): Promise<string> {
  const folder = sibling ? SIBLING : FOLDER;
  if (sibling)
    cpSync(nodePath.join(project.root, FOLDER), nodePath.join(project.root, SIBLING), {
      recursive: true,
    });
  const target = `${folder}/${kind === 'plan-execution' ? 'execution-plan' : 'impl-plan'}.md`;
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
      kind,
      target,
      '--context',
      `${folder}/${kind === 'plan-execution' ? 'impl-plan' : 'spec'}.md`,
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
        ...(kind === 'plan-execution' && {
          SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: JSON.stringify(record),
        }),
      },
    },
  );
  expect(reviewed.exitCode, reviewed.stdout).toBe(0);
  const output = JSON.parse(reviewed.stdout);
  expect(output.data).toMatchObject({ status: 'approved', review_kind: kind });
  expect(typeof output.data.review_id).toBe('string');
  return output.data.review_id as string;
}

async function prerequisite(project: Fixture) {
  const ticketPath = nodePath.join(project.root, FOLDER, 'ticket.md');
  const before = readFileSync(ticketPath);
  const ledgerBefore = readFileSync(project.ledgerPath);
  const reviews = nodePath.join(project.root, '.safeword/state/reviews');
  const receiptBytes = () =>
    Object.fromEntries(
      readdirSync(reviews)
        .filter(name => name.endsWith('.json'))
        .map(name => [name, readFileSync(nodePath.join(reviews, name))]),
    );
  const receiptsBefore = receiptBytes();
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
  expect(receiptBytes()).toEqual(receiptsBefore);
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

  it.each(['plan-execution', 'plan-implementation'] as const)(
    'names the appropriate mismatch for a sibling %s receipt over identical plan bytes',
    async kind => {
      const project = await fixture();
      const id = await executionReview(project, true, kind);
      expect(readFileSync(nodePath.join(project.root, SIBLING, 'execution-plan.md'))).toEqual(
        readFileSync(nodePath.join(project.root, TARGET)),
      );
      claim(project, [id]);
      const result = await prerequisite(project);
      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.output.state).toBe('action_required');
      expect(result.output.findings).toEqual([
        {
          code:
            kind === 'plan-execution'
              ? 'mismatched_execution_plan_review_ticket'
              : 'mismatched_execution_plan_review_kind',
          message: expect.stringMatching(
            kind === 'plan-execution'
              ? /different ticket/iu
              : /plan-implementation.*plan-execution/u,
          ),
          severity: 'warning',
        },
      ]);
      expect(result.output.next_actions.map(action => action.command)).toEqual([RECOVERY]);
      expect(result.output.data.prerequisite_status).toBeUndefined();
    },
  );

  it.each([
    ['kind', 'before'],
    ['kind', 'after'],
    ['ticket', 'before'],
    ['ticket', 'after'],
  ] as const)('preserves a valid receipt with a wrong-%s claim %s it', async (mismatch, order) => {
    const project = await fixture();
    const valid = await executionReview(project);
    const invalid =
      mismatch === 'kind' ? project.implementationId : await executionReview(project, true);
    claim(project, order === 'before' ? [invalid, valid] : [valid, invalid]);
    const result = await prerequisite(project);
    expect(result.exitCode, result.stdout).toBe(0);
    expect(result.output.data.prerequisite_status).toBe('satisfied');
    expect(result.output.next_actions).toEqual([]);
  });

  it.each(['kind', 'ticket'] as const)(
    'diagnoses the last appended %s mismatch regardless of timestamps',
    async newest => {
      const project = await fixture();
      const sibling = await executionReview(project, true);
      claim(
        project,
        newest === 'kind'
          ? [sibling, project.implementationId]
          : [project.implementationId, sibling],
      );
      const result = await prerequisite(project);
      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.output.findings.map(finding => finding.code)).toEqual([
        `mismatched_execution_plan_review_${newest}`,
      ]);
      expect(result.output.next_actions.map(action => action.command)).toEqual([RECOVERY]);
    },
  );

  it('retains generic recovery for a nonexistent receipt', async () => {
    const project = await fixture();
    claim(project, ['00000000-0000-4000-8000-000000000000']);
    const result = await prerequisite(project);
    expect(result.exitCode, result.stdout).toBe(2);
    expect(result.output.findings.map(finding => finding.code)).toEqual([
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.output.next_actions.map(action => action.command)).toEqual([RECOVERY]);
  });

  it.each(['kind', 'ticket'] as const)('does not diagnose a stale %s mismatch', async mismatch => {
    const project = await fixture();
    const id =
      mismatch === 'kind' ? project.implementationId : await executionReview(project, true);
    const changed = nodePath.join(
      project.root,
      mismatch === 'kind' ? `${FOLDER}/impl-plan.md` : `${SIBLING}/execution-plan.md`,
    );
    writeFileSync(changed, `${readFileSync(changed, 'utf8')}\nA changed decision.\n`);
    claim(project, [id]);
    const result = await prerequisite(project);
    expect(result.exitCode, result.stdout).toBe(2);
    expect(result.output.findings.map(finding => finding.code)).toEqual([
      ...(mismatch === 'kind' ? ['missing_accepted_approach'] : []),
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.output.next_actions.map(action => action.command)).toContain(RECOVERY);
    expect(result.output.data.prerequisite_status).toBeUndefined();
  });

  it.each(['kind', 'ticket'] as const)(
    'does not trust tampered %s mismatch fields',
    async mismatch => {
      const project = await fixture();
      const id =
        mismatch === 'kind' ? project.implementationId : await executionReview(project, true);
      const path = nodePath.join(project.root, '.safeword/state/reviews', `${id}.json`);
      const receipt = JSON.parse(readFileSync(path, 'utf8'));
      receipt.updated_at = 'tampered-without-resigning';
      writeFileSync(path, JSON.stringify(receipt));
      claim(project, [id]);
      const result = await prerequisite(project);
      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.output.findings.map(finding => finding.code)).toEqual([
        ...(mismatch === 'kind' ? ['missing_accepted_approach'] : []),
        'missing_admitted_delivery_checklist',
      ]);
      expect(result.output.next_actions.map(action => action.command)).toContain(RECOVERY);
      expect(result.output.data.prerequisite_status).toBeUndefined();
    },
  );

  it.each(['before', 'after'] as const)(
    'ignores a stale mismatch %s a current mismatch',
    async order => {
      const project = await fixture();
      const stale = await executionReview(project, true);
      const path = nodePath.join(project.root, SIBLING, 'execution-plan.md');
      writeFileSync(path, `${readFileSync(path, 'utf8')}\nChanged decision.\n`);
      claim(
        project,
        order === 'before' ? [stale, project.implementationId] : [project.implementationId, stale],
      );
      const result = await prerequisite(project);
      expect(result.exitCode, result.stdout).toBe(2);
      expect(result.output.findings.map(finding => finding.code)).toEqual([
        'mismatched_execution_plan_review_kind',
      ]);
      expect(result.output.next_actions.map(action => action.command)).toEqual([RECOVERY]);
    },
  );
});
