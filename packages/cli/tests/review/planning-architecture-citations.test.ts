import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { prepareReviewPacket } from '../../src/review/packet.js';
import { createPlanningReviewIdentity } from '../../src/review/planning-context-identity.js';
import { EXECUTION_PLAN_SAMPLES } from '../fixtures/execution-plan-samples.js';
import { createTemporaryDirectory } from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import { PLANNING_ROLE_PRODUCT, writeImplementationRoleInputs } from '../planning-role-fixtures.js';

const directory = '.project/tickets/CITE42-approval';
const plan = `${directory}/impl-plan.md`;
const record = 'decisions/Approval rule.md';
const roots: string[] = [];

function project() {
  const root = createTemporaryDirectory();
  roots.push(root);
  function write(path: string, content: string) {
    mkdirSync(nodePath.dirname(nodePath.join(root, path)), { recursive: true });
    writeFileSync(nodePath.join(root, path), content);
  }
  write(
    `${directory}/ticket.md`,
    '---\nid: CITE42\ntype: feature\nproduct_plan_contract: v1\n---\n',
  );
  write(`${directory}/spec.md`, PLANNING_ROLE_PRODUCT);
  write(plan, '# Implementation Plan\n');
  writePlanningInventories(root);
  writeImplementationRoleInputs(root, plan, 'approval.feature');
  write('.safeword/config.json', JSON.stringify({ paths: { architecture: 'ARCHITECTURE.md' } }));
  write('ARCHITECTURE.md', '[Rule](<decisions/Approval rule.md>)\n[Unused](unused.md)');
  write(record, 'Bind approval to the reviewed revision.');
  write(
    plan,
    [
      '# Implementation Plan',
      'Use the [approval rule][decision].',
      '',
      '[decision]: ../../../decisions/Approval%20rule.md#scope',
      '',
      'See [test notes](unrelated.md).',
      '## Architecture applicability',
      'Follow [retention](../../../records/retention.md).',
      '`[example](ignored.md)`',
      '![diagram](diagram.md)',
      '',
      '## Data applicability',
      'skip: No data changes.',
    ].join('\n'),
  );
  return { root, write };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('architecture records cited by an owned plan', () => {
  it('captures cited bytes once and binds record changes to review currency', () => {
    const { root, write } = project();
    write('records/retention.md', 'Retain approvals.');
    function capture(expected: string) {
      const prepared = prepareReviewPacket(
        root,
        'plan-implementation',
        [plan],
        ['records/retention.md'],
      );
      try {
        expect(prepared.packet.context_files?.filter(file => file.path === record)).toEqual([
          { path: record, content: expected },
        ]);
        expect(
          prepared.packet.context_files?.filter(file => file.path === 'records/retention.md'),
        ).toEqual([{ path: 'records/retention.md', content: 'Retain approvals.' }]);
        return createPlanningReviewIdentity(prepared.packet)?.dependencies.find(
          dependency => dependency.path === record && dependency.role === 'architecture',
        )?.semantic_digest;
      } finally {
        prepared.cleanup();
      }
    }
    const first = capture('Bind approval to the reviewed revision.');
    expect(first).toBeDefined();
    write(record, 'Bind approval to the accepted plan.');
    expect(capture('Bind approval to the accepted plan.')).not.toBe(first);
  });

  it('includes citations from both plans in execution review', () => {
    const { root, write } = project();
    const execution = `${directory}/execution-plan.md`;
    write('records/retention.md', 'Retain approvals.');
    const sample = EXECUTION_PLAN_SAMPLES.find(value => value.id === 'one-coherent-change');
    if (!sample) throw new Error('Missing execution plan fixture');
    write(
      execution,
      `${sample.execution_plan}\n## Architecture applicability\nUse [delivery](delivery.md).`,
    );
    write(`${directory}/delivery.md`, 'Deliver in one change.');
    const prepared = prepareReviewPacket(
      root,
      'plan-execution',
      [execution],
      ['features/approval.feature'],
    );
    try {
      expect(prepared.packet.context_files).toEqual(
        expect.arrayContaining([
          { path: record, content: 'Bind approval to the reviewed revision.' },
          { path: `${directory}/delivery.md`, content: 'Deliver in one change.' },
        ]),
      );
    } finally {
      prepared.cleanup();
    }
  });

  it('names the missing citation and its architecture role', () => {
    const { root } = project();
    expect(() => prepareReviewPacket(root, 'plan-implementation', [plan])).toThrow(
      expect.objectContaining({ contextRole: 'architecture', contextPath: 'records/retention.md' }),
    );
  });
});
