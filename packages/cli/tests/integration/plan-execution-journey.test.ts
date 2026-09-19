import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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
import { assertTestCliFresh, expectHookAllow, expectHookDeny, runCli } from '../helpers.js';
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
const CONCRETE_PROOF_CONTRACT_SIGNAL =
  'A test step must name its fixture, command, edit action, expected exit or assertion, and real actor boundary.';
const RED_COMMAND = ['node', 'tests/denied-request.cjs'] as const;
const PACKAGED_CLI = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const WRITE_REVIEW_STAMP = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/write-review-stamp.ts',
);
const SESSION_ID = 'startable-plan-journey';

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

function executionPlanWithUnstartableFourthStep(): string {
  return executionPlan().replace('3. REFACTOR: keep the authorization boundary in one owner.', () =>
    [
      '3. REFACTOR: keep the authorization boundary in one owner.',
      '4. TODO: decide whether denied authorization returns an error or an empty result before implementation.',
    ].join('\n'),
  );
}

function executionPlanWithProofStep(step: string): string {
  return executionPlan().replace(
    `1. RED: run \`${RED_COMMAND.join(' ')}\` and observe exit 1 before editing \`src/auth.ts\`.`,
    () => `1. RED: ${step}`,
  );
}

const CONCRETE_PROOF_CASES = [
  {
    name: 'exact CLI denial proof',
    step: 'using fixture `tests/fixtures/edited-plan` from prerequisite step 1, run `bun run test tests/cli-protocol/phase-gates.test.ts -t edited-plan` after the plan edit through the installed CLI subprocess and assert exit code 2 before editing production code.',
    exitCode: 0,
  },
  {
    name: 'missing CLI subprocess boundary',
    step: 'using fixture `tests/fixtures/edited-plan` from prerequisite step 1, run `bun run test tests/cli-protocol/phase-gates.test.ts -t edited-plan` after the plan edit through the TBD CLI boundary and assert exit code 2 before editing production code.',
    exitCode: 2,
    finding: 'subprocess boundary',
  },
  {
    name: 'missing denied-exit assertion',
    step: 'using fixture `tests/fixtures/edited-plan` from prerequisite step 1, run `bun run test tests/cli-protocol/phase-gates.test.ts -t edited-plan` after the plan edit through the installed CLI subprocess and assert the TBD denied-exit result before editing production code.',
    exitCode: 2,
    finding: 'exit-code assertion',
  },
] as const;

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
if ! printf '%s' "$payload" | /usr/bin/grep -Fq '"kind":"plan-execution"'; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"approved","findings":[]}\n' "$dispatch_id"
  exit 0
fi
if printf '%s' "$payload" | /usr/bin/grep -Fq '${CONCRETE_PROOF_CONTRACT_SIGNAL}'; then
  if printf '%s' "$payload" | /usr/bin/grep -Fq 'TBD CLI boundary'; then
    printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"missing subprocess boundary","findings":[{"severity":"error","message":"The test step must name the installed CLI subprocess boundary."}],"planning_destination":"plan-execution","execution_plan_record":null}\n' "$dispatch_id"
    exit 0
  fi
  if printf '%s' "$payload" | /usr/bin/grep -Fq 'TBD denied-exit result'; then
    printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"missing exit-code assertion","findings":[{"severity":"error","message":"The test step must name the denied exit-code assertion."}],"planning_destination":"plan-execution","execution_plan_record":null}\n' "$dispatch_id"
    exit 0
  fi
fi
if printf '%s' "$payload" | /usr/bin/grep -Fq '4. TODO: decide whether denied authorization returns an error or an empty result'; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"task 4 requires a behavior decision","findings":[{"severity":"error","message":"Task 4 requires a behavior decision before implementation."}],"planning_destination":"plan-implementation","execution_plan_record":null}\n' "$dispatch_id"
  exit 0
