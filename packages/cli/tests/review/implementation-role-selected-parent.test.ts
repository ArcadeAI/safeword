import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import {
  createPlanningReviewIdentity,
  productParentContextIdentity,
} from '../../src/review/planning-context-identity.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const delivery = EXECUTION_PLAN_CONFORMANCE_CASES.find(value => value.id === 'one-coherent-change');
if (delivery === undefined) throw new Error('Missing canonical Execution fixture');
const executionPlan = delivery.execution_plan;
const roots: string[] = [];
const parentPath = '.project/tickets/000123-parent/spec.md';
const child = '.project/tickets/OWN123-child';
const target = `${child}/impl-plan.md`;
const feature = 'features/child.feature';
const parent = `# Parent Product Plan

## Product Bet

- **Expected outcome:** Builder can trust approval.
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

Only current approval advances.

### approval.BU2 — Unrelated work

Builder can do another task.

## Shape

### M1 — Current approval

- **Outcome:** Review is current.
- **Non-goals:** Anonymous approval.

### M2 — Unrelated milestone

An unrelated delivery remains available.
`;

function project(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-implementation-parent-'));
  roots.push(root);
  writePlanningInventories(root);
  for (const folder of [child, '.project/tickets/000123-parent', 'features'])
    mkdirSync(nodePath.join(root, folder), { recursive: true });
  writeFileSync(
    nodePath.join(root, `${child}/ticket.md`),
    `---\nid: OWN123\ntype: feature\nproduct_plan_contract: v1\nparent: 000123\nparent_job: approval.BU1\nmilestone: M1\nphase_anchors:\n  - scenario-gate: ${feature}\n---\n`,
  );
  writeFileSync(
    nodePath.join(root, '.project/tickets/000123-parent/ticket.md'),
    '---\nid: 000123\ntype: epic\n---\n',
  );
  writeFileSync(nodePath.join(root, parentPath), parent);
  writeFileSync(
    nodePath.join(root, `${child}/spec.md`),
    '# Child Contribution\n\n## Jobs To Be Done\n\n### approval.BU1 — Trust approval\n\n#### approval.BU1.R1 — Preserve approval\n\nOnly current approval advances.\n',
  );
  writeFileSync(
    nodePath.join(root, target),
    '# Implementation Plan\n\n## Approach\n\nPreserve authenticated approval.\n\n## Design alignment\n\nArchitecture applicability: skip: No durable architecture record applies.\n\n### Data applicability\n\nData applicability: skip: No product data is stored.\n',
  );
  writeFileSync(nodePath.join(root, `${child}/execution-plan.md`), executionPlan);
  writeFileSync(
    nodePath.join(root, feature),
    '@approval.BU1.R1 @surface.safeword-cli\nFeature: Trust approval\n  Scenario: Current approval\n    Given current evidence\n',
  );
  return root;
}

function executionIdentity(root: string) {
  const prepared = prepareReviewPacket(
    root,
    'plan-execution',
    [`${child}/execution-plan.md`],
    [target, feature],
  );
  try {
    return createPlanningReviewIdentity(prepared.packet);
  } finally {
    prepared.cleanup();
  }
}

function identity(root: string) {
  const prepared = prepareReviewPacket(root, 'plan-implementation', [target], [feature]);
  try {
    return createPlanningReviewIdentity(prepared.packet);
  } finally {
    prepared.cleanup();
  }
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Implementation child selected-parent review identity', () => {
  it('projects the declared ticket even when the sibling Product Plan is not captured', () => {
    const root = project();
    const prepared = prepareReviewPacket(root, 'plan-implementation', [target], [feature]);
    try {
      const packet = {
        ...prepared.packet,
        context_files: prepared.packet.context_files?.filter(
          file => file.path !== `${child}/spec.md`,
        ),
      };
      expect(productParentContextIdentity(packet).has(`${child}/ticket.md`)).toBe(true);
    } finally {
      prepared.cleanup();
    }
  });
  it('retains approval after an unrelated parent job changes', () => {
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent.replace('Builder can do another task.', 'Builder can do a revised unrelated task.'),
    );
    expect(identity(root)).toEqual(before);
  });

  it('stales approval after the selected parent outcome changes', () => {
    const root = project();
    const before = identity(root);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent.replace('Review is current.', 'Review is current and attributable.'),
    );
    expect(identity(root)).not.toEqual(before);
  });
  it('retains Execution approval after an unrelated parent job changes', () => {
    const root = project();
    const before = executionIdentity(root);
    writeFileSync(
      nodePath.join(root, parentPath),
      parent.replace('Builder can do another task.', 'Builder can do a revised unrelated task.'),
    );
    expect(executionIdentity(root)).toEqual(before);
  });
});
