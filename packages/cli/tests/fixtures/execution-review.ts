import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

export type ReviewFixtureCli = (
  args: string[],
  options: { cwd: string; env: Record<string, string> },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

type PlanningReviewKind = 'scenario-gate' | 'plan-implementation' | 'plan-execution';

/** Run the built public CLI in the fixture's own authenticated profile. */
export function installedReviewCli(root: string): ReviewFixtureCli {
  return (args, options) => {
    const result = spawnSync(
      process.execPath,
      [nodePath.resolve(import.meta.dirname, '../../dist/cli.js'), ...args],
      {
        cwd: options.cwd,
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 20 * 1024 * 1024,
        env: {
          ...process.env,
          ...options.env,
          XDG_STATE_HOME: nodePath.join(root, '.review-keys'),
        },
      },
    );
    assert.equal(result.error, undefined, result.error?.message ?? 'CLI subprocess must start');
    return Promise.resolve({
      exitCode: result.status ?? 1,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  };
}

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

export function executionPlan(): string {
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

export function featureFixture(designApprovalGate = false, phase = 'plan-execution'): string {
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

export function installFailingReviewers(): string {
  const bin = createTrustedReviewerDirectory('safeword-failing-reviewers-');
  for (const reviewer of ['claude', 'codex'] as const) {
    writeFileSync(
      nodePath.join(bin, reviewer),
      `#!${process.execPath}\nif (process.argv.includes('--version')) { console.log('${reviewer} 1.0.0'); process.exit(0); }\nif (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES[reviewer])}); process.exit(0); }\nprocess.exit(7);\n`,
      { mode: 0o755 },
    );
  }
  return bin;
}

export function installReviewer(holdPath?: string): string {
  const escapedHoldPath = holdPath?.replaceAll("'", String.raw`'\''`);
  const holdArgument = escapedHoldPath === undefined ? "''" : `'${escapedHoldPath}'`;
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
hold=${holdArgument}
if [ -n "$hold" ]; then
  /usr/bin/mkfifo "$hold"
  /bin/cat "$hold" >/dev/null
fi
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

function pullRequestSlices(slicingDecision: 'one_pull_request' | 'multiple_pull_requests') {
  return slicingDecision === 'one_pull_request'
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
}

export async function admitThroughInstalledCli(
  runCli: ReviewFixtureCli,
  root: string,
  admitted: readonly PlanningReviewKind[] = [
    'scenario-gate',
    'plan-implementation',
    'plan-execution',
  ],
  options: {
    designApprovalGate?: boolean;
    slicingDecision?: 'one_pull_request' | 'multiple_pull_requests';
    ticketFolder?: string;
  } = {},
): Promise<string> {
  const {
    designApprovalGate = false,
    slicingDecision = 'one_pull_request',
    ticketFolder = 'ABC123-feature',
  } = options;
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', ticketFolder);
  const plan = readFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), 'utf8');
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) throw new Error(parsed.message);
  const slices = pullRequestSlices(slicingDecision);
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
    assert.equal(reviewed.exitCode, 0, reviewed.stdout);
    const id = (JSON.parse(reviewed.stdout) as { data: { review_id: string } }).data.review_id;
    assert.equal(typeof id, 'string');
    stamps.push(
      `2026-09-13T00:00:00.000Z fixture review:${ticketFolder}:phase@${reviewKind} author:codex reviewer:claude independence:reduced review-id:${id}`,
    );
  }
  writeFileSync(nodePath.join(root, '.project', 'skill-invocations.log'), `${stamps.join('\n')}\n`);
  return bin;
}
