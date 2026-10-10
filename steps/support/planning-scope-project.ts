import { strict as assert } from 'node:assert';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { prepareReviewPacket } from '../../packages/cli/src/review/packet.js';
import { resolveConfiguredPath } from '../../packages/cli/src/utils/configured-paths.js';
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

/** Complete the native fixture's design premises, without supplying omitted scope authority. */
export function completeNativeScopeProject(project: ReturnType<typeof createScopeContextProject>) {
  const architecturePath = resolveConfiguredPath(project.root, 'architecture');
  mkdirSync(path.dirname(architecturePath), { recursive: true });
  writeFileSync(
    architecturePath,
    `# Current account-change architecture

This is a synthetic project's existing, fixture-owned contract, version 1. It is a closed-world test premise, not evidence about a deployed service.

The CLI calls the existing manual account-change endpoint, which delegates writes to the existing consent API v1 and account store. The API's guardedChange(requester, target, consent, change) binds the authenticated session requester and exactly one target to consent. The existing store transaction checks owner, target and expiry at the write using server UTC; expiry equal to now is expired. A refused request or pre-commit failure performs no mutation. The transaction already provides this atomic guard; this feature adds no transaction protocol or new authorization API.

The account store is the authoritative owner of existing account records. The consent API owns opaque consent credentials and issuer keys; callers neither persist nor log tokens. Existing schema, identifiers, retention and issuer policies remain unchanged. A retry after denial needs fresh valid consent. A pre-commit transient failure is retryable without mutation. A transport failure after commit is an uncertain result and must not be represented as a confirmed refusal or automatically retried by this change.

The project owns this contract text; no third-party implementation is copied. Production consent issuance and deployment remain outside the wiring proof.
`,
  );
  const architectureReference = path.relative(project.root, architecturePath);
  const planFile = path.join(project.root, project.planPath);
  let plan = readFileSync(planFile, 'utf8');
  assert.match(plan, /Decision:.*?Proof:/u);
  assert.ok(
    plan.includes('A transient endpoint failure returns a retryable error without mutation.'),
  );
  assert.ok(
    plan.includes('skip: No durable architecture record applies to this existing endpoint.'),
  );
  assert.ok(
    plan.includes(
      'skip: Existing account schema and consent-token contract stay unchanged; no new data shape or migration is introduced.',
    ),
  );
  plan = plan.replace(
    /Decision:.*?Proof:/u,
    `Decision: use the existing consent API v1 guardedChange contract documented in ${architectureReference}. The in-scope alternative is duplicating its owner/target/expiry guard at the endpoint; reject that duplication because it splits the authoritative write boundary. This fixture's current v1 contract establishes design suitability; endpoint tests remain future verification, not completed evidence. The choice is reversible by disabling this endpoint's account-change handling. Proof:`,
  );
  plan = plan.replace(
    'A transient endpoint failure returns a retryable error without mutation.',
    'A pre-commit transient endpoint failure returns a retryable error without mutation. A post-commit transport failure reports an uncertain result without automatic retry or a false no-mutation claim.',
  );
  plan = plan.replace(
    'skip: No durable architecture record applies to this existing endpoint.',
    `Applicable: ${architectureReference} documents the existing CLI, endpoint, consent API and account store boundary. Reuse its guarded write without changing component ownership or shared interfaces. This is a reversible feature-local wiring choice, so no new durable architecture decision is introduced. Reassess if the v1 contract cannot satisfy the accepted behavior; new authorization APIs require the product owner's decision.`,
  );
  plan = plan.replace(
    'skip: Existing account schema and consent-token contract stay unchanged; no new data shape or migration is introduced.',
    `Applicable: consent changes access to account writes. Purpose: authorize manual single-account changes. Store and model: reuse the existing account store; no new attempt or token store. Schema and relationships: unchanged account records and owner relationship. Source of truth: the account store remains authoritative. Ownership and access: the authenticated owner and target must match consent at the existing guarded write. Identity and integrity: existing account identity and the v1 atomic guard remain authoritative; server UTC defines expiry and equality is expired. Cross-system flow: CLI to existing endpoint to consent API to account store; no new data transfer or copy. Lifecycle and retention: no new persisted consent or diagnostics; existing retention and issuer policy remain unchanged. Migration and backfill: inapplicable because no schema or data movement changes. Compliance: preserve existing access and credential handling; no new compliance policy or application-managed encryption keys. Rollback: disable this endpoint's change handling without rewriting accounts or changing the API. Tokens never appear in logs.`,
  );
  plan +=
    '\n## Documentation impact\nUpdate the existing CLI account-change usage documentation with named denial, fresh-consent recovery, pre-commit retry and uncertain post-commit result. This introduces no new product behavior.\n';
  plan +=
    '\n## Discriminating boundary proof\nDrive the real CLI and endpoint with controlled authoritative server UTC: consent whose expiry equals the guarded-write time must produce a named denial and unchanged account state. Separately inject a transport failure after a committed write; establish committed account state, a visible uncertain result, and no automatic retry. These are planned checks of the stated v1 contract, not claims that tests have already passed.\n';
  writeFileSync(planFile, plan);
  const packet = prepareReviewPacket(
    project.root,
    'plan-implementation',
    [project.planPath],
    [],
  ).packet;
  assert.ok(packet.planning_context?.dependencies.some(item => item.role === 'architecture'));
  assert.ok(packet.planning_context?.dependencies.some(item => item.role === 'data'));
  const refreshedInput = {
    context: JSON.stringify({
      planning_context: packet.planning_context,
      logical_files: packet.logical_files,
      context_files: packet.context_files,
    }),
    reviewed_plan: plan,
  };
  for (const value of Object.values(scopeBoundaries)) {
    const boundary = value.split(': ')[1].replace(/\.$/u, '');
    assert.equal(
      refreshedInput.context.includes(boundary),
      project.input.context.includes(boundary),
      `Native fixture completion must preserve supplied or omitted scope: ${boundary}`,
    );
  }
  project.input = refreshedInput;
}
