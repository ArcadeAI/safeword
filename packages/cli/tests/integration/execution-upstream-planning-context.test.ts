import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
import { EXECUTION_PLAN_REVIEW_RUBRIC } from '../../src/review/execution-plan-rubric.generated.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';
import { createConfiguredProject, createTemporaryDirectory, runCli } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const projects: string[] = [];
const folder = '.project/tickets/OWN123-owned-product';
const ticketPath = `${folder}/ticket.md`;
const specPath = `${folder}/spec.md`;
const target = `${folder}/execution-plan.md`;
const implementationPath = `${folder}/impl-plan.md`;
const scenarioPath = `${folder}/behavior.feature`;
const delivery = EXECUTION_PLAN_CONFORMANCE_CASES.find(
  candidate => candidate.id === 'one-coherent-change',
);
if (delivery === undefined) throw new Error('Missing canonical Execution Plan fixture');
const executionPlan = delivery.execution_plan;
const implementation =
  '# Impl Plan\n\n**Status:** planned\n\n## Approach\n\nPreserve authenticated approval.\n\n## Architecture applicability\n\nskip: No durable architecture records apply.\n\n## Data applicability\n\nskip: No product data is stored.\n';
const metadata = `---
id: OWN123
type: feature
phase: intake
status: in_progress
product_plan_contract: v1
scope: preserve authenticated approval
out_of_scope: anonymous approval
done_when: current approval advances
phase_anchors:
  - scenario-gate: ${scenarioPath}
---
`;
const product = `# Product Plan: Preserve approval

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Expected outcome:** Builders advance with current approval.
- **Persona outcome inventory:** Builder receives approval or a named refusal.
- **Known facts:** Approval authenticates the current source.
- **Assumptions:** Review latency is acceptable.
- **Unresolved product decisions:** none
- **Success threshold:** Current approval advances.
- **Project non-goals:** No new approval authority.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

> When I request approval, I want current evidence, so I can trust advancement.

#### approval.BU1.R1 — Preserve approval

Only current approval advances.

## Surfaces

Affected:
- Safeword CLI
`;

