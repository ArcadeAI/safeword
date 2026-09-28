import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';

const roots: string[] = [];
const folder = '.project/tickets/OWN123-owned';
const target = `${folder}/execution-plan.md`;
const upstream = `${folder}/impl-plan.md`;
const scenario = `${folder}/behavior.feature`;
const delivery = EXECUTION_PLAN_CONFORMANCE_CASES.find(value => value.id === 'one-coherent-change');
if (delivery === undefined) throw new Error('Missing canonical Execution fixture');
const executionPlan = delivery.execution_plan;
const other = 'another-ticket/impl-plan.md';

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

function fixture(implementation: string | undefined) {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-upstream-owner-'));
  roots.push(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  mkdirSync(nodePath.join(root, 'another-ticket'));
  writeFileSync(
    nodePath.join(root, folder, 'ticket.md'),
    `---\nid: OWN123\ntype: feature\nproduct_plan_contract: v1\nphase_anchors:\n  - scenario-gate: ${scenario}\n---\n`,
  );
  writeFileSync(nodePath.join(root, folder, 'spec.md'), PLANNING_ROLE_PRODUCT);
  writeFileSync(nodePath.join(root, target), executionPlan);
  writeFileSync(
    nodePath.join(root, scenario),
    'Feature: Trust approval\n  Scenario: Current approval\n    Given current evidence\n    When review is requested\n    Then approval is current\n',
  );
  writeFileSync(nodePath.join(root, other), '# Impl Plan\n\nAn unrelated plan.\n');
  if (implementation !== undefined) writeFileSync(nodePath.join(root, upstream), implementation);
  return root;
}

function prepare(root: string, context = [scenario]) {
  return prepareReviewPacket(root, 'plan-execution', [target], context);
}

describe('Execution upstream context ownership', () => {
  it.each([undefined, ' '.repeat(3)])('refuses missing or blank owning upstream %s', content => {
    const root = fixture(content);
    expect(() => prepare(root)).toThrow(
      expect.objectContaining({
        code: 'missing_planning_context',
        contextRole: 'accepted-upstream-plan',
        contextPath: upstream,
      }),
    );
  });
  it('refuses a non-owning supplied plan when its own plan is missing', () => {
    const root = fixture(undefined);
    expect(() => prepare(root, [other, scenario])).toThrow(
      expect.objectContaining({
        code: 'missing_planning_context',
        contextRole: 'accepted-upstream-plan',
        contextPath: upstream,
      }),
    );
  });
  it('captures its own plan even when another plan is explicitly supplied', () => {
    const implementation =
      '# Impl Plan\n\nPreserve authenticated approval.\n\n## Architecture applicability\n\nskip: No durable architecture records apply.\n\n## Data applicability\n\nskip: No product data is stored.\n';
    const root = fixture(implementation);
    const prepared = prepare(root, [other, scenario]);
    try {
      expect(prepared.packet.context_files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: upstream, content: implementation }),
          expect.objectContaining({ path: other, content: '# Impl Plan\n\nAn unrelated plan.\n' }),
        ]),
      );
    } finally {
      prepared.cleanup();
    }
  });
});
