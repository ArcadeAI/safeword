import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { productParentContextIdentity } from '../../src/review/planning-context-identity.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT, writeImplementationRoleInputs } from '../planning-role-fixtures.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Implementation semantic ticket ownership', () => {
  it.each([
    ['owned feature', '.project/tickets/OWN123-owned', 'feature', 'v1', true],
    ['legacy feature', '.project/tickets/OWN123-owned', 'feature', 'legacy', false],
    ['task', '.project/tickets/OWN123-owned', 'task', 'v1', false],
    ['generic supplied ticket', 'OWN123-generic', 'feature', 'v1', false],
  ] as const)('projects only the %s ticket', (_label, folder, type, contract, owned) => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-implementation-owner-'));
    roots.push(root);
    writePlanningInventories(root);
    mkdirSync(nodePath.join(root, folder), { recursive: true });
    const ticket = `${folder}/ticket.md`;
    const spec = `${folder}/spec.md`;
    const target = `${folder}/impl-plan.md`;
    writeFileSync(
      nodePath.join(root, ticket),
      `---\nid: OWN123\ntype: ${type}\nproduct_plan_contract: ${contract}\nscope: preserve approval\n---\n`,
    );
    writeFileSync(
      nodePath.join(root, spec),
      owned ? PLANNING_ROLE_PRODUCT : '# Product Plan\n\nPreserve approval.\n',
    );
    writeFileSync(nodePath.join(root, target), '# Impl Plan\n\nPreserve approval.\n');
    if (owned) writeImplementationRoleInputs(root, target, 'owned.feature');
    const prepared = prepareReviewPacket(root, 'plan-implementation', [target], [ticket, spec]);
    try {
      expect(prepared.packet.planning_phase).toBe(owned ? 'plan-implementation' : undefined);
      expect(productParentContextIdentity(prepared.packet).has(ticket)).toBe(owned);
    } finally {
      prepared.cleanup();
    }
  });
});
