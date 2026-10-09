import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { PLANNING_CONTEXT_ROLES } from '../../src/review/planning-context-error.js';
import { createPlanningReviewIdentity } from '../../src/review/planning-context-identity.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const roots: string[] = [];
const folder = '.project/tickets/OWN123-product';
const target = `${folder}/spec.md`;
const product = `# Product Plan

## Product Bet

- **Expected outcome:** Builders retain current approval.
- **Persona outcome inventory:** Builder receives a current approval.
- **Known facts:** Approval is authenticated.
- **Assumptions:** Review is available.
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
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-product-role-'));
  roots.push(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  writeFileSync(
    nodePath.join(root, `${folder}/ticket.md`),
    `---\nid: OWN123\ntype: feature\nproduct_plan_contract: ${contract}\n---\n`,
  );
  writeFileSync(nodePath.join(root, target), product);
  return root;
}
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Product review role context', () => {
  it('derives a complete role set and durable identity for an owned Product target', () => {
    const root = project();
    const prepared = prepareReviewPacket(root, 'quality-review', [target]);
    try {
      expect(prepared.packet.planning_phase).toBe('product-plan');
      const context = prepared.packet.planning_context;
      expect(context, 'owned Product review must derive its planning role graph').toBeDefined();
      const present = context?.dependencies.map(row => row.role) ?? [];
      const absent = context?.absences.map(row => row.role) ?? [];
      expect(new Set([...present, ...absent])).toEqual(new Set(PLANNING_CONTEXT_ROLES));
      expect(present).toEqual(
        expect.arrayContaining([
          'ticket',
          'project',
          'rules',
          'principles',
          'personas',
          'surfaces',
        ]),
      );
      expect(absent).toEqual(
        expect.arrayContaining([
          'scenarios',
          'dimensions',
          'architecture',
          'data',
          'reusable-evidence',
          'accepted-upstream-plan',
        ]),
      );
      expect(createPlanningReviewIdentity(prepared.packet)).toMatchObject({
        review_kind: 'quality-review',
        ticket_id: 'OWN123',
        targets: [expect.objectContaining({ path: target })],
      });
    } finally {
      prepared.cleanup();
    }
  });
  it('leaves a legacy generic Product review on the old route', () => {
    const prepared = prepareReviewPacket(project('legacy'), 'quality-review', [target]);
    try {
      expect(prepared.packet.planning_context).toBeUndefined();
    } finally {
      prepared.cleanup();
    }
  });
});
