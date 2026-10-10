import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { findCommandDefinition } from '../../src/cli-protocol/catalog.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { assertTestCliFresh, runCli, testCliPath } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

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

function executionPlan(): string {
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

function featureFixture(designApprovalGate = false, phase = 'plan-execution'): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-'));
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
  const featurePath = nodePath.join(root, 'features', 'feature.feature');
  const implementationPath = nodePath.join(ticketDirectory, 'impl-plan.md');
  const executionPath = nodePath.join(ticketDirectory, 'execution-plan.md');
  const plan = executionPlan();
  mkdirSync(ticketDirectory, { recursive: true });
  writePlanningInventories(root);
  mkdirSync(nodePath.dirname(featurePath), { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(root, '.gitignore'), '.safeword/state/\n.review-keys/\n');
  writeFileSync(
    nodePath.join(root, '.safeword', 'config.json'),
    `${JSON.stringify({
      designApprovalGate,
      crossAgentReviewRoutes: {
        codex: [{ reviewer: 'claude', model: 'claude-opus-5' }],
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

function legacyFeatureFixture(phase: 'implement' | 'verify'): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-legacy-'));
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-legacy');
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    `---\ntype: feature\nphase: ${phase}\n---\n`,
  );
  return root;
}

function installReviewer(): string {
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
if [ "$verdict" = "request_changes" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"plan needs repair","findings":[{"severity":"error","message":"%s"}],"evidence_records":{"schema_version":1,"records":[]},"planning_destination":"plan-execution","execution_plan_record":null}\n' "$dispatch_id" "$finding"
elif [ -n "$record" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved","findings":[],"evidence_records":{"schema_version":1,"records":[]},"planning_destination":"plan-execution","execution_plan_record":%s}\n' "$dispatch_id" "$record"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved","findings":[],"evidence_records":{"schema_version":1,"records":[]}}\n' "$dispatch_id"
fi
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function rejectAdmittedScenarioReview(root: string): void {
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

async function admitThroughInstalledCli(
  root: string,
  admitted: readonly PlanningReviewKind[] = [
    'scenario-gate',
    'plan-implementation',
    'plan-execution',
  ],
  designApprovalGate = false,
  slicingDecision: 'one_pull_request' | 'multiple_pull_requests' = 'one_pull_request',
  ticketFolder = 'ABC123-feature',
): Promise<string> {
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', ticketFolder);
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
    rationale: {
      one_pull_request: 'One coherent contribution.',
      multiple_pull_requests: 'Two independently provable dependency-ordered changes.',
    }[slicingDecision],
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
    expect(reviewed.exitCode, reviewed.stdout).toBe(0);
    const id = (JSON.parse(reviewed.stdout) as { data: { review_id: string } }).data.review_id;
    expect(id).toBeTypeOf('string');
    stamps.push(
      `2026-09-13T00:00:00.000Z fixture review:${ticketFolder}:phase@${reviewKind} author:codex reviewer:claude independence:reduced review-id:${id}`,
    );
  }
  writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), `${stamps.join('\n')}\n`);
  return bin;
}

type DeliveryState = 'missing' | 'current' | 'earlier' | 'defect' | 'human';

function prepareDeliveryState(root: string, planPath: string, state: DeliveryState): void {
  const argv = [
    process.execPath,
    testCliPath,
    state === 'defect' ? 'unknown-proof-command' : '--version',
  ];
  const plan = executionPlan()
    .replace(JSON.stringify([process.execPath, '--version']), () => JSON.stringify(argv))
    .split('\n')
    .map(line => {
      if (!/^\| item-\d+ \|/u.test(line) || line.startsWith('| item-4 |')) return line;
      if (state === 'human' && line.startsWith('| item-11 |')) {
        return '| item-11 | completion evidence | Accept security authority. | human |  | pending_human | missing |  | security-review |';
      }
      return line.replace(
        /\| contributor \| proof \| open \| missing \| {2}\| {2}\|$/u,
        '| contributor |  | not_applicable | missing |  | No applicable delivery work. |',
      );
    })
    .join('\n');
  writeFileSync(planPath, plan);
  if (state !== 'missing')
    writeFileSync(nodePath.join(root, 'implementation.txt'), 'Current implementation exists.\n');
}

async function assertDeliveryState(
  root: string,
  state: DeliveryState,
  env: Record<string, string>,
): Promise<void> {
  const observed = await runCli(
    ['ticket', 'delivery-checklist', 'ABC123', '--json', '--cwd', root],
    { cwd: root, env },
  );
  const data = (
    JSON.parse(observed.stdout) as {
      data: {
        readiness_state: string;
        merge_authorization: string;
        pending_human_items: string[];
        contributor_evidence: {
          item_id: string;
          status: string;
          evidence_class: string;
          limitations: string[];
        }[];
      };
    }
  ).data;
  expect(data.merge_authorization).toBe('pending');
  const item = data.contributor_evidence.find(row => row.item_id === 'item-4');
  if (state === 'current' || state === 'human') {
    expect(item).toMatchObject({
      status: 'complete',
      evidence_class: 'current_revision_real_boundary',
    });
    expect(data.readiness_state).toBe(
      state === 'human' ? 'ready_for_human_review' : 'contributor_work_complete',
    );
  } else {
    expect(item?.status).toBe('open');
    expect(data.readiness_state).toBe('contributor_work_incomplete');
    expect(item?.evidence_class).toBe(state === 'earlier' ? 'partial_or_structural' : 'missing');
    if (state === 'earlier') expect(item?.limitations).toContain('earlier_revision');
  }
  if (state === 'human') expect(data.pending_human_items).toEqual(['item-11']);
}

describe('delivery execution prerequisite', () => {
  beforeAll(assertTestCliFresh);

  afterEach(() => {
    cleanupTrustedReviewerDirectories();
  });

  it('is registered as a public observe-only CLI command', () => {
    expect(findCommandDefinition('ticket execution-prerequisite')).toMatchObject({
      name: 'ticket execution-prerequisite',
      effectClass: 'observe',
      networkPolicy: 'never',
      registration: expect.objectContaining({
        syntax: 'execution-prerequisite <ticketId>',
      }),
    });
  });

  it('runs through the installed CLI with integrity-checked admitted reviews', async () => {
    const root = featureFixture();
    await admitThroughInstalledCli(root);

    const result = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(result.exitCode, result.stdout).toBe(0);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(output.data).toEqual({
      command: 'ticket execution-prerequisite',
      prerequisite_status: 'satisfied',
      grants_authority: false,
      execution_plan_artifact: {
        presence: 'present',
        readability: 'readable',
        status: 'planned',
        receipt: 'valid',
      },
    });
    expect(output).toMatchObject({ state: 'healthy', next_actions: [] });
    expect(output.effects).toEqual({
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    });
  });

  it('names the wrong review kind even when both plan artifacts have identical bytes', async () => {
    const root = featureFixture();
    const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      readFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), 'utf8'),
    );
    await admitThroughInstalledCli(root);
    const invoke = () =>
      runCli(['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root], {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      });
    const matching = await invoke();
    expect(matching.exitCode, matching.stdout).toBe(0);

    const ledgerPath = nodePath.join(root, '.project', 'skill-invocations.log');
    const rows = readFileSync(ledgerPath, 'utf8').trim().split('\n');
    const implementation = rows.find(row => row.includes(':phase@plan-implementation '));
    expect(implementation).toBeDefined();
    if (implementation === undefined) throw new Error('Missing Implementation review fixture');
    const executionAlias = implementation.replace(
      ':phase@plan-implementation ',
      ':phase@plan-execution ',
    );
    writeFileSync(
      ledgerPath,
      `${[...rows.filter(row => !row.includes(':phase@plan-execution ')), executionAlias].join('\n')}\n`,
    );
    const mismatched = await invoke();
    expect(mismatched.exitCode, mismatched.stdout).toBe(2);
    const output = JSON.parse(mismatched.stdout);
    expect(output.data.grants_authority).toBe(false);
    expect(output.findings).toContainEqual(
      expect.objectContaining({ code: 'missing_admitted_delivery_checklist' }),
    );
    const diagnostic = output.findings
      .map((finding: { message: string }) => finding.message)
      .join('\n');
    expect(diagnostic).toMatch(/review kind/iu);
    expect(diagnostic).toContain('plan-implementation');
    expect(diagnostic).toContain('plan-execution');
    const recoveryCommands = output.next_actions.map(
      (action: { command: string }) => action.command,
    );
    expect(recoveryCommands).toContainEqual(expect.stringContaining('review run plan-execution'));
  });

  it('refuses approval when a signed malformed receipt bypasses current-context validation', async () => {
    const root = featureFixture();
    await admitThroughInstalledCli(root);
    const options = {
      cwd: root,
      env: {
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
      },
    };
    const args = ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root];
    const matching = await runCli(args, options);
    expect(matching.exitCode, matching.stdout).toBe(0);

    const ledgerPath = nodePath.join(root, '.project', 'skill-invocations.log');
    const rows = readFileSync(ledgerPath, 'utf8').trim().split('\n');
    const execution = rows.find(row => row.includes(':phase@plan-execution '));
    const reviewId = /review-id:(\S+)/u.exec(execution ?? '')?.[1];
    if (reviewId === undefined) throw new Error('Missing Execution review fixture');
    const jobPath = nodePath.join(root, '.safeword', 'state', 'reviews', `${reviewId}.json`);
    const job = JSON.parse(readFileSync(jobPath, 'utf8'));
    const { integrity: _integrity, ...unsigned } = job;
    // Model an authenticated receipt whose result envelope the strict reader cannot validate.
    unsigned.result.schemaVersion = 0;
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
      .update(JSON.stringify(unsigned))
      .digest('hex');
    writeFileSync(jobPath, `${JSON.stringify({ ...unsigned, integrity })}\n`);

    writeFileSync(
      nodePath.join(root, '.project', 'tickets', 'ABC123-feature', 'impl-plan.md'),
      '# Implementation Plan\n\n## Approach\nA changed accepted implementation boundary.\n',
    );
    await admitThroughInstalledCli(root, ['plan-implementation']);
    const currentImplementation = readFileSync(ledgerPath, 'utf8').trim();
    writeFileSync(
      ledgerPath,
      `${[...rows.filter(row => !row.includes(':phase@plan-implementation ')), currentImplementation].join('\n')}\n`,
    );
    const strict = await runCli(['review', 'status', reviewId, '--json', '--cwd', root], options);
    expect(strict.exitCode, strict.stdout).toBe(1);
    expect(JSON.parse(strict.stdout).errors).toContainEqual(
      expect.objectContaining({ code: 'REVIEW_JOB_INVALID' }),
    );
    const blocked = await runCli(args, options);
    expect(blocked.exitCode, blocked.stdout).toBe(2);
    const output = JSON.parse(blocked.stdout);
    expect(output.data.grants_authority).toBe(false);
    expect(output.data.prerequisite_status).not.toBe('satisfied');
    expect(output.findings).toContainEqual(
      expect.objectContaining({ code: 'missing_admitted_delivery_checklist' }),
    );
  });

  it('names the sibling ticket when its authenticated approval covers identical plan bytes', async () => {
    const root = featureFixture();
    const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
    await admitThroughInstalledCli(root);
    const invoke = (ticketId: string) =>
      runCli(['ticket', 'execution-prerequisite', ticketId, '--json', '--cwd', root], {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      });
    const matching = await invoke('ABC123');
    expect(matching.exitCode, matching.stdout).toBe(0);
    const ledgerPath = nodePath.join(root, '.project', 'skill-invocations.log');
    const currentRows = readFileSync(ledgerPath, 'utf8').trim().split('\n');

    const siblingDirectory = nodePath.join(root, '.project', 'tickets', 'XYZ789-feature');
    cpSync(ticketDirectory, siblingDirectory, { recursive: true });
    await admitThroughInstalledCli(
      root,
      ['plan-execution'],
      false,
      'one_pull_request',
      'XYZ789-feature',
    );
    expect(readFileSync(nodePath.join(siblingDirectory, 'execution-plan.md'), 'utf8')).toBe(
      readFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), 'utf8'),
    );
    const siblingReceipt = readFileSync(ledgerPath, 'utf8').trim();
    const alias = siblingReceipt.replace('review:XYZ789-feature:', 'review:ABC123-feature:');
    writeFileSync(
      ledgerPath,
      `${[...currentRows.filter(row => !row.includes(':phase@plan-execution ')), alias].join('\n')}\n`,
    );
    const mismatched = await invoke('ABC123');
    expect(mismatched.exitCode, mismatched.stdout).toBe(2);
    const output = JSON.parse(mismatched.stdout);
    expect(output.data.grants_authority).toBe(false);
    expect(output.findings).toContainEqual(
      expect.objectContaining({ code: 'missing_admitted_delivery_checklist' }),
    );
    const diagnostic = output.findings
      .map((finding: { message: string }) => finding.message)
      .join('\n');
    expect(diagnostic).toContain('XYZ789-feature');
    expect(diagnostic).toContain('ABC123-feature');
    const recoveryCommands = output.next_actions.map(
      (action: { command: string }) => action.command,
    );
    expect(recoveryCommands).toContainEqual(expect.stringContaining('review run plan-execution'));
  });

  it.each([
    {
      label: 'present artifact with planned status and a valid receipt',
      arrange: (_executionPath: string) => {},
      expectedExitCode: 0,
      expectedFacts: {
        presence: 'present',
        readability: 'readable',
        status: 'planned',
        receipt: 'valid',
      },
    },
    {
      label: 'absent artifact',
      arrange: (executionPath: string) => {
        rmSync(executionPath);
      },
      expectedExitCode: 2,
      expectedFacts: {
        presence: 'absent',
        readability: 'not_applicable',
        status: 'unknown',
        receipt: 'missing',
      },
    },
    {
      label: 'readable artifact with a non-planned status and no current receipt',
      arrange: (executionPath: string) => {
        writeFileSync(
          executionPath,
          readFileSync(executionPath, 'utf8').replace('**Status:** planned', '**Status:** draft'),
        );
      },
      expectedExitCode: 2,
      expectedFacts: {
        presence: 'present',
        readability: 'readable',
        status: 'unknown',
        receipt: 'missing',
      },
    },
    {
      label: 'present but unreadable artifact',
      arrange: (executionPath: string) => {
        rmSync(executionPath);
        mkdirSync(executionPath);
      },
      expectedExitCode: 2,
      expectedFacts: {
        presence: 'present',
        readability: 'unreadable',
        status: 'unknown',
        receipt: 'not_checked',
      },
    },
  ])('reports structural facts for a $label without a semantic verdict', async testCase => {
    const root = featureFixture();
    await admitThroughInstalledCli(root);
    const executionPath = nodePath.join(
      root,
      '.project',
      'tickets',
      'ABC123-feature',
      'execution-plan.md',
    );
    testCase.arrange(executionPath);

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(invoked.exitCode, invoked.stdout).toBe(testCase.expectedExitCode);
    const result = JSON.parse(invoked.stdout) as {
      data?: Record<string, unknown>;
      errors?: readonly unknown[];
    };
    expect(result.errors ?? []).toEqual([]);
    expect(result.data).toEqual({
      command: 'ticket execution-prerequisite',
      grants_authority: false,
      ...(testCase.expectedExitCode === 0 && {
        prerequisite_status: 'satisfied',
      }),
      execution_plan_artifact: testCase.expectedFacts,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /\b(?:not )?implementable\b|\bapproved\b|\bready for coding\b/iu,
    );
  });

  it('reports every missing prerequisite once in deterministic planning order', async () => {
    const root = featureFixture();

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string; message: string }[];
      next_actions: { command: string }[];
      data?: { prerequisite_status?: string };
    };

    expect(invoked.exitCode).toBe(2);
    expect(result).toMatchObject({ state: 'action_required' });
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_accepted_scenarios',
      'missing_accepted_approach',
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.findings.map(finding => finding.message)).toEqual([
      'Accepted scenarios are required before execution.',
      'An accepted implementation approach is required before execution.',
      'An admitted Delivery Checklist is required before execution.',
    ]);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword review run scenario-gate --context .project/tickets/ABC123-feature/spec.md -- features/feature.feature',
      'safeword review run plan-implementation --context features/feature.feature --context .project/tickets/ABC123-feature/spec.md -- .project/tickets/ABC123-feature/impl-plan.md',
      'safeword review run plan-execution --context .project/tickets/ABC123-feature/impl-plan.md --context features/feature.feature -- .project/tickets/ABC123-feature/execution-plan.md',
    ]);
    expect(result.data?.prerequisite_status).toBeUndefined();
  });

  it('denies an authenticated scenario review that requested changes', async () => {
    const root = featureFixture();
    await admitThroughInstalledCli(root);
    rejectAdmittedScenarioReview(root);

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string }[];
      next_actions: { command: string }[];
      data?: { prerequisite_status?: string };
    };

    expect(invoked.exitCode).toBe(2);
    expect(result.state).toBe('action_required');
    expect(result.findings.map(finding => finding.code)).toEqual(['missing_accepted_scenarios']);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword review run scenario-gate --context .project/tickets/ABC123-feature/spec.md -- features/feature.feature',
    ]);
    expect(result.data?.prerequisite_status).toBeUndefined();
  });

  it('denies an earlier-phase feature that has not completed planning', async () => {
    const root = featureFixture(false, 'define-behavior');

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      { cwd: root, env: { NODE_ENV: 'test' } },
    );
    const result = JSON.parse(invoked.stdout) as {
      findings: { code: string }[];
    };

    expect(invoked.exitCode).toBe(2);
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_accepted_scenarios',
      'missing_accepted_approach',
      'missing_admitted_delivery_checklist',
    ]);
  });

  it.each([
    [
      'accepted scenarios',
      ['plan-implementation', 'plan-execution'],
      'missing_accepted_scenarios',
      'Accepted scenarios are required before execution.',
      'safeword review run scenario-gate --context .project/tickets/ABC123-feature/spec.md -- features/feature.feature',
    ],
    [
      'accepted implementation approach',
      ['scenario-gate', 'plan-execution'],
      'missing_accepted_approach',
      'An accepted implementation approach is required before execution.',
      'safeword review run plan-implementation --context features/feature.feature --context .project/tickets/ABC123-feature/spec.md -- .project/tickets/ABC123-feature/impl-plan.md',
    ],
    [
      'admitted Delivery Checklist',
      ['scenario-gate', 'plan-implementation'],
      'missing_admitted_delivery_checklist',
      'An admitted Delivery Checklist is required before execution.',
      'safeword review run plan-execution --context .project/tickets/ABC123-feature/impl-plan.md --context features/feature.feature -- .project/tickets/ABC123-feature/execution-plan.md',
    ],
  ] as const)(
    'denies only the missing %s prerequisite with one repair',
    async (_label, admitted, expectedCode, expectedMessage, expectedCommand) => {
      const root = featureFixture();
      await admitThroughInstalledCli(root, admitted);

      const invoked = await runCli(
        ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
        {
          cwd: root,
          env: {
            NODE_ENV: 'test',
            SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
          },
        },
      );
      const result = JSON.parse(invoked.stdout) as {
        state: string;
        findings: { code: string; message: string }[];
        next_actions: { command: string }[];
        data?: { prerequisite_status?: string };
      };

      expect(invoked.exitCode).toBe(2);
      expect(result.state).toBe('action_required');
      expect(result.findings.map(finding => finding.code)).toEqual([expectedCode]);
      expect(result.findings[0]?.message).toBe(expectedMessage);
      expect(result.next_actions.map(action => action.command)).toEqual([expectedCommand]);
      expect(result.data?.prerequisite_status).toBeUndefined();
    },
  );

  it('requires configured human design approval as part of the accepted approach', async () => {
    const root = featureFixture(true);
    await admitThroughInstalledCli(
      root,
      ['scenario-gate', 'plan-implementation', 'plan-execution'],
      true,
    );

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );
    const result = JSON.parse(invoked.stdout) as {
      findings: { code: string }[];
      next_actions: { command: string }[];
    };

    expect(invoked.exitCode).toBe(2);
    expect(result.findings.map(finding => finding.code)).toEqual(['missing_accepted_approach']);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword ticket approve-plan ABC123',
    ]);
  });

  it.each([
    [
      'one_pull_request',
      'One coherent contribution.',
      [{ name: 'Contribution', prerequisites: [] }],
    ],
    [
      'multiple_pull_requests',
      'Two independently provable dependency-ordered changes.',
      [
        { name: 'Foundation', prerequisites: [] },
        { name: 'Contribution', prerequisites: ['Foundation'] },
      ],
    ],
  ] as const)(
    'returns the reviewed %s slicing outcome when its checklist item is completed',
    async (decision, rationale, expectedSlices) => {
      const root = featureFixture();
      await admitThroughInstalledCli(root, undefined, false, decision);
      const reviewEnvironment = {
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
      };
      const prerequisite = await runCli(
        ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
        { cwd: root, env: reviewEnvironment },
      );
      expect(prerequisite.exitCode, prerequisite.stdout).toBe(0);
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 'proof@example.com'], {
        cwd: root,
      });
      execFileSync('git', ['config', 'user.name', 'Proof Test'], { cwd: root });
      execFileSync('git', ['add', '.'], { cwd: root });
      execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], {
        cwd: root,
      });

      const invoked = await runCli(
        ['ticket', 'record-delivery-proof', 'ABC123', 'item-3', 'proof', '--json', '--cwd', root],
        { cwd: root, env: reviewEnvironment },
      );
      const result = JSON.parse(invoked.stdout) as {
        data?: Record<string, unknown>;
      };

      expect(invoked.exitCode, invoked.stdout).toBe(0);
      expect(
        readFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), 'utf8'),
      ).toContain('delivery-proof:v1:');
      expect(
        readFileSync(
          nodePath.join(root, '.project', 'tickets', 'ABC123-feature', 'execution-plan.md'),
          'utf8',
        ),
      ).toMatch(/^\| item-3 \|.*\| complete \| current_revision_real_boundary \|/mu);
      expect(
        result.data?.pull_request_slicing,
        'completed checklist response must include pull_request_slicing',
      ).toEqual({
        decision,
        rationale,
        slices: expectedSlices,
      });
    },
  );

  it.each(['missing', 'current', 'earlier', 'defect', 'human'] as const)(
    'records current-to-target delivery state through the installed CLI: %s',
    async state => {
      const root = featureFixture();
      const planPath = nodePath.join(root, '.project/tickets/ABC123-feature/execution-plan.md');
      prepareDeliveryState(root, planPath, state);
      await admitThroughInstalledCli(root);
      const git = (args: string[]): void => {
        execFileSync('git', args, { cwd: root });
      };
      git(['init', '--quiet']);
      git(['config', 'user.email', 'proof@example.com']);
      git(['config', 'user.name', 'Proof Test']);
      git(['config', 'commit.gpgsign', 'false']);
      git(['add', '.']);
      git(['commit', '--quiet', '-m', 'accepted target and current implementation']);
      const env = {
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
      };
      if (state !== 'missing') {
        const recorded = await runCli(
          ['ticket', 'record-delivery-proof', 'ABC123', 'item-4', 'proof', '--json', '--cwd', root],
          { cwd: root, env },
        );
        expect(recorded.exitCode, recorded.stdout).toBe(state === 'defect' ? 2 : 0);
        if (state === 'earlier') {
          writeFileSync(
            nodePath.join(root, 'implementation.txt'),
            'Current implementation changed after proof.\n',
          );
          git(['add', '.']);
          git(['commit', '--quiet', '-m', 'change implementation after authenticated proof']);
        }
      }
      await assertDeliveryState(root, state, env);
      rmSync(root, { recursive: true, force: true });
    },
  );

  it.each(['partial_or_structural', 'reusable_earlier_revision'] as const)(
    'records canonical delivery evidence through the installed CLI: %s',
    async evidenceClass => {
      const root = featureFixture();
      const planPath = nodePath.join(root, '.project/tickets/ABC123-feature/execution-plan.md');
      const argv = JSON.stringify([process.execPath, testCliPath, '--version']);
      let plan = executionPlan().replace(
        JSON.stringify([process.execPath, '--version']),
        () => argv,
      );
      plan = plan.replace('current_required', 'compatible_earlier_allowed');
      if (evidenceClass === 'partial_or_structural') {
        const supporting = `| supporting-proof | command | unit | metadata shape only | partial_or_structural | current_required | {"type":"command","cwd":".","argv":[${JSON.stringify(process.execPath)},"-e","if (!require('node:fs').readFileSync('.project/tickets/ABC123-feature/execution-plan.md','utf8').includes('Delivery checklist')) process.exit(1)"]} |`;
        plan = plan.replace(
          '\n\n## Delivery checklist',
          () => `\n${supporting}\n\n## Delivery checklist`,
        );
      }
      writeFileSync(planPath, plan);
      const bin = await admitThroughInstalledCli(root);
      const git = (args: string[]): void => {
        execFileSync('git', args, { cwd: root });
      };
      git(['init', '--quiet']);
      git(['config', 'user.email', 'proof@example.com']);
      git(['config', 'user.name', 'Proof Test']);
      git(['config', 'commit.gpgsign', 'false']);
      git(['add', '.']);
      git(['commit', '--quiet', '-m', 'accepted proof boundary']);
      const env = {
        NODE_ENV: 'test',
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        PATH: `${bin}:/usr/bin:/bin`,
      };
      const proofId = evidenceClass === 'partial_or_structural' ? 'supporting-proof' : 'proof';
      const recorded = await runCli(
        ['ticket', 'record-delivery-proof', 'ABC123', 'item-4', proofId, '--json', '--cwd', root],
        { cwd: root, env },
      );
      expect(recorded.exitCode, recorded.stdout).toBe(0);
      if (evidenceClass === 'reusable_earlier_revision') {
        const receipt = (JSON.parse(recorded.stdout) as { data: { receipt_id: string } }).data
          .receipt_id;
        expect(receipt).toBeTypeOf('string');
        writeFileSync(nodePath.join(root, 'documentation.md'), '# Documentation-only change\n');
        git(['add', '.']);
        git(['commit', '--quiet', '-m', 'documentation-only revision']);
        const reused = await runCli(
          [
            'ticket',
            'record-delivery-proof',
            'ABC123',
            'item-4',
            'proof',
            '--receipt',
            receipt,
            '--compatible-reason',
            'Only documentation changed; accepted boundary is unchanged.',
            '--confirm-egress',
            '--json',
            '--cwd',
            root,
          ],
          { cwd: root, env },
        );
        expect(reused.exitCode, reused.stdout).toBe(0);
        expect(
          readFileSync(nodePath.join(root, '.project/skill-invocations.log'), 'utf8'),
        ).toContain('delivery-compatibility:v1:');
      }
      const observed = await runCli(
        ['ticket', 'delivery-checklist', 'ABC123', '--json', '--cwd', root],
        { cwd: root, env },
      );
      const data = (
        JSON.parse(observed.stdout) as {
          data: {
            contributor_evidence: {
              item_id: string;
              status: string;
              evidence_class: string;
            }[];
          };
        }
      ).data;
      expect(data.contributor_evidence.find(item => item.item_id === 'item-4')).toMatchObject({
        evidence_class: evidenceClass,
        status: evidenceClass === 'partial_or_structural' ? 'open' : 'complete',
      });
      rmSync(root, { recursive: true, force: true });
    },
  );

  it('rejects partial structural proof through the installed CLI readiness command', async () => {
    const root = featureFixture();
    const planPath = nodePath.join(root, '.project/tickets/ABC123-feature/execution-plan.md');
    writeFileSync(planPath, executionPlan().replaceAll('real_boundary', 'partial_or_structural'));
    const observed = await runCli(
      ['ticket', 'delivery-checklist', 'ABC123', '--json', '--cwd', root],
      { cwd: root, env: { NODE_ENV: 'test' } },
    );
    expect(observed.exitCode).toBe(2);
    expect(JSON.parse(observed.stdout)).toMatchObject({
      state: 'action_required',
      findings: [expect.objectContaining({ code: 'required_proof_not_real_boundary' })],
    });
    expect(readFileSync(planPath, 'utf8')).not.toContain('| complete |');
    rmSync(root, { recursive: true, force: true });
  });

  it.each(['task', 'patch'] as const)('keeps %s work outside the feature contract', async type => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-prerequisite-small-'));
    const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-small');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), `---\ntype: ${type}\n---\n`);

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      { cwd: root, env: { NODE_ENV: 'test' } },
    );
    const result = JSON.parse(invoked.stdout) as Record<string, unknown>;

    expect(invoked.exitCode).toBe(0);
    expect(result).toMatchObject({
      state: 'healthy',
      data: {
        prerequisite_status: 'not_applicable',
        grants_authority: false,
      },
    });
    expect(result.effects).toEqual({
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    });
    expect(existsSync(nodePath.join(ticketDirectory, 'impl-plan.md'))).toBe(false);
    expect(existsSync(nodePath.join(ticketDirectory, 'execution-plan.md'))).toBe(false);
  });

  it.each(['implement', 'verify'] as const)(
    'keeps a legacy feature already in %s outside the new prerequisite',
    async phase => {
      const root = legacyFeatureFixture(phase);

      const invoked = await runCli(
        ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
        { cwd: root, env: { NODE_ENV: 'test' } },
      );
      const result = JSON.parse(invoked.stdout) as Record<string, unknown>;

      expect(invoked.exitCode).toBe(0);
      expect(result).toMatchObject({
        state: 'healthy',
        data: {
          prerequisite_status: 'not_applicable',
          grants_authority: false,
        },
      });
    },
  );
});