afterEach(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  projects.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function review(includeImplementation = true, explicit = false) {
  const project = createTemporaryDirectory();
  projects.push(project);
  await createConfiguredProject(project);
  writePlanningInventories(project);
  mkdirSync(nodePath.join(project, folder), { recursive: true });
  writeFileSync(nodePath.join(project, ticketPath), metadata);
  writeFileSync(nodePath.join(project, specPath), product);
  writeFileSync(nodePath.join(project, target), executionPlan);
  if (includeImplementation)
    writeFileSync(nodePath.join(project, implementationPath), implementation);
  writeFileSync(
    nodePath.join(project, scenarioPath),
    'Feature: Trust approval\n  Scenario: Current approval\n    Given an authenticated approval\n    When the Builder requests advancement\n    Then current approval advances\n',
  );
  const reviewer = createTrustedReviewerDirectory('safeword-standalone-context-');
  const capture = nodePath.join(reviewer, 'packet.json');
  writeFileSync(
    nodePath.join(reviewer, 'claude'),
    String.raw`#!${process.execPath}
const { writeFileSync } = require('node:fs');
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').pop());
  writeFileSync(${JSON.stringify(capture)}, JSON.stringify(packet));
  const output = { structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id,
    reviewer_agent: 'claude', verdict: 'approve', summary: 'Fixture approves the supplied packet.', findings: [], planning_destination: 'plan-execution',
    execution_plan_record: { slicing_decision: 'one_pull_request', rationale: 'One coherent change.',
      slices: [{ name: 'Complete delivery', purpose: 'Deliver the reviewed plan.', boundary: 'The accepted CLI boundary.', prerequisites: [], proof: 'The installed CLI review passes.', completion_signal: 'The review is approved.', relies_on_unmerged_successor: false }],
      obligation_owners: [{ obligation: 'Accepted behavior', slices: ['Complete delivery'] }],
      decision_statuses: [{ decision: 'Keep the accepted approach.', status: 'unchanged' }],
      accepted_scenarios_covered: true, accepted_approach_preserved: true,
      normalized_plan_digest: packet.execution_plan_normalized_digest, delivery_definition: packet.execution_plan_delivery_definition }  } };
  if (packet.kind !== 'plan-execution') {
    delete output.structured_output.planning_destination;
    delete output.structured_output.execution_plan_record;
  }
  console.log(JSON.stringify(output));
});
`,
    { mode: 0o755 },
  );
  const context = ['--context', scenarioPath, ...(explicit ? [implementationPath] : [])];
  const result = await runCli(
    [
      'review',
      'run',
      'plan-execution',
      target,
      ...context,
      '--cwd',
      project,
      '--json',
      '--no-input',
    ],
    { cwd: project, env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' } },
  );
  return { capture, result, project, reviewer };
}

function capturedPacket(capture: string) {
  expect(existsSync(capture)).toBe(true);
  return JSON.parse(readFileSync(capture, 'utf8'));
}

describe('owned Execution review resolves accepted upstream plan', () => {
  it.each([
    {
      phase: 'Implementation',
      rubric: PLAN_REVIEW_RUBRIC,
      prefix: 'PLAN',
      implementationStatus: 'stale',
    },
    {
      phase: 'Execution',
      rubric: EXECUTION_PLAN_REVIEW_RUBRIC,
      prefix: 'EXECUTION_PLAN',
      implementationStatus: 'approved',
    },
  ])(
    'stales only dependent approvals after canonical $phase contract bytes change',
    async ({ rubric, prefix, implementationStatus }) => {
      const { result, project, reviewer } = await review();
      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
      const reviewId = JSON.parse(result.stdout).data.review_id;
      const implementationReview = await runCli(
        [
          'review',
          'run',
          'plan-implementation',
          implementationPath,
          '--context',
          specPath,
          '--cwd',
          project,
          '--json',
          '--no-input',
        ],
        {
          cwd: project,
          env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' },
        },
      );
      expect(implementationReview.exitCode, implementationReview.stdout).toBe(0);
      const implementationReviewId = JSON.parse(implementationReview.stdout).data.review_id;
      const distribution = createTemporaryDirectory();
      projects.push(distribution);
      cpSync(nodePath.resolve(import.meta.dirname, '../../../../plugin'), distribution, {
        recursive: true,
      });
      const runtime = nodePath.join(distribution, 'runtime/cli.js');
      const status = (id = reviewId) => {
        const response = spawnSync(
          'bun',
          [runtime, 'review', 'status', id, '--cwd', project, '--json'],
          {
            cwd: project,
            encoding: 'utf8',
            timeout: 30_000,
            env: { ...process.env, CLAUDE_PLUGIN_ROOT: distribution },
          },
        );
        const envelope = JSON.parse(response.stdout);
        expect(envelope.errors, `${response.stdout}\n${response.stderr}`).toEqual([]);
        return envelope.data.status;
      };
      expect(status(), 'the unchanged copied runtime retains the real approval').toBe('approved');
      expect(status(implementationReviewId)).toBe('approved');
      const author = nodePath.join(distribution, 'templates/skills/bdd/PLAN_IMPLEMENTATION.md');
      writeFileSync(
        author,
        `${readFileSync(author, 'utf8')}\n<!-- Unrelated authoring note. -->\n`,
      );
      expect(status(), 'outside-marker authoring notes retain Execution approval').toBe('approved');
      expect(status(implementationReviewId)).toBe('approved');
      const bundle = readFileSync(runtime, 'utf8');
      const start = bundle.indexOf(`var ${prefix}_REVIEW_RUBRIC = \``);
      const end = bundle.indexOf(`${prefix}_REVIEW_RUBRIC_SHA256`, start);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      const before = '- **Purpose:**';
      const after = '- **Purpose:**   ';
      const block = bundle.slice(start, end);
      expect(block).toContain(before);
      const digest = (value: string) => createHash('sha256').update(value).digest('hex');
      const oldHash = digest(rubric);
      const newHash = digest(rubric.replace(before, () => after));
      expect(bundle).toContain(`${prefix}_REVIEW_RUBRIC_SHA256 = "${oldHash}"`);
      writeFileSync(
        runtime,
        (bundle.slice(0, start) + block.replace(before, () => after) + bundle.slice(end)).replace(
          `${prefix}_REVIEW_RUBRIC_SHA256 = "${oldHash}"`,
          () => `${prefix}_REVIEW_RUBRIC_SHA256 = "${newHash}"`,
        ),
      );
      expect(
        status(),
        'Execution approval must depend on the upstream canonical contract bytes',
      ).toBe('stale');
      expect(status(implementationReviewId)).toBe(implementationStatus);
    },
  );
  it('preserves the explicit upstream plan as a passing control', async () => {
    const { result, capture } = await review(true, true);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(capturedPacket(capture).context_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: implementationPath, content: implementation }),
      ]),
    );
  });
  it('automatically supplies the owning Implementation Plan', async () => {
    const { result, capture } = await review();
    expect(result.exitCode, 'owned Execution review must resolve accepted upstream plan').toBe(0);
    expect(capturedPacket(capture).context_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: implementationPath, content: implementation }),
      ]),
    );
  });
  it('names a missing owning upstream plan before reviewer execution', async () => {
    const { result, capture } = await review(false);
    expect(result.exitCode).not.toBe(0);
    expect(
      JSON.parse(result.stdout).findings,
      'owned Execution review must resolve accepted upstream plan',
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_planning_context',
          metadata: { context_role: 'accepted-upstream-plan', context_path: implementationPath },
        }),
      ]),
    );
    expect(existsSync(capture), 'missing upstream plan refuses before reviewer execution').toBe(
      false,
    );
  });
});
