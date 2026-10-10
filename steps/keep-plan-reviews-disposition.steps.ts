import { strict as assert } from 'node:assert';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Status, Then, When } from '@cucumber/cucumber';

import { prepareReviewPacket } from '../packages/cli/src/review/packet.js';
import { planningContractCases } from '../packages/cli/tests/fixtures/planning-contracts-eval.js';
import {
  createReviewedDispositionProject,
  target,
} from '../packages/cli/tests/fixtures/planning-disposition.js';
import {
  assertPlanningEval,
  runPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

const suggestion = 'Consider adding optional multi-region failover.';
const planTarget = target.replace('spec.md', 'impl-plan.md');
interface DispositionState {
  project: Awaited<ReturnType<typeof createReviewedDispositionProject>>;
  plan: string;
  reviewId: string;
}
const states = new WeakMap<SafewordWorld, DispositionState>();
const roots = new WeakMap<SafewordWorld, string[]>();

export async function prepareRecordedSuggestion(world: SafewordWorld): Promise<void> {
  const owned: string[] = [];
  roots.set(world, owned);
  const project = await createReviewedDispositionProject(owned, suggestion);
  const complete = planningContractCases.find(item => item.id === 'r12-complete-scope-context');
  assert.ok(complete);
  writeFileSync(
    project.ticketPath,
    `---
id: DIS123
type: feature
phase: plan-implementation
status: in_progress
product_plan_contract: v1
scope:
- require explicit user authorization before account changes
out_of_scope:
- automatic account migration
- multi-region failover
done_when: authorized changes succeed and denied changes do not mutate
phase_anchors:
- scenario-gate: features/manual-change.feature
---
`,
  );
  writeFileSync(
    path.join(project.root, target),
    `# Product Plan

<!-- safeword:product-plan-contract:v1 -->

## Product Bet
- **Expected outcome:** Builders authorize one manual account change.
- **Persona outcome inventory:** Builder sees success as an authorized change; refusal as no mutation; failure as a named error with no mutation; approval as explicit consent; trust as an owner-named receipt; recovery as obtaining fresh consent and retrying the same target.
- **Known facts:** Account changes require explicit user authorization.
- **Assumptions:** The existing consent-token API can enforce it.
- **Unresolved product decisions:** none
- **Success threshold:** Authorized changes succeed; denied changes leave the account intact.
- **Project non-goals:** No background account mutation or multi-region failover.

## Jobs To Be Done
### approval.BU1 — Authorize a manual change
**Persona:** Builder (BU)
#### approval.BU1.R1 — Preserve consent
An owner-authorized token permits one target account change. Absent, expired or mismatched consent permits no mutation. A transient failure permits retry without mutation.

## Shape
### M1 — Safe manual approval
- **Outcome:** One owner-authorized target account changes.
- **Non-goals:** Batched account changes and multi-region failover.

## Surfaces
Affected:
- Safeword CLI
`,
  );
  mkdirSync(path.join(project.root, 'features'), { recursive: true });
  writeFileSync(
    path.join(project.root, 'features/manual-change.feature'),
    `@approval.BU1.R1 @surface.safeword-cli
Feature: Manual authorized account changes
Scenario: Authorized change
  Given valid consent for the requesting owner and target account
  When a manual account change is requested
  Then one authorized account changes
Scenario: Denied change
  Given absent expired or mismatched consent
  When a manual account change is requested
  Then no account mutation occurs
Scenario: Retry a transient failure
  Given a transient endpoint failure
  When the same manual change is retried with valid consent
  Then the retry succeeds without an earlier mutation
`,
  );
  const plan = `# Implementation Plan

## Approach
${complete.reviewed_plan}

## Architecture applicability
skip: No durable architecture record applies to this existing endpoint.

## Data applicability
skip: Existing account schema and consent-token contract stay unchanged; no new data shape or migration is introduced.

## Measurement applicability
skip: The Product Plan makes no quantitative promise.
`;
  writeFileSync(path.join(project.root, planTarget), plan);
  const reviewed = await project.run(['review', 'run', 'plan-implementation', planTarget]);
  assert.equal(reviewed.exitCode, 0, `${reviewed.stdout}\n${reviewed.stderr}`);
  const data = JSON.parse(reviewed.stdout).data;
  assert.equal(data.status, 'approved');
  assert.deepEqual(data.reviewer_output.findings, [{ severity: 'warning', message: suggestion }]);
  states.set(world, { project, plan, reviewId: data.review_id });
}

export function recordedSuggestion(world: SafewordWorld): DispositionState {
  const state = states.get(world);
  assert.ok(state);
  return state;
}

Given(
  'a nonblocking reviewer suggestion for a useful capability outside the accepted boundary is recorded',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    await prepareRecordedSuggestion(this);
  },
);

When('the user declines it', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state);
  const result = state.project.terminal('y', state.reviewId);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /"status":"recorded"/u);
});

Then(
  'the unchanged plan is re-reviewed against the accepted boundary and the decline remains recorded',
  { timeout: 240_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    const { project, plan, reviewId } = state;
    const ticket = readFileSync(project.ticketPath, 'utf8');
    const status = await project.run(['review', 'status', reviewId]);
    assert.equal(JSON.parse(status.stdout).data.status, 'stale');
    const packet = prepareReviewPacket(project.root, 'plan-implementation', [planTarget]).packet;
    const record = packet.review_disposition_context?.records[0];
    assert.ok(record);
    assert.equal(record.review_id, reviewId);
    assert.equal(record.message, suggestion);
    assert.equal(record.disposition, 'declined');
    assert.equal(record.boundary_status, 'current');
    assert.equal(readFileSync(path.join(project.root, planTarget), 'utf8'), plan);
    selectPlanningEval(this, 'r14-declined-strengthening', {
      context: JSON.stringify(packet),
      reviewed_plan: plan,
    });
    runPlanningEval(this);
    assertPlanningEval(this, 'approve', undefined, /declin|failover/iu);
    assert.equal(readFileSync(path.join(project.root, planTarget), 'utf8'), plan);
    assert.equal(readFileSync(project.ticketPath, 'utf8'), ticket);
  },
);

After(function (this: SafewordWorld, scenario) {
  if (scenario.result?.status === Status.FAILED) {
    console.error(`Retained disposition fixture: ${(roots.get(this) ?? []).join(', ')}`);
    return;
  }
  for (const root of roots.get(this) ?? []) rmSync(root, { recursive: true, force: true });
  roots.delete(this);
  states.delete(this);
});
