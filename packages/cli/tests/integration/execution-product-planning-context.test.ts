import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
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

async function review(includeProduct = true, explicit = false) {
  const project = createTemporaryDirectory();
  projects.push(project);
  await createConfiguredProject(project);
  writePlanningInventories(project);
  mkdirSync(nodePath.join(project, folder), { recursive: true });
  writeFileSync(nodePath.join(project, ticketPath), metadata);
  if (includeProduct) writeFileSync(nodePath.join(project, specPath), product);
  writeFileSync(nodePath.join(project, target), executionPlan);
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
  console.log(JSON.stringify({ structured_output: { schema_version: 1, dispatch_id: packet.dispatch_id,
    reviewer_agent: 'claude', verdict: 'approve', summary: 'Fixture approves the supplied packet.', findings: [], evidence_records: { schema_version: 1, records: [] }, planning_destination: 'plan-execution',
    execution_plan_record: { slicing_decision: 'one_pull_request', rationale: 'One coherent change.',
      slices: [{ name: 'Complete delivery', purpose: 'Deliver the reviewed plan.', boundary: 'The accepted CLI boundary.', prerequisites: [], proof: 'The installed CLI review passes.', completion_signal: 'The review is approved.', relies_on_unmerged_successor: false }],
      obligation_owners: [{ obligation: 'Accepted behavior', slices: ['Complete delivery'] }],
      decision_statuses: [{ decision: 'Keep the accepted approach.', status: 'unchanged' }],
      accepted_scenarios_covered: true, accepted_approach_preserved: true,
      normalized_plan_digest: packet.execution_plan_normalized_digest, delivery_definition: packet.execution_plan_delivery_definition }  } }));
});
`,
    { mode: 0o755 },
  );
  const context = [
    '--context',
    implementationPath,
    scenarioPath,
    ...(explicit ? [ticketPath, specPath] : []),
  ];
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
  return { capture, result };
}

function capturedPacket(capture: string) {
  expect(existsSync(capture)).toBe(true);
  return JSON.parse(readFileSync(capture, 'utf8'));
}

describe('owned Execution review resolves Product context', () => {
  it('preserves explicitly supplied ticket and Product Plan as a control', async () => {
    const { result, capture } = await review(true, true);
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(capturedPacket(capture).context_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ticketPath, content: metadata }),
        expect.objectContaining({ path: specPath, content: product }),
      ]),
    );
  });
  it('automatically supplies its accepted ticket and Product Plan', async () => {
    const { result, capture } = await review();
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(
      capturedPacket(capture).context_files,
      'owned Execution review must resolve Product context',
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ticketPath, content: metadata }),
        expect.objectContaining({ path: specPath, content: product }),
      ]),
    );
  });
  it('refuses a missing required Product Plan before reviewer execution', async () => {
    const { result, capture } = await review(false);
    expect(result.exitCode, 'owned Execution review must resolve Product context').not.toBe(0);
    expect(JSON.parse(result.stdout).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_planning_context',
          metadata: { context_role: 'project', context_path: specPath },
        }),
      ]),
    );
    expect(
      existsSync(capture),
      'missing Product context must refuse before reviewer execution',
    ).toBe(false);
  });
});
