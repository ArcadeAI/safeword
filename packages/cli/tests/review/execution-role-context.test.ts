import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PLANNING_CONTRACTS } from '../../src/planning/contracts.generated.js';
import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import { PLANNING_CONTEXT_ROLES } from '../../src/review/planning-context-error.js';
import { createPlanningReviewIdentity } from '../../src/review/planning-context-identity.js';
import { isPlanningReviewIdentity } from '../../src/review/planning-role-context.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const delivery = EXECUTION_PLAN_CONFORMANCE_CASES.find(value => value.id === 'one-coherent-change');
if (delivery === undefined) throw new Error('Missing canonical Execution fixture');
const executionPlan = delivery.execution_plan;
const roots: string[] = [];
const folder = '.project/tickets/OWN123-execution';
const target = `${folder}/execution-plan.md`;
const upstream = `${folder}/impl-plan.md`;
const spec = `${folder}/spec.md`;
const feature = 'features/execution.feature';
const canonicalExecutionContract = PLANNING_CONTRACTS['plan-execution'];
const product = `# Product Plan

## Product Bet

- **Expected outcome:** Builders retain current approval.
- **Persona outcome inventory:** Builder receives current approval.
- **Known facts:** Approval is authenticated.
- **Assumptions:** Review remains available.
- **Unresolved product decisions:** none
- **Success threshold:** Current approval advances.
- **Project non-goals:** No anonymous approval.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

#### approval.BU1.R1 — Preserve approval

Current approval advances.
`;
const implementation = `# Implementation Plan

## Approach

Preserve authenticated approval.

## Design alignment

Architecture applicability: skip: No durable architecture record applies.

### Data applicability

Data applicability: skip: No product data is stored.

## Implementation Inspiration

- [Prior source](https://example.com/evidence) informs review, without changing approval authority.
`;
function project() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-execution-role-'));
  roots.push(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  mkdirSync(nodePath.join(root, 'features'));
  writeFileSync(
    nodePath.join(root, `${folder}/ticket.md`),
    `---\nid: OWN123\ntype: feature\nproduct_plan_contract: v1\nphase_anchors:\n  - scenario-gate: ${feature}\n---\n`,
  );
  writeFileSync(nodePath.join(root, spec), product);
  writeFileSync(nodePath.join(root, upstream), implementation);
  writeFileSync(nodePath.join(root, target), executionPlan);
  writeFileSync(
    nodePath.join(root, feature),
    '@approval.BU1.R1 @surface.safeword-cli\nFeature: Trust approval\n  Scenario: Current approval\n    Given current evidence\n',
  );
  return root;
}
function identity(root: string) {
  const prepared = prepareReviewPacket(root, 'plan-execution', [target], [upstream, feature]);
  try {
    return createPlanningReviewIdentity(prepared.packet);
  } finally {
    prepared.cleanup();
  }
}
afterEach(() => {
  const contracts = PLANNING_CONTRACTS as unknown as Record<string, unknown>;
  contracts['plan-execution'] = canonicalExecutionContract;
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Execution planning role context', () => {
  it('derives the owned role graph including its accepted Implementation Plan', () => {
    const prepared = prepareReviewPacket(
      project(),
      'plan-execution',
      [target],
      [upstream, feature],
    );
    try {
      const context = prepared.packet.planning_context;
      expect(context, 'owned Execution review must derive its planning role graph').toBeDefined();
      const present = context?.dependencies.map(row => row.role) ?? [];
      const absent = context?.absences.map(row => row.role) ?? [];
      expect(new Set([...present, ...absent])).toEqual(new Set(PLANNING_CONTEXT_ROLES));
      expect(present).toEqual(
        expect.arrayContaining([
          'ticket',
          'project',
          'rules',
          'scenarios',
          'accepted-upstream-plan',
          'principles',
          'personas',
          'surfaces',
        ]),
      );
      expect(absent).toEqual(expect.arrayContaining(['dimensions', 'architecture', 'data']));
      const reviewIdentity = createPlanningReviewIdentity(prepared.packet);
      expect(isPlanningReviewIdentity(reviewIdentity)).toBe(true);
      expect(reviewIdentity).toMatchObject({
        review_kind: 'plan-execution',
        ticket_id: 'OWN123',
        targets: [expect.objectContaining({ path: target })],
      });
    } finally {
      prepared.cleanup();
    }
  });
  it('retains ordinary checklist progress but stales a delivery definition change', () => {
    const root = project();
    const path = nodePath.join(root, target);
    const before = identity(root);
    const progressed = readFileSync(path, 'utf8').replace(
      '| open | missing | | |',
      '| complete | current_revision_real_boundary | 0123456789abcdef0123456789abcdef01234567 | receipt:proof-1 |',
    );
    writeFileSync(path, progressed);
    expect(identity(root)).toEqual(before);
    writeFileSync(
      path,
      progressed.replace(
        'Deliver the complete typed Execution Plan review capability.',
        'Deliver the complete typed Execution Plan review with a changed boundary.',
      ),
    );
    expect(identity(root)).not.toEqual(before);
  });
  it('stales after a decision in the accepted Implementation Plan changes', () => {
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, upstream),
      implementation
        .replace('Preserve authenticated approval.', 'Require attributable approval.')
        .replace('No product data is stored.', 'This contribution stores no product data.'),
    );
    expect(identity(root)).not.toEqual(before);
  });
  it('retains Execution identity for an upstream edit under implementation-review-only direction', () => {
    const contracts = PLANNING_CONTRACTS as unknown as Record<string, unknown>;
    contracts['plan-execution'] = {
      ...canonicalExecutionContract,
      upstreamImplementationInvalidation: 'implementation_review_only',
    };
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, upstream),
      implementation
        .replace('Preserve authenticated approval.', 'Require attributable approval.')
        .replace('No product data is stored.', 'This contribution stores no product data.'),
    );
    expect(identity(root)).toEqual(before);
  });
  it('stales Execution identity when the canonical upstream direction changes', () => {
    const root = project();
    const before = identity(root);
    const contracts = PLANNING_CONTRACTS as unknown as Record<string, unknown>;
    contracts['plan-execution'] = {
      ...canonicalExecutionContract,
      upstreamImplementationInvalidation: 'implementation_review_only',
    };
    expect(identity(root)).not.toEqual(before);
  });
  it('rejects an Execution identity that marks the upstream plan absent', () => {
    const root = project();
    const reviewIdentity = identity(root);
    expect(reviewIdentity).toBeDefined();
    if (reviewIdentity === undefined) return;
    const missingUpstream = {
      ...reviewIdentity,
      dependencies: reviewIdentity.dependencies.filter(
        row => row.role !== 'accepted-upstream-plan',
      ),
      absences: [
        ...reviewIdentity.absences,
        {
          role: 'accepted-upstream-plan',
          reason: 'The upstream plan was omitted.',
          authority: reviewIdentity.ticket_path,
        },
      ],
    };
    expect(isPlanningReviewIdentity(missingUpstream)).toBe(false);
  });
});
