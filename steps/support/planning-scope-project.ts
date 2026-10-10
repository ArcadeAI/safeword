import { strict as assert } from 'node:assert';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { prepareReviewPacket } from '../../packages/cli/src/review/packet.js';
import { planningContractCases } from '../../packages/cli/tests/fixtures/planning-contracts-eval.js';
import {
  scopeBoundaries,
  type ScopeBoundary,
} from '../../packages/cli/tests/fixtures/planning-scope-context-eval.js';
import { PLANNING_ROLE_PRODUCT } from '../../packages/cli/tests/planning-role-fixtures.js';
import { fixtureProject } from '../keep-plan-reviews-installed-context.steps.js';

export function createScopeContextProject(caseId: string, roots: string[]) {
  const evaluationCase = planningContractCases.find(item => item.id === caseId);
  assert.ok(evaluationCase?.reviewer_boundary);
  assert.match(evaluationCase.reviewed_plan, /drive the real CLI through that endpoint/u);
  assert.doesNotMatch(evaluationCase.reviewed_plan, /rollback disables the new endpoint/u);
  const missing =
    caseId === 'r12-complete-scope-context'
      ? undefined
      : (caseId.slice('r12-missing-'.length) as ScopeBoundary);
  const valueOf = (key: ScopeBoundary) => {
    const value =
      key === missing
        ? '[binding content not supplied]'
        : scopeBoundaries[key].split(': ')[1]?.replace(/\.$/u, '');
    assert.ok(value, `The fixture must supply the ${key} field`);
    return value;
  };
  const root = fixtureProject();
  roots.push(root);
  const folder = '.project/tickets/CTX123-current-context';
  const planPath = `${folder}/impl-plan.md`;
  writeFileSync(
    path.join(root, folder, 'ticket.md'),
    `---
id: CTX123
type: feature
phase: plan-implementation
status: in_progress
product_plan_contract: v1
parent: PRT123
parent_job: approval.BU1
milestone: M1
scope: ${JSON.stringify(valueOf('ticket-scope'))}
out_of_scope: ${JSON.stringify(valueOf('ticket-exclusions'))}
done_when: authorized changes succeed and denied changes do not mutate
phase_anchors:
  - scenario-gate: features/current-context.feature
---
`,
  );
  const parent = path.join(root, '.project/tickets/PRT123-scope-parent');
  mkdirSync(parent, { recursive: true });
  writeFileSync(
    path.join(parent, 'ticket.md'),
    `---
id: PRT123
type: epic
phase: intake
status: in_progress
product_plan_contract: v1
scope: ${JSON.stringify(valueOf('parent-boundary'))}
out_of_scope: new authorization APIs
done_when: manual account changes honor explicit consent
---
`,
  );
  const specification = PLANNING_ROLE_PRODUCT.replace(
    '# Product Plan',
    '# Product Plan\n\n<!-- safeword:product-plan-contract:v1 -->',
  )
    .replace('Builders retain approval.', 'Builders authorize single-account changes.')
    .replace(
      'Builder receives approval.',
      'Builder receives an authorized change or a named refusal.',
    )
    .replace('Approval is authenticated.', 'Account changes require explicit user authorization.')
    .replace('Review is available.', 'The existing consent-token API supports authorization.')
    .replace(
      'Approval advances.',
      'Authorized changes succeed and denied changes cause no mutation.',
    )
    .replace('No anonymous approval.', valueOf('project-non-goals'))
    .replace('Current approval advances.', 'Explicit consent is required before account mutation.')
    .replace('Anonymous approval.', valueOf('milestone-non-goals'));
  writeFileSync(path.join(parent, 'spec.md'), specification);
  writeFileSync(
    path.join(root, folder, 'spec.md'),
    `# Feature Contribution

<!-- safeword:product-plan-contract:v1 -->

## Parent References
- **Parent:** PRT123
- **Parent job:** approval.BU1
- **Milestone:** M1

## Contribution
Require explicit authorization for manual account changes without migration.

## Rules
#### approval.BU1.CTX123.R1 — Authorize account changes
Valid consent permits a change; absent, expired, or mismatched consent permits no mutation.

## Surfaces
Affected:
- Safeword CLI
`,
  );
  writeFileSync(
    path.join(root, planPath),
    `# Implementation Plan

## Approach
${evaluationCase.reviewed_plan}

## Architecture applicability
skip: No durable architecture record applies to this existing endpoint.

## Data applicability
skip: Existing account schema and consent-token contract stay unchanged; no new data shape or migration is introduced.

## Measurement applicability
skip: The Product Plan makes no quantitative promise.
`,
  );
  writeFileSync(
    path.join(root, 'features/current-context.feature'),
    `@approval.BU1.CTX123.R1 @surface.safeword-cli
Feature: Manual authorized account changes
  Scenario: Authorized change
    Given valid consent for the requesting owner and target account
    When a manual account change is requested
    Then one authorized account changes
  Scenario: Denied change
    Given absent expired or mismatched consent
    When a manual account change is requested
    Then no account mutation occurs
`,
  );
  const packet = prepareReviewPacket(root, 'plan-implementation', [planPath], []).packet;
  assert.ok(packet.planning_context);
  const files = [...packet.logical_files, ...(packet.context_files ?? [])];
  for (const role of [
    'ticket',
    'project',
    'parent',
    'milestone',
    'rules',
    'scenarios',
    'principles',
    'personas',
    'surfaces',
  ]) {
    const dependency = packet.planning_context.dependencies.find(item => item.role === role);
    assert.ok(dependency, `${role} must remain structurally resolved`);
    const captured = files.find(file => file.path === dependency.path);
    assert.ok(captured, `${role} must reach the reviewer`);
    assert.equal(captured.content, readFileSync(path.join(root, dependency.path), 'utf8'));
  }
  const roles: Record<ScopeBoundary, string> = {
    'ticket-scope': 'ticket',
    'ticket-exclusions': 'ticket',
    'project-non-goals': 'project',
    'milestone-non-goals': 'milestone',
    'parent-boundary': 'parent',
  };
  for (const key of Object.keys(scopeBoundaries) as ScopeBoundary[]) {
    const dependency = packet.planning_context.dependencies.find(item => item.role === roles[key]);
    const captured = files.find(file => file.path === dependency?.path);
    assert.ok(captured?.content.includes(valueOf(key)), `${key} must reach its captured role`);
    const completeValue = scopeBoundaries[key].split(': ')[1].replace(/\.$/u, '');
    assert.equal(
      files.some(file => file.content.includes(completeValue)),
      key !== missing,
      `${key} must be present exactly when its content was supplied`,
    );
  }
  return {
    root,
    planPath,
    input: {
      context: JSON.stringify({
        planning_context: packet.planning_context,
        logical_files: packet.logical_files,
        context_files: packet.context_files,
      }),
      reviewed_plan: readFileSync(path.join(root, planPath), 'utf8'),
    },
  };
}
