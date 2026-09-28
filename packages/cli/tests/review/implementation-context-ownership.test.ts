import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT, writeImplementationRoleInputs } from '../planning-role-fixtures.js';

const roots: string[] = [];
const folder = '.project/tickets/OWN123-owned';
const target = `${folder}/impl-plan.md`;
const parentFolder = '.project/tickets/000123-parent';
const metadata = 'id: OWN123\ntype: feature\nproduct_plan_contract: v1';

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

function fixture(ticket = metadata) {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-implementation-context-'));
  roots.push(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  writeFileSync(nodePath.join(root, folder, 'ticket.md'), `---\n${ticket}\n---\n`);
  writeFileSync(
    nodePath.join(root, folder, 'spec.md'),
    ticket.startsWith(metadata) ? PLANNING_ROLE_PRODUCT : '# Product Plan\n\nPreserve approval.\n',
  );
  writeFileSync(nodePath.join(root, target), '# Impl Plan\n\nPreserve approval.\n');
  if (ticket.startsWith(metadata)) writeImplementationRoleInputs(root, target, 'owned.feature');
  return root;
}

function context(root: string) {
  const prepared = prepareReviewPacket(root, 'plan-implementation', [target]);
  try {
    return prepared.packet.context_files?.map(file => file.path);
  } finally {
    prepared.cleanup();
  }
}

describe('Implementation Product context ownership', () => {
  it('resolves a numeric-looking declared parent ID without changing its spelling', () => {
    const root = fixture(`${metadata}\nparent: 000123\nparent_job: approval.BU1\nmilestone: M1`);
    mkdirSync(nodePath.join(root, parentFolder), { recursive: true });
    writeFileSync(
      nodePath.join(root, parentFolder, 'ticket.md'),
      '---\nid: 000123\ntype: epic\n---\n',
    );
    writeFileSync(nodePath.join(root, parentFolder, 'spec.md'), PLANNING_ROLE_PRODUCT);
    expect(context(root)).toEqual(
      expect.arrayContaining([
        `${folder}/ticket.md`,
        `${folder}/spec.md`,
        `${parentFolder}/ticket.md`,
        `${parentFolder}/spec.md`,
      ]),
    );
  });
  it('reports an unresolved declared parent before a missing own Product Plan', () => {
    const root = fixture(`${metadata}\nparent: 000123\nparent_job: approval.BU1\nmilestone: M1`);
    rmSync(nodePath.join(root, folder, 'spec.md'));
    expect(() => context(root)).toThrow(
      expect.objectContaining({
        code: 'missing_planning_context',
        contextRole: 'parent',
        contextPath: '.project/tickets/000123/spec.md',
      }),
    );
  });
  it.each([
    ['legacy feature', 'id: OWN123\ntype: feature'],
    ['task', 'id: OWN123\ntype: task\nproduct_plan_contract: v1'],
  ])('preserves generic %s reviews', (_label, ticket) => {
    const root = fixture(ticket);
    rmSync(nodePath.join(root, folder, 'spec.md'));
    expect(context(root)).not.toContain(`${folder}/ticket.md`);
  });
});
