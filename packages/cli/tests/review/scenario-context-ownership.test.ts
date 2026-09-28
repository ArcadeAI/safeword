import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { writePlanningInventories } from '../planning-fixtures.js';

const roots: string[] = [];
const folder = '.project/tickets/OWN123-owned';
const spec = `${folder}/spec.md`;
const target = 'features/approval.feature';
const metadata = `id: OWN123\ntype: feature\nproduct_plan_contract: v1\nphase_anchors:\n  - scenario-gate: ${target}`;
const parentFolder = '.project/tickets/000123-parent';
const product =
  '# Product Plan\n\n## Product Bet\n\n- **Expected outcome:** Preserve approval.\n- **Persona outcome inventory:** Builder receives current approval.\n- **Known facts:** Approval authenticates source.\n- **Assumptions:** none\n- **Unresolved product decisions:** none\n- **Success threshold:** Current approval advances.\n- **Project non-goals:** No anonymous approval.\n\n## Jobs To Be Done\n\n### approval.BU1 — Trust approval\n\n**Persona:** Builder (BU)\n\n> When I request approval, I want current evidence, so I can trust advancement.\n\n#### approval.BU1.R1 — Preserve approval\n\nCurrent approval advances.\n\n## Shape\n\n### M1 — Trust approval\n\n- **Outcome:** Current approval advances.\n- **Non-goals:** No anonymous approval.\n\n## Surfaces\n\nAffected:\n- Safeword CLI\n';

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

function fixture(ticket = metadata) {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-scenario-context-'));
  roots.push(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  mkdirSync(nodePath.join(root, 'features'));
  writeFileSync(nodePath.join(root, folder, 'ticket.md'), `---\n${ticket}\n---\n`);
  writeFileSync(nodePath.join(root, spec), product);
  writeFileSync(
    nodePath.join(root, target),
    'Feature: Trust approval\n  Scenario: Current approval\n    Given current evidence\n    When approval is requested\n    Then current approval advances\n',
  );
  return root;
}

function context(root: string) {
  const prepared = prepareReviewPacket(root, 'scenario-gate', [target], [spec]);
  try {
    return prepared.packet.context_files?.map(file => file.path);
  } finally {
    prepared.cleanup();
  }
}

describe('scenario context ownership and required roles', () => {
  it.each(['personas', 'surfaces'] as const)('refuses a missing installed %s inventory', role => {
    const root = fixture();
    rmSync(nodePath.join(root, '.project', `${role}.md`));
    expect(() => context(root)).toThrow(
      expect.objectContaining({
        code: 'missing_planning_context',
        contextRole: role,
        contextPath: `.project/${role}.md`,
      }),
    );
  });
  it('resolves the declared parent before project inventories', () => {
    const root = fixture(`${metadata}\nparent: 000123\nparent_job: approval.BU1\nmilestone: M1`);
    rmSync(nodePath.join(root, '.project/principles.md'));
    expect(() => context(root)).toThrow(
      expect.objectContaining({ code: 'missing_planning_context', contextRole: 'parent' }),
    );
  });
  it('captures declared parent ticket and Product Plan with the owning ticket', () => {
    const root = fixture(`${metadata}\nparent: 000123\nparent_job: approval.BU1\nmilestone: M1`);
    mkdirSync(nodePath.join(root, parentFolder), { recursive: true });
    writeFileSync(
      nodePath.join(root, parentFolder, 'ticket.md'),
      '---\nid: 000123\ntype: epic\n---\n',
    );
    writeFileSync(nodePath.join(root, parentFolder, 'spec.md'), product);
    expect(context(root)).toEqual(
      expect.arrayContaining([
        `${folder}/ticket.md`,
        `${parentFolder}/ticket.md`,
        `${parentFolder}/spec.md`,
      ]),
    );
  });
  it.each([
    ['legacy feature', 'id: OWN123\ntype: feature'],
    ['task', 'id: OWN123\ntype: task\nproduct_plan_contract: v1'],
  ])('preserves generic %s context', (_label, ticket) => {
    const root = fixture(ticket);
    rmSync(nodePath.join(root, '.project/principles.md'));
    expect(context(root)).toEqual([spec]);
  });
});
