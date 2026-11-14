import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { PLANNING_CONTEXT_ROLES } from '../../src/review/planning-context-error.js';
import { createPlanningReviewIdentity } from '../../src/review/planning-context-identity.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const roots: string[] = [];
const folder = '.project/tickets/OWN123-scenario';
const spec = `${folder}/spec.md`;
const feature = 'features/scenario.feature';
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
function project(contract = 'v1') {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-scenario-role-'));
  roots.push(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  mkdirSync(nodePath.join(root, 'features'));
  writeFileSync(
    nodePath.join(root, `${folder}/ticket.md`),
    `---\nid: OWN123\ntype: feature\nproduct_plan_contract: ${contract}\nphase_anchors:\n  - scenario-gate: ${feature}\n---\n`,
  );
  writeFileSync(nodePath.join(root, spec), product);
  writeFileSync(
    nodePath.join(root, feature),
    '@approval.BU1.R1 @surface.safeword-cli\nFeature: Trust approval\n  Scenario: Current approval\n    Given current evidence\n    When approval is requested\n    Then approval is current\n',
  );
  return root;
}
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Scenario-gate role context', () => {
  it('derives one complete role identity with the exact executable source', () => {
    const prepared = prepareReviewPacket(project(), 'scenario-gate', [feature], [spec]);
    try {
      const context = prepared.packet.planning_context;
      expect(
        context,
        'owned scenario-gate review must derive its planning role graph',
      ).toBeDefined();
      const present = context?.dependencies.map(row => row.role) ?? [];
      const absent = context?.absences.map(row => row.role) ?? [];
      expect(new Set([...present, ...absent])).toEqual(new Set(PLANNING_CONTEXT_ROLES));
      expect(present).toEqual(
        expect.arrayContaining([
          'ticket',
          'project',
          'rules',
          'scenarios',
          'principles',
          'personas',
          'surfaces',
        ]),
      );
      expect(absent).toEqual(
        expect.arrayContaining([
          'dimensions',
          'architecture',
          'data',
          'reusable-evidence',
          'accepted-upstream-plan',
        ]),
      );
      expect(createPlanningReviewIdentity(prepared.packet)).toMatchObject({
        review_kind: 'scenario-gate',
        ticket_id: 'OWN123',
        targets: [expect.objectContaining({ path: feature })],
      });
    } finally {
      prepared.cleanup();
    }
  });
  it('retains a generic legacy scenario route', () => {
    const prepared = prepareReviewPacket(project('legacy'), 'scenario-gate', [feature], [spec]);
    try {
      expect(prepared.packet.planning_context).toBeUndefined();
    } finally {
      prepared.cleanup();
    }
  });
});
