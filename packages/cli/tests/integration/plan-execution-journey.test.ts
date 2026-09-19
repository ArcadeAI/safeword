import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

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
const REVIEW_CONTRACT_SIGNAL = 'Every executable step must name its exact action';
const RED_COMMAND = ['node', 'tests/denied-request.cjs'] as const;

function executionPlan(): string {
  const checklist = CATEGORIES.map(
    (category, index) =>
      `| item-${index + 1} | ${category} | Deliver ${category}. | contributor | journey | open | missing | | |`,
  );
  return [
    '# Execution Plan',
    '',
    '## Pull-request slicing',
    '',
    'Decision: one pull request.',
    'Rationale: One authorization denial is one independently provable behavior.',
    '',
    '### Authorization denial',
    '',
    '- Purpose: Reject a denied request.',
    '- Boundary: Public authorization response.',
    '- Prerequisites: none',
    '- Proof: journey',
    '- Completion signal: The denied request returns the accepted error.',
    '- Relies on an unmerged successor: no',
    '',
    '### Tasks and tests',
    '',
    `1. RED: run \`${RED_COMMAND.join(' ')}\` and observe exit 1 before editing \`src/auth.ts\`.`,
    '2. GREEN: implement the accepted denial in `src/auth.ts`.',
    '3. REFACTOR: keep the authorization boundary in one owner.',
    '',
    '## Obligation ownership',
    '',
    '- Accepted behavior: Authorization denial',
    '- Migration work: Authorization denial',
    '- Rollout work: Authorization denial',
    '- Rollback work: Authorization denial',
    '- Documentation work: Authorization denial',
    '- Affected-surface work: Authorization denial',
    '',
    '## Decision accounting',
    '',
    '- One shared authorization service owns permission checks for every transport: unchanged',
    '- Host-neutral dependency order keeps every intermediate merge supported: unchanged',
    '',
    '## Proof specifications',
    '',
    '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| journey | command | integration | Named authorization RED | real_boundary | current_required | {"type":"command","cwd":".","argv":["node","tests/denied-request.cjs"]} |`,
    '',
    '## Delivery checklist',
    '',
    '<!-- safeword:delivery-checklist:v1 -->',
    '',
    '| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...checklist,
    '',
  ].join('\n');
}

function executionPlanRecord(plan: string): Record<string, unknown> {
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) throw new Error(parsed.message);
  return {
    slicing_decision: 'one_pull_request',
    rationale: 'One authorization denial is one independently provable behavior.',
    slices: [
      {
        name: 'Authorization denial',
        purpose: 'Reject a denied request.',
        boundary: 'Public authorization response.',
        prerequisites: [],
        proof: 'journey',
        completion_signal: 'The denied request returns the accepted error.',
        relies_on_unmerged_successor: false,
      },
    ],
    obligation_owners: [
      {
        obligation: 'Accepted behavior and delivery obligations',
        slices: ['Authorization denial'],
      },
    ],
    decision_statuses: [
      {
        decision: 'One shared authorization service owns permission checks for every transport.',
        status: 'unchanged',
      },
      {
        decision: 'Host-neutral dependency order keeps every intermediate merge supported.',
        status: 'unchanged',
      },
    ],
    accepted_scenarios_covered: true,
    accepted_approach_preserved: true,
    normalized_plan_digest: normalizedExecutionPlanDigest(plan),
    delivery_definition: createExecutionPlanDeliveryDefinition(parsed, false),
  };
}

function installContractCheckingReviewer(): string {
  const directory = createTrustedReviewerDirectory('safeword-execution-journey-');
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
if ! printf '%s' "$payload" | /usr/bin/grep -Fq "$SAFEWORD_REQUIRED_CONTRACT_SIGNAL"; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"the first step is not startable","findings":[{"severity":"error","message":"Execution Planning does not require a named first RED."}],"execution_plan_record":null}\n' "$dispatch_id"
  exit 0
fi
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"the named RED is startable","findings":[],"execution_plan_record":%s}\n' "$dispatch_id" "$SAFEWORD_REVIEW_RECORD"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

describe('Execution Plan cold-start journey', () => {
  beforeAll(assertTestCliFresh);

  afterEach(() => {
    cleanupTrustedReviewerDirectories();
  });

  it('reviews a startable plan and reaches its named RED before production changes', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-plan-journey-'));
    try {
      const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'START1-feature');
      const plan = executionPlan();
      mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
      mkdirSync(ticketDirectory, { recursive: true });
      mkdirSync(nodePath.join(root, 'features'), { recursive: true });
      mkdirSync(nodePath.join(root, 'src'), { recursive: true });
      mkdirSync(nodePath.join(root, 'tests'), { recursive: true });
      writeFileSync(
        nodePath.join(root, '.safeword', 'config.json'),
        `${JSON.stringify({ crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'opus' }] } })}\n`,
      );
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        '---\nid: START1\ntype: feature\nphase: plan-execution\nstatus: in_progress\n---\n',
      );
      writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Product Plan\n');
      writeFileSync(
        nodePath.join(ticketDirectory, 'impl-plan.md'),
        '# Implementation Plan\n\n## Recorded Decisions\n\nUse one shared authorization service.\n',
      );
      writeFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), plan);
      writeFileSync(
        nodePath.join(ticketDirectory, 'test-definitions.md'),
        [
          '### Scenario: denied request',
          '',
          `- [ ] RED — ${RED_COMMAND.join(' ')}`,
          '- [ ] GREEN',
          '- [ ] REFACTOR',
          '',
        ].join('\n'),
      );
      writeFileSync(
        nodePath.join(root, 'features', 'feature.feature'),
        'Feature: Authorization\n\n  Scenario: denied request\n    Then the request is denied\n',
      );
      writeFileSync(nodePath.join(root, 'src', 'auth.ts'), 'export const policy = "pending";\n');
      writeFileSync(
        nodePath.join(root, 'tests', 'denied-request.cjs'),
        'process.stderr.write("denied request is not implemented\\n"); process.exit(1);\n',
      );
      const reviewerBin = installContractCheckingReviewer();
      const implementationBefore = readFileSync(nodePath.join(root, 'src', 'auth.ts'), 'utf8');

      const reviewed = await runCli(
        [
          '--json',
          '--no-input',
          'review',
          'run',
          'plan-execution',
          '.project/tickets/START1-feature/execution-plan.md',
          '--context',
          '.project/tickets/START1-feature/impl-plan.md',
          '--context',
          'features/feature.feature',
          '--cwd',
          root,
        ],
        {
          cwd: root,
          env: {
            PATH: `${reviewerBin}:/usr/bin:/bin`,
            SAFEWORD_AGENT_RUNTIME: 'codex',
            SAFEWORD_NO_UPDATE_CHECK: '1',
            SAFEWORD_REQUIRED_CONTRACT_SIGNAL: REVIEW_CONTRACT_SIGNAL,
            SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
            SAFEWORD_REVIEW_RECORD: JSON.stringify(executionPlanRecord(plan)),
          },
        },
      );

      expect(reviewed.exitCode, `${reviewed.stdout}\n${reviewed.stderr}`).toBe(0);
      expect(JSON.parse(reviewed.stdout)).toMatchObject({
        data: { status: 'approved', review_kind: 'plan-execution' },
      });
      const red = spawnSync(RED_COMMAND[0], RED_COMMAND.slice(1), { cwd: root, encoding: 'utf8' });
      expect(red.status).toBe(1);
      expect(red.stderr).toContain('denied request is not implemented');
      expect(readFileSync(nodePath.join(root, 'src', 'auth.ts'), 'utf8')).toBe(
        implementationBefore,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
