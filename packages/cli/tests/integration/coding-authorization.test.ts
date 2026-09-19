import { createHash, createHmac } from 'node:crypto';
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

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { appendDesignDecision } from '../../src/review/approval-ledger.js';
import {
  assertTestCliFresh,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_ACCEPTANCE_LANE,
} from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

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
const fixtureRoots: string[] = [];

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
    `| proof | command | integration | public authorization | real_boundary | current_required | {"type":"command","cwd":".","argv":[${JSON.stringify(process.execPath)},"--version"]} |`,
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

function mutateExecutionReview(
  root: string,
  mutate: (data: Record<string, unknown>) => Record<string, unknown>,
): void {
  const ledger = readFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), 'utf8');
  const reviewId = /phase@plan-execution[^\n]*review-id:(\S+)/u.exec(ledger)?.[1];
  if (reviewId === undefined) throw new Error('plan-execution review id missing');
  const path = nodePath.join(root, '.safeword', 'state', 'reviews', `${reviewId}.json`);
  const record = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const { integrity: _integrity, ...unsigned } = record;
  const result = { ...(unsigned.result as Record<string, unknown>) };
  result.data = mutate({ ...(result.data as Record<string, unknown>) });
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

function rewriteExecutionReviewStamp(root: string, rewrite: (line: string) => string): void {
  const ledgerPath = nodePath.join(root, '.project', 'skill-invocations.log');
  const lines = readFileSync(ledgerPath, 'utf8').split('\n');
  const index = lines.findIndex(line => line.includes('phase@plan-execution'));
  if (index === -1) throw new Error('plan-execution review stamp missing');
  lines[index] = rewrite(lines[index] ?? '');
  writeFileSync(ledgerPath, lines.join('\n'));
}

function installReviewer(): string {
  const directory = createTrustedReviewerDirectory('safeword-coding-authorization-');
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
if [ -n "$record" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved fixture","findings":[],"execution_plan_record":%s}\n' "$dispatch_id" "$record"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved fixture","findings":[]}\n' "$dispatch_id"
fi
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

async function admitReview(
  root: string,
  kind: 'scenario-gate' | 'plan-implementation' | 'plan-execution',
  target: string,
  context: readonly string[],
  options: { bin: string; executionPlanRecord?: Record<string, unknown> },
): Promise<string> {
  const reviewed = await runCli(
    [
      'review',
      'run',
      kind,
      target,
      ...context.flatMap(path => ['--context', path]),
      '--json',
      '--no-input',
      '--cwd',
      root,
    ],
    {
      cwd: root,
      env: {
        PATH: `${options.bin}:/usr/bin:/bin`,
        NODE_ENV: 'test',
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_NO_UPDATE_CHECK: '1',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        ...(options.executionPlanRecord !== undefined && {
          SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: JSON.stringify(options.executionPlanRecord),
        }),
      },
    },
  );
  expect(reviewed.exitCode, reviewed.stdout).toBe(0);
  const result = JSON.parse(reviewed.stdout) as { data?: { review_id?: string } };
  if (result.data?.review_id === undefined) throw new Error(`${kind} review id missing`);
  return result.data.review_id;
}

function executionReviewRecord(plan: string, designApprovalGate: boolean): Record<string, unknown> {
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) throw new Error(parsed.message);
  return {
    slicing_decision: 'one_pull_request',
    rationale: 'One coherent contribution.',
    slices: [
      {
        name: 'Contribution',
        purpose: 'Deliver coding authorization.',
        boundary: 'Public authorization command.',
        prerequisites: [],
        proof: 'Integration test.',
        completion_signal: 'Authorization is observable.',
        relies_on_unmerged_successor: false,
      },
    ],
    obligation_owners: [{ obligation: 'Contribution', slices: ['Contribution'] }],
    decision_statuses: [{ decision: 'Use accepted plans', status: 'unchanged' }],
    accepted_scenarios_covered: true,
    accepted_approach_preserved: true,
    normalized_plan_digest: normalizedExecutionPlanDigest(plan),
    delivery_definition: createExecutionPlanDeliveryDefinition(parsed, designApprovalGate),
  };
}