fi
if ! printf '%s' "$payload" | /usr/bin/grep -Fq '${REVIEW_CONTRACT_SIGNAL}'; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"the first step is not startable","findings":[{"severity":"error","message":"Execution Planning does not require a named first RED."}],"planning_destination":"plan-execution","execution_plan_record":null}\n' "$dispatch_id"
  exit 0
fi
review_record=$(printenv SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD || true)
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"the named RED is startable","findings":[],"planning_destination":"plan-execution","execution_plan_record":%s}\n' "$dispatch_id" "$review_record"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function runPreTool(
  root: string,
  input: Record<string, unknown>,
  reviewKeyRoot: string,
  receiptPluginRoot: string,
) {
  return spawnSync(
    process.execPath,
    [PACKAGED_CLI, 'hook', 'codex', 'pre-tool-use', '--plugin-hook'],
    {
      cwd: root,
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: SESSION_ID,
        ...input,
      }),
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: receiptPluginRoot,
        CLAUDE_PROJECT_DIR: root,
        NODE_ENV: 'test',
        SAFEWORD_REVIEW_KEY_ROOT: reviewKeyRoot,
      },
    },
  );
}

describe('Execution Plan cold-start journey', () => {
  beforeAll(assertTestCliFresh);

  afterEach(() => {
    cleanupTrustedReviewerDirectories();
  });

  it('rejects an unstartable fourth step through the installed CLI, then reaches the named RED', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-plan-journey-'));
    try {
      const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'START1-feature');
      const plan = executionPlan();
      mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
      mkdirSync(ticketDirectory, { recursive: true });
      mkdirSync(nodePath.join(root, 'features'), { recursive: true });
      mkdirSync(nodePath.join(root, 'tests'), { recursive: true });
      mkdirSync(nodePath.join(root, 'src'), { recursive: true });
      writeFileSync(
        nodePath.join(root, '.safeword', 'config.json'),
        `${JSON.stringify({ designApprovalGate: false, crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'opus' }] } })}\n`,
      );
      writeFileSync(nodePath.join(root, '.safeword', 'SAFEWORD.md'), '# Safeword\n');
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        [
          '---',
          'id: START1',
          'type: feature',
          'phase: plan-execution',
          'status: in_progress',
          'scope:',
          '  - Reject a denied request.',
          'out_of_scope:',
          '  - Grant downstream release authority.',
          'done_when:',
          '  - The named RED runs before production changes.',
          '---',
          '',
        ].join('\n'),
      );
      writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Product Plan\n');
      writeFileSync(
        nodePath.join(ticketDirectory, 'impl-plan.md'),
        [
          '# Implementation Plan',
          '',
          '**Status:** planned',
          '',
          '## Approach',
          '',
          'The authorization denial is the riskiest boundary and the named integration RED proves it first.',
          '',
          '## Decisions',
          '',
          '### Recorded Decisions',
          '',
          '| Decision | Choice | Alternatives considered | Rejected because |',
          '| --- | --- | --- | --- |',
          '| Authorization owner | One shared authorization service owns permission checks for every transport. | Per-transport checks | They can drift. |',
          '| Delivery order | Host-neutral dependency order keeps every intermediate merge supported. | Activate before prerequisites | It creates an unsafe merge. |',
          '',
          '## Design alignment',
          '',
          'Architecture applicability: one shared authorization boundary.',
          'skip: no applicable project principles or ADRs',
          '',
          '## Known deviations',
          '',
          'skip: no deviations planned',
          '',
          '## Doc impact',
          '',
          'skip: the fixture has no customer-visible documentation surface',
          '',
          '## Assessment triggers',
          '',
          'Revisit when a second authorization owner is required.',
          '',
        ].join('\n'),
      );
      writeFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), plan);
      writeFileSync(
        nodePath.join(ticketDirectory, 'test-definitions.md'),
        [
          'Feature source: `features/feature.feature`',
          '',
          '### Scenario: denied request',
          '',
          `- Named RED: \`${RED_COMMAND.join(' ')}\` must exit 1 before production changes.`,
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
      writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), '');
      writeFileSync(
        nodePath.join(root, '.project', `quality-state-codex-${SESSION_ID}.json`),
        JSON.stringify({ activeTicket: 'START1' }),
      );
      expect(spawnSync('git', ['init'], { cwd: root }).status).toBe(0);
      expect(spawnSync('git', ['add', '.'], { cwd: root }).status).toBe(0);
      expect(
        spawnSync(
          'git',
          [
            '-c',
            'commit.gpgsign=false',
            '-c',
            'user.name=Safeword Test',
            '-c',
            'user.email=test@safeword.local',
            'commit',
            '-m',
            'fixture',
          ],
          { cwd: root },
        ).status,
      ).toBe(0);
      const fixtureRevision = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).stdout.trim();
      const reviewerBin = installContractCheckingReviewer();
      const receiptPluginRoot = createTrustedReviewerDirectory('safeword-receipt-cli-');
      cpSync(nodePath.dirname(PACKAGED_CLI), nodePath.join(receiptPluginRoot, 'runtime'), {
        recursive: true,
      });
      cpSync(
        nodePath.resolve(nodePath.dirname(PACKAGED_CLI), '../package.json'),
        nodePath.join(receiptPluginRoot, 'package.json'),
      );
      cpSync(
        nodePath.resolve(nodePath.dirname(PACKAGED_CLI), '../templates'),
        nodePath.join(receiptPluginRoot, 'templates'),
        { recursive: true },
      );
      const reviewKeyRoot = nodePath.join(root, '.review-keys');

      const unstartablePlan = executionPlanWithUnstartableFourthStep();
      writeFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), unstartablePlan);
      const rejectedPlan = await runCli(
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
            SAFEWORD_REVIEW_KEY_ROOT: reviewKeyRoot,
            SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: JSON.stringify(
              executionPlanRecord(unstartablePlan),
            ),
          },
        },
      );
      expect(rejectedPlan.exitCode, `${rejectedPlan.stdout}\n${rejectedPlan.stderr}`).toBe(2);
      expect(rejectedPlan.stdout).toContain('task 4');
      expect(rejectedPlan.stdout).toContain('behavior decision');
      expect(rejectedPlan.stdout).toContain('safeword ticket approve-plan START1');
      const appliedDiscovery = await runCli(
        ['--json', '--no-input', 'ticket', 'approve-plan', 'START1'],
        {
          cwd: root,
          env: {
            SAFEWORD_AGENT_RUNTIME: 'codex',
            SAFEWORD_NO_UPDATE_CHECK: '1',
            SAFEWORD_REVIEW_KEY_ROOT: reviewKeyRoot,
          },
        },
      );
      expect(
        appliedDiscovery.exitCode,
        `${appliedDiscovery.stdout}\n${appliedDiscovery.stderr}`,
      ).toBe(2);
      expect(appliedDiscovery.stdout).toContain('returned to Implementation Planning');
      expect(readFileSync(nodePath.join(ticketDirectory, 'ticket.md'), 'utf8')).toContain(
        'phase: plan-implementation',
      );
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        readFileSync(nodePath.join(ticketDirectory, 'ticket.md'), 'utf8').replace(
          'phase: plan-implementation',
          'phase: plan-execution',
        ),
      );
      writeFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), plan);

      const reviews = [
        {
          kind: 'scenario-gate',
          targets: ['features/feature.feature'],
          context: ['.project/tickets/START1-feature/spec.md'],
        },
        {
          kind: 'plan-implementation',
          targets: ['.project/tickets/START1-feature/impl-plan.md'],
          context: ['features/feature.feature', '.project/tickets/START1-feature/spec.md'],
        },
        {
          kind: 'plan-execution',
          targets: ['.project/tickets/START1-feature/execution-plan.md'],
          context: ['.project/tickets/START1-feature/impl-plan.md', 'features/feature.feature'],
        },
      ] as const;
      for (const request of reviews) {
        const reviewed = await runCli(
          [
            '--json',
            '--no-input',
            'review',
            'run',
            request.kind,
            ...request.targets,
            ...request.context.flatMap(context => ['--context', context]),
            '--cwd',
            root,
          ],
          {
            cwd: root,
            env: {
              PATH: `${reviewerBin}:/usr/bin:/bin`,
              SAFEWORD_AGENT_RUNTIME: 'codex',
              SAFEWORD_NO_UPDATE_CHECK: '1',
              SAFEWORD_REVIEW_KEY_ROOT: reviewKeyRoot,
              SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: JSON.stringify(executionPlanRecord(plan)),
            },
          },
        );
        expect(reviewed.exitCode, `${reviewed.stdout}\n${reviewed.stderr}`).toBe(0);
        const result = JSON.parse(reviewed.stdout) as {
          data: { review_id: string; status: string; review_kind: string };
        };
        expect(result.data).toMatchObject({ status: 'approved', review_kind: request.kind });
        const stamped = spawnSync(
          'bun',
          [
            WRITE_REVIEW_STAMP,
            '--ticket',
            'START1-feature',
            '--phase',
            request.kind,
            '--model',
            'opus',
            '--author-agent',
            'codex',
            '--reviewer-agent',
            'claude',
            '--independence',
            'cross-agent',
            '--review-id',
            result.data.review_id,
          ],
          {
            cwd: root,
            encoding: 'utf8',
            env: {
              ...process.env,
              CLAUDE_PLUGIN_ROOT: receiptPluginRoot,
              CLAUDE_PROJECT_DIR: root,
              CODEX_THREAD_ID: SESSION_ID,
              NODE_ENV: 'test',
              SAFEWORD_AGENT_RUNTIME: 'codex',
              SAFEWORD_REVIEW_KEY_ROOT: reviewKeyRoot,
            },
          },
        );
        expect(stamped.status, `${stamped.stdout}\n${stamped.stderr}`).toBe(0);
      }
      const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
      const advance = runPreTool(
        root,
        {
          tool_name: 'Edit',
          tool_input: {
            file_path: ticketPath,
            old_string: 'phase: plan-execution',
            new_string: 'phase: implement',
          },
        },
        reviewKeyRoot,
        receiptPluginRoot,
      );
      expectHookAllow(advance);
      writeFileSync(
        ticketPath,
        readFileSync(ticketPath, 'utf8').replace('phase: plan-execution', 'phase: implement'),
      );

      const productionEdit = runPreTool(
        root,
        {
          tool_name: 'Edit',
          tool_input: {
            file_path: nodePath.join(root, 'src', 'auth.ts'),
            old_string: 'export const policy = "pending";',
            new_string: 'export const policy = "denied";',
          },
        },
        reviewKeyRoot,
        receiptPluginRoot,
      );
      expectHookDeny(productionEdit, RED_COMMAND.join(' '));
      const red = spawnSync(RED_COMMAND[0], RED_COMMAND.slice(1), { cwd: root, encoding: 'utf8' });
      expect(red.status).toBe(1);
      expect(red.stderr).toContain('denied request is not implemented');
      const ledgerPath = nodePath.join(ticketDirectory, 'test-definitions.md');
      const uncheckedRed = `- [ ] RED — ${RED_COMMAND.join(' ')}`;
      const checkedRed = `- [x] RED ${fixtureRevision}`;
      const ledgerEdit = runPreTool(
        root,
        {
          tool_name: 'Edit',
          tool_input: { file_path: ledgerPath, old_string: uncheckedRed, new_string: checkedRed },
        },
        reviewKeyRoot,
        receiptPluginRoot,
      );
      expectHookAllow(ledgerEdit);
      const observedLedger = readFileSync(ledgerPath, 'utf8').replace(
        uncheckedRed,
        () => checkedRed,
      );
      writeFileSync(ledgerPath, observedLedger);
      const productionEditAfterRed = runPreTool(
        root,
        {
          tool_name: 'Edit',
          tool_input: {
            file_path: nodePath.join(root, 'src', 'auth.ts'),
            old_string: 'export const policy = "pending";',
            new_string: 'export const policy = "denied";',
          },
        },
        reviewKeyRoot,
        receiptPluginRoot,
      );
      expectHookAllow(productionEditAfterRed);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reviews concrete proof steps through the installed CLI', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-proof-step-'));
    try {
      const ticketDirectory = nodePath.join(root, '.project', 'tickets', 'START1-feature');
      mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
      mkdirSync(ticketDirectory, { recursive: true });
      mkdirSync(nodePath.join(root, 'features'), { recursive: true });
      mkdirSync(nodePath.join(root, 'tests'), { recursive: true });
      writeFileSync(
        nodePath.join(root, '.safeword', 'config.json'),
        `${JSON.stringify({ designApprovalGate: false, crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'opus' }] } })}\n`,
      );
      writeFileSync(nodePath.join(root, '.safeword', 'SAFEWORD.md'), '# Safeword\n');
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        [
          '---',
          'id: START1',
          'type: feature',
          'phase: plan-execution',
          'status: in_progress',
          'scope:',
          '  - Reject a denied request.',
          'out_of_scope:',
          '  - Grant downstream release authority.',
          'done_when:',
          '  - Concrete proof steps are startable.',
          '---',
          '',
        ].join('\n'),
      );
      writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Product Plan\n');
      writeFileSync(
        nodePath.join(ticketDirectory, 'impl-plan.md'),
        [
          '# Implementation Plan',
          '',
          '**Status:** planned',
          '',
          '## Approach',
          '',
          'Prove edited-plan denial through the installed CLI subprocess.',
          '',
          '## Decisions',
          '',
          '### Recorded Decisions',
          '',
          '| Decision | Choice | Alternatives considered | Rejected because |',
          '| --- | --- | --- | --- |',
          '| Proof boundary | Installed CLI subprocess. | Parser unit test | It cannot prove caller-visible exit behavior. |',
          '',
        ].join('\n'),
      );
      writeFileSync(
        nodePath.join(root, 'features', 'feature.feature'),
        'Feature: Authorization\n\n  Scenario: edited plan denial\n    Then the CLI exits 2\n',
      );
      writeFileSync(nodePath.join(root, 'tests', 'denied-request.cjs'), 'process.exit(1);\n');
      writeFileSync(
        nodePath.join(ticketDirectory, 'execution-plan.md'),
        executionPlanWithProofStep(CONCRETE_PROOF_CASES[0].step),
      );
      expect(spawnSync('git', ['init'], { cwd: root }).status).toBe(0);
      expect(spawnSync('git', ['add', '.'], { cwd: root }).status).toBe(0);
      expect(
        spawnSync(
          'git',
          [
            '-c',
            'commit.gpgsign=false',
            '-c',
            'user.name=Safeword Test',
            '-c',
            'user.email=test@safeword.local',
            'commit',
            '-m',
            'fixture',
          ],
          { cwd: root },
        ).status,
      ).toBe(0);
      const reviewerBin = installContractCheckingReviewer();
      const reviewKeyRoot = nodePath.join(root, '.review-keys');

      for (const proofCase of CONCRETE_PROOF_CASES) {
        const proofPlan = executionPlanWithProofStep(proofCase.step);
        writeFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), proofPlan);
        const proofReview = await runCli(
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
              SAFEWORD_REVIEW_KEY_ROOT: reviewKeyRoot,
              SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: JSON.stringify(
                executionPlanRecord(proofPlan),
              ),
            },
          },
        );
        expect
          .soft(proofReview.exitCode, `${proofCase.name}\n${proofReview.stdout}`)
          .toBe(proofCase.exitCode);
        if ('finding' in proofCase) {
          expect.soft(proofReview.stdout, proofCase.name).toContain(proofCase.finding);
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
