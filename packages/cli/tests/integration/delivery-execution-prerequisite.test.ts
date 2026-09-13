import { createHmac } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { findCommandDefinition } from '../../src/cli-protocol/catalog.js';
import type { CliResult } from '../../src/cli-protocol/result.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { assertTestCliFresh, runCli } from '../helpers.js';
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
record=$(printenv SAFEWORD_PREREQUISITE_EXECUTION_RECORD || true)
if [ -n "$record" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved","findings":[],"execution_plan_record":%s}\n' "$dispatch_id" "$record"
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
      independence: 'cross-agent',
      reviewer_output: {
        schema_version: 1,
        dispatch_id: 'plan-execution-fixture',
        reviewer_agent: 'claude',
        verdict: 'approve',
        summary: 'approved fixture',
        findings: [],
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

async function admitThroughInstalledCli(
  root: string,
  admitted: readonly PlanningReviewKind[] = [
    'scenario-gate',
    'plan-implementation',
    'plan-execution',
  ],
  designApprovalGate = false,
): Promise<void> {
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'ABC123-feature');
  const plan = executionPlan();
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) throw new Error(parsed.message);
  const record = {
    slicing_decision: 'one_pull_request',
    rationale: 'One coherent contribution.',
    slices: [
      {
        name: 'Contribution',
        purpose: 'Deliver the contribution.',
        boundary: 'Public prerequisite.',
        prerequisites: [],
        proof: 'Integration test.',
        completion_signal: 'The prerequisite is observable.',
        relies_on_unmerged_successor: false,
      },
    ],
    obligation_owners: [{ obligation: 'Contribution', slices: ['Contribution'] }],
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
            SAFEWORD_PREREQUISITE_EXECUTION_RECORD: executionRecord,
          }),
        },
      },
    );
    const id = admittedReviewId(root, reviewKind, target, record, reviewed);
    stamps.push(
      `2026-09-13T00:00:00.000Z fixture review:ABC123-feature:phase@${reviewKind} author:codex reviewer:claude independence:cross-agent review-id:${id}`,
    );
  }
  writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), `${stamps.join('\n')}\n`);
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
      registration: expect.objectContaining({ syntax: 'execution-prerequisite <ticketId>' }),
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

  it('denies an earlier-phase feature that has not completed planning', async () => {
    const root = featureFixture(false, 'define-behavior');

    const invoked = await runCli(
      ['ticket', 'execution-prerequisite', 'ABC123', '--json', '--cwd', root],
      { cwd: root, env: { NODE_ENV: 'test' } },
    );
    const result = JSON.parse(invoked.stdout) as { findings: { code: string }[] };

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
      data: { prerequisite_status: 'not_applicable', grants_authority: false },
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
        data: { prerequisite_status: 'not_applicable', grants_authority: false },
      });
    },
  );
});