async function refreshReviews(
  root: string,
  from: 'scenario' | 'implementation' | 'execution',
): Promise<void> {
  const ticketFolder = 'ABC123-feature';
  const featureTarget = 'features/feature.feature';
  const implementationTarget = `.project/tickets/${ticketFolder}/impl-plan.md`;
  const executionTarget = `.project/tickets/${ticketFolder}/execution-plan.md`;
  const config = JSON.parse(
    readFileSync(nodePath.join(root, '.safeword', 'config.json'), 'utf8'),
  ) as { designApprovalGate?: unknown };
  const bin = installReviewer();
  const stamps: string[] = [];
  if (from === 'scenario') {
    const reviewId = await admitReview(
      root,
      'scenario-gate',
      featureTarget,
      [`.project/tickets/${ticketFolder}/spec.md`, `.project/tickets/${ticketFolder}/ticket.md`],
      { bin },
    );
    stamps.push(
      `2026-09-18T00:01:01.000Z fixture review:${ticketFolder}:phase@scenario-gate author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
    );
  }
  if (from === 'scenario' || from === 'implementation') {
    const reviewId = await admitReview(
      root,
      'plan-implementation',
      implementationTarget,
      [featureTarget, `.project/tickets/${ticketFolder}/spec.md`],
      { bin },
    );
    stamps.push(
      `2026-09-18T00:01:02.000Z fixture review:${ticketFolder}:phase@plan-implementation author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
    );
  }
  const plan = readFileSync(nodePath.join(root, executionTarget), 'utf8');
  const reviewId = await admitReview(
    root,
    'plan-execution',
    executionTarget,
    [implementationTarget, featureTarget],
    {
      bin,
      executionPlanRecord: executionReviewRecord(plan, config.designApprovalGate === true),
    },
  );
  stamps.push(
    `2026-09-18T00:01:03.000Z fixture review:${ticketFolder}:phase@plan-execution author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
  );
  const ledgerPath = nodePath.join(root, '.project', 'skill-invocations.log');
  writeFileSync(ledgerPath, `${readFileSync(ledgerPath, 'utf8')}${stamps.join('\n')}\n`);
}

async function featureFixture(
  includeExecutionPlan = false,
  designApprovalGate = false,
): Promise<string> {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-coding-authorization-'));
  fixtureRoots.push(root);
  const ticketFolder = 'ABC123-feature';
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', ticketFolder);
  const featureTarget = 'features/feature.feature';
  const implementationTarget = `.project/tickets/${ticketFolder}/impl-plan.md`;
  const executionTarget = `.project/tickets/${ticketFolder}/execution-plan.md`;
  mkdirSync(ticketDirectory, { recursive: true });
  mkdirSync(nodePath.join(root, 'features'), { recursive: true });
  mkdirSync(nodePath.join(root, '.claude', 'plans'), { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      'type: feature',
      'phase: implement',
      'scope:',
      '  - Authorize coding from current plans.',
      'out_of_scope:',
      '  - Grant downstream authority.',
      'done_when:',
      '  - Coding authorization is inspectable.',
      '---',
      '',
    ].join('\n'),
  );
  writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Product Plan\n');
  writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), '# Implementation Plan\n');
  writeFileSync(nodePath.join(root, featureTarget), 'Feature: Accepted behavior\n');
  if (includeExecutionPlan) writeFileSync(nodePath.join(root, executionTarget), executionPlan());
  writeFileSync(
    nodePath.join(root, '.claude', 'plans', 'execution.md'),
    '# Host-local execution notes\n',
  );
  writeFileSync(
    nodePath.join(root, '.safeword', 'config.json'),
    `${JSON.stringify({
      crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'opus' }] },
      ...(designApprovalGate && { designApprovalGate: true }),
    })}\n`,
  );
  writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), '');

  const bin = installReviewer();
  const scenarioReviewId = await admitReview(
    root,
    'scenario-gate',
    featureTarget,
    [`.project/tickets/${ticketFolder}/spec.md`, `.project/tickets/${ticketFolder}/ticket.md`],
    { bin },
  );
  const implementationReviewId = await admitReview(
    root,
    'plan-implementation',
    implementationTarget,
    [featureTarget, `.project/tickets/${ticketFolder}/spec.md`],
    { bin },
  );
  const reviewStamps = [
    `2026-09-18T00:00:02.000Z fixture review:${ticketFolder}:phase@scenario-gate author:codex reviewer:claude independence:cross-agent review-id:${scenarioReviewId}`,
    `2026-09-18T00:00:03.000Z fixture review:${ticketFolder}:phase@plan-implementation author:codex reviewer:claude independence:cross-agent review-id:${implementationReviewId}`,
  ];
  if (includeExecutionPlan) {
    const plan = executionPlan();
    const executionReviewId = await admitReview(
      root,
      'plan-execution',
      executionTarget,
      [implementationTarget, featureTarget],
      { bin, executionPlanRecord: executionReviewRecord(plan, designApprovalGate) },
    );
    reviewStamps.push(
      `2026-09-18T00:00:04.000Z fixture review:${ticketFolder}:phase@plan-execution author:codex reviewer:claude independence:cross-agent review-id:${executionReviewId}`,
    );
  }
  writeFileSync(
    nodePath.join(root, '.project', 'skill-invocations.log'),
    [...reviewStamps, ''].join('\n'),
  );
  return root;
}

async function codingAuthorization(root: string): Promise<{
  exitCode: number;
  data: Record<string, unknown>;
}> {
  const invoked = await runCli(
    ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
    {
      cwd: root,
      env: {
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
      },
    },
  );
  const result = JSON.parse(invoked.stdout) as { data: Record<string, unknown> };
  return { exitCode: invoked.exitCode, data: result.data };
}

function authorizationIdentity(result: { data: Record<string, unknown> }): string {
  expect(
    result.data.authorization_input_identity,
    'authorization_input_identity must describe the complete evaluated input',
  ).toEqual(expect.any(String));
  return result.data.authorization_input_identity as string;
}

describe('coding authorization', () => {
  beforeAll(assertTestCliFresh);

  afterEach(() => {
    cleanupTrustedReviewerDirectories();
    for (const root of fixtureRoots.splice(0)) removeTemporaryDirectory(root);
  });

  it('rejects host-local notes when the project-local Execution Plan is missing', async () => {
    const root = await featureFixture();

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(
      invoked.exitCode,
      'coding authorization should return the typed missing project-local Execution Plan denial',
    ).toBe(2);
    expect(() => JSON.parse(invoked.stdout)).not.toThrow();
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string }[];
      next_actions: { command: string }[];
      data: { command: string; coding_authorization: string; grants_authority: boolean };
    };
    expect(result).toMatchObject({
      state: 'action_required',
      data: {
        command: 'ticket coding-authorization',
        coding_authorization: 'denied',
        grants_authority: false,
      },
    });
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword review run plan-execution --context .project/tickets/ABC123-feature/impl-plan.md --context features/feature.feature -- .project/tickets/ABC123-feature/execution-plan.md',
    ]);
    expect(readFileSync(nodePath.join(root, '.claude', 'plans', 'execution.md'), 'utf8')).toBe(
      '# Host-local execution notes\n',
    );
  });

  it('authorizes coding from current project-local reviewed plans', async () => {
    const root = await featureFixture(true);

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(
      invoked.exitCode,
      'coding authorization should authorize current project-local reviewed plans',
    ).toBe(0);
    const result = JSON.parse(invoked.stdout) as Record<string, unknown>;
    expect(result).toMatchObject({
      state: 'healthy',
      findings: [],
      next_actions: [],
      data: {
        command: 'ticket coding-authorization',
        coding_authorization: 'authorized',
        grants_authority: false,
      },
    });
  });

  it('limits an approved result to coding authorization without downstream authority', async () => {
    const root = await featureFixture(true);

    const result = await codingAuthorization(root);

    expect(result.exitCode).toBe(0);
    expect(result.data).toMatchObject({
      coding_authorization: 'authorized',
      achieved_independence: 'cross-agent',
      grants_authority: false,
    });
    for (const downstreamClaim of [
      'implementation_complete',
      'verification_passed',
      'release_approved',
      'merge_authorized',
    ]) {
      expect(
        result.data,
        `${downstreamClaim} must not be implied by coding authorization`,
      ).not.toHaveProperty(downstreamClaim);
    }
  });

  it('rejects attempts to turn coding authorization into downstream authority', async () => {
    const root = await featureFixture(true);

    for (const downstreamClaim of [
      'implementation_complete',
      'verification_passed',
      'release_approved',
      'merge_authorized',
    ]) {
      const invoked = await runCli(
        ['ticket', 'coding-authorization', 'ABC123', downstreamClaim, '--json', '--cwd', root],
        {
          cwd: root,
          env: {
            NODE_ENV: 'test',
            SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
          },
        },
      );

      expect(
        invoked.exitCode,
        `${downstreamClaim} must be rejected as unsupported downstream authority`,
      ).toBe(1);
      expect(JSON.parse(invoked.stdout)).toMatchObject({
        state: 'failed',
        errors: [{ code: 'CLI_ARGUMENT_INVALID' }],
      });
    }
  });

  it(
    'identifies every stable authorization input but ignores checklist progress',
    async () => {
      const mutations: {
        name: string;
        authorization: 'authorized' | 'denied';
        refreshFrom?: 'scenario' | 'implementation' | 'execution';
        apply(root: string): void;
      }[] = [
        {
          name: 'configuration',
          authorization: 'authorized',
          apply(root) {
            writeFileSync(
              nodePath.join(root, '.safeword', 'config.json'),
              '{"crossAgentReviewRoutes":{"codex":[{"reviewer":"claude","model":"sonnet"}]}}\n',
            );
          },
        },
        {
          name: 'ticket scope',
          authorization: 'denied',
          refreshFrom: 'scenario',
          apply(root) {
            const path = nodePath.join(root, '.project', 'tickets', 'ABC123-feature', 'ticket.md');
            writeFileSync(
              path,
              readFileSync(path, 'utf8').replace(
                'Authorize coding from current plans.',
                'Authorize coding from current reviewed plans.',
              ),
            );
          },
        },
        {
          name: 'product plan',
          authorization: 'denied',
          refreshFrom: 'scenario',
          apply(root) {
            writeFileSync(
              nodePath.join(root, '.project', 'tickets', 'ABC123-feature', 'spec.md'),
              '# Product Plan\n\nChanged accepted behavior.\n',
            );
          },
        },
        {
          name: 'accepted scenarios',
          authorization: 'denied',
          refreshFrom: 'scenario',
          apply(root) {
            writeFileSync(
              nodePath.join(root, 'features', 'feature.feature'),
              'Feature: Changed accepted behavior\n',
            );
          },
        },
        {
          name: 'implementation plan',
          authorization: 'denied',
          refreshFrom: 'implementation',
          apply(root) {
            writeFileSync(
              nodePath.join(root, '.project', 'tickets', 'ABC123-feature', 'impl-plan.md'),
              '# Implementation Plan\n\nChanged accepted approach.\n',
            );
          },
        },
        {
          name: 'execution plan definition',
          authorization: 'denied',
          refreshFrom: 'execution',
          apply(root) {
            const path = nodePath.join(
              root,
              '.project',
              'tickets',
              'ABC123-feature',
              'execution-plan.md',
            );
            writeFileSync(
              path,
              readFileSync(path, 'utf8').replace('Deliver testing.', 'Prove testing.'),
            );
          },
        },
        {
          name: 'validated review provenance',
          authorization: 'authorized',
          apply(root) {
            mutateExecutionReview(root, data => ({
              ...data,
              author_agent: 'codex',
              actual_reviewer: 'codex',
              independence: 'degraded',
              reviewer_output: {
                ...(data.reviewer_output as Record<string, unknown>),
                reviewer_agent: 'codex',
              },
            }));
            rewriteExecutionReviewStamp(root, line =>
              line.replace(
                'author:codex reviewer:claude independence:cross-agent',
                'author:codex reviewer:codex independence:degraded',
              ),
            );
          },
        },
      ];

      for (const mutation of mutations) {
        const root = await featureFixture(true);
        const before = await codingAuthorization(root);
        expect(before.data.coding_authorization).toBe('authorized');
        const beforeIdentity = authorizationIdentity(before);
        mutation.apply(root);
        const after = await codingAuthorization(root);
        expect(after.data.coding_authorization, mutation.name).toBe(mutation.authorization);
        if (mutation.refreshFrom === undefined) {
          expect(authorizationIdentity(after), mutation.name).not.toBe(beforeIdentity);
        } else {
          await refreshReviews(root, mutation.refreshFrom);
          const repaired = await codingAuthorization(root);
          expect(repaired.data.coding_authorization, mutation.name).toBe('authorized');
          expect(authorizationIdentity(repaired), mutation.name).not.toBe(beforeIdentity);
        }
      }

      const rereviewRoot = await featureFixture(true);
      const beforeRereview = await codingAuthorization(rereviewRoot);
      await refreshReviews(rereviewRoot, 'scenario');
      const afterRereview = await codingAuthorization(rereviewRoot);
      expect(afterRereview.data.coding_authorization).toBe('authorized');
      expect(authorizationIdentity(afterRereview)).toBe(authorizationIdentity(beforeRereview));

      const approvalRoot = await featureFixture(true, true);
      const beforeApproval = await codingAuthorization(approvalRoot);
      expect(beforeApproval.data.coding_authorization).toBe('denied');
      const approvalIdentity = authorizationIdentity(beforeApproval);
      const implementationPath = nodePath.join(
        approvalRoot,
        '.project',
        'tickets',
        'ABC123-feature',
        'impl-plan.md',
      );
      const approval = appendDesignDecision(
        nodePath.join(approvalRoot, '.project', 'skill-invocations.log'),
        {
          authorityRef: 'test-human',
          decision: 'approved',
          planDigest: createHash('sha256').update(readFileSync(implementationPath)).digest('hex'),
          ticket: 'ABC123',
        },
      );
      expect(approval.status).not.toBe('pending');
      const afterApproval = await codingAuthorization(approvalRoot);
      expect(afterApproval.data.coding_authorization).toBe('authorized');
      expect(authorizationIdentity(afterApproval)).not.toBe(approvalIdentity);

      const progressRoot = await featureFixture(true);
      const beforeProgress = await codingAuthorization(progressRoot);
      expect(beforeProgress.data.coding_authorization).toBe('authorized');
      const executionPath = nodePath.join(
        progressRoot,
        '.project',
        'tickets',
        'ABC123-feature',
        'execution-plan.md',
      );
      writeFileSync(
        executionPath,
        readFileSync(executionPath, 'utf8').replace(
          '| item-1 | outcome and scope | Deliver outcome and scope. | contributor | proof | open | missing |  |  |',
          '| item-1 | outcome and scope | Deliver outcome and scope. | contributor | proof | complete | current_revision_real_boundary | HEAD | receipt:proof |',
        ),
      );
      const afterProgress = await codingAuthorization(progressRoot);
      expect(afterProgress.data.coding_authorization).toBe('authorized');
      expect(authorizationIdentity(afterProgress)).toBe(authorizationIdentity(beforeProgress));
    },
    TIMEOUT_ACCEPTANCE_LANE,
  );

  it('rejects stale project-local plans despite approving host-local notes', async () => {
    const root = await featureFixture(true);
    const executionPlanPath = nodePath.join(
      root,
      '.project',
      'tickets',
      'ABC123-feature',
      'execution-plan.md',
    );
    writeFileSync(
      executionPlanPath,
      `${readFileSync(executionPlanPath, 'utf8')}\nChanged after review.\n`,
    );
    writeFileSync(
      nodePath.join(root, '.claude', 'plans', 'execution.md'),
      '# Host-local execution notes\n\nApproved for implementation.\n',
    );

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(
      invoked.exitCode,
      'coding authorization should reject a stale project-local plan despite approving host notes',
    ).toBe(2);
    const result = JSON.parse(invoked.stdout) as {
      state: string;
      findings: { code: string }[];
      next_actions: { command: string }[];
      data: { coding_authorization: string; grants_authority: boolean };
    };
    expect(result).toMatchObject({
      state: 'action_required',
      data: { coding_authorization: 'denied', grants_authority: false },
    });
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_admitted_delivery_checklist',
    ]);
    expect(result.next_actions.map(action => action.command)).toEqual([
      'safeword review run plan-execution --context .project/tickets/ABC123-feature/impl-plan.md --context features/feature.feature -- .project/tickets/ABC123-feature/execution-plan.md',
    ]);
  });

  it('rejects a semantic receipt with no verdict', async () => {
    const root = await featureFixture(true);
    mutateExecutionReview(root, data => {
      const reviewerOutput = { ...(data.reviewer_output as Record<string, unknown>) };
      delete reviewerOutput.verdict;
      return { ...data, reviewer_output: reviewerOutput };
    });

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(invoked.exitCode, invoked.stdout).toBe(2);
    const result = JSON.parse(invoked.stdout) as {
      findings: { code: string }[];
      data: { coding_authorization: string };
    };
    expect(result.data.coding_authorization).toBe('denied');
    expect(result.findings.map(finding => finding.code)).toEqual([
      'missing_execution_plan_verdict',
    ]);
  });

  it('reports a semantic receipt that rejected the Execution Plan', async () => {
    const root = await featureFixture(true);
    mutateExecutionReview(root, data => ({
      ...data,
      reviewer_output: {
        ...(data.reviewer_output as Record<string, unknown>),
        verdict: 'request_changes',
        findings: [{ severity: 'error', message: 'Execution plan is not startable.' }],
      },
    }));

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(invoked.exitCode, invoked.stdout).toBe(2);
    const result = JSON.parse(invoked.stdout) as {
      findings: { code: string; message: string }[];
      data: { coding_authorization: string };
    };
    expect(result.data.coding_authorization).toBe('denied');
    expect(result.findings).toEqual([
      {
        code: 'rejected_execution_plan_review',
        message: 'Execution plan is not startable.',
        severity: 'warning',
      },
    ]);
  });

  it('authorizes a permitted fallback without calling it independent', async () => {
    const root = await featureFixture(true);
    mutateExecutionReview(root, data => ({
      ...data,
      author_agent: 'codex',
      actual_reviewer: 'codex',
      independence: 'degraded',
      reviewer_output: {
        ...(data.reviewer_output as Record<string, unknown>),
        reviewer_agent: 'codex',
      },
    }));
    rewriteExecutionReviewStamp(root, line =>
      line.replace(
        'author:codex reviewer:claude independence:cross-agent',
        'author:codex reviewer:codex independence:degraded',
      ),
    );

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
      {
        cwd: root,
        env: {
          NODE_ENV: 'test',
          SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        },
      },
    );

    expect(invoked.exitCode, invoked.stdout).toBe(0);
    const result = JSON.parse(invoked.stdout) as {
      data: { coding_authorization: string; achieved_independence?: string };
    };
    expect(result.data).toMatchObject({
      coding_authorization: 'authorized',
      achieved_independence: 'degraded',
    });
  });

  it('rejects a receipt with no validated achieved independence', async () => {
    const root = await featureFixture(true);
    mutateExecutionReview(root, data => {
      const changed = { ...data };
      delete changed.independence;
      return changed;
    });

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
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
      data: { coding_authorization: string };
    };
    expect({
      exitCode: invoked.exitCode,
      codingAuthorization: result.data.coding_authorization,
      findingCodes: result.findings.map(finding => finding.code),
    }).toEqual({
      exitCode: 2,
      codingAuthorization: 'denied',
      findingCodes: ['unearned_execution_plan_assurance'],
    });
  });

  it('ignores an author-written independence claim without validated assurance', async () => {
    const root = await featureFixture(true);
    mutateExecutionReview(root, data => {
      const reviewerOutput = {
        ...(data.reviewer_output as Record<string, unknown>),
        independence: 'cross-agent',
      };
      const changed: Record<string, unknown> = { ...data, reviewer_output: reviewerOutput };
      delete changed.independence;
      return changed;
    });

    const invoked = await runCli(
      ['ticket', 'coding-authorization', 'ABC123', '--json', '--cwd', root],
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
      data: { coding_authorization: string };
    };
    expect({
      exitCode: invoked.exitCode,
      codingAuthorization: result.data.coding_authorization,
      findingCodes: result.findings.map(finding => finding.code),
    }).toEqual({
      exitCode: 2,
      codingAuthorization: 'denied',
      findingCodes: ['unearned_execution_plan_assurance'],
    });
  });
});
