import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { updateDeliveryChecklistFile } from '../../src/execution-plan/delivery-checklist.js';

const CATEGORIES = [
  'outcome and scope',
  'resolved decisions',
  'dependency and pull-request decomposition',
  'testing',
  'data and compatibility',
  'monitoring and failure signals',
  'security and privacy',
  'rollout and rollback',
  'documentation',
  'ownership and human dependencies',
  'completion evidence',
] as const;

function plan(): string {
  const proof =
    '| proof | command | integration | real process | real_boundary | current_required | {"type":"command","cwd":".","argv":["node","--version"]} |';
  const rows = CATEGORIES.map(
    (category, index) =>
      `| item-${index + 1} | ${category} | Deliver ${category}. | contributor | proof | open | missing |  |  |`,
  );
  return [
    '# Execution Plan',
    '',
    '## Proof specifications',
    '',
    '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    proof,
    '',
    '## Delivery checklist',
    '',
    '<!-- safeword:delivery-checklist:v1 -->',
    '',
    '| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function fixture(): { path: string; content: string } {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-checklist-update-'));
  const path = nodePath.join(directory, 'execution-plan.md');
  const content = plan();
  writeFileSync(path, content);
  return { path, content };
}

describe('Delivery Checklist update', () => {
  it('records one receipt while preserving every other plan byte', () => {
    const { path, content } = fixture();

    const result = updateDeliveryChecklistFile({
      path,
      expectedContent: content,
      itemId: 'item-4',
      proofId: 'proof',
      receiptId: 'receipt-1',
      revision: 'a'.repeat(40),
      evidenceClass: 'current_revision_real_boundary',
    });

    expect(result).toEqual({ ok: true });
    const original =
      '| item-4 | testing | Deliver testing. | contributor | proof | open | missing |  |  |';
    const replacement = `| item-4 | testing | Deliver testing. | contributor | proof | complete | current_revision_real_boundary | ${'a'.repeat(40)} | receipt:receipt-1 |`;
    expect(readFileSync(path, 'utf8')).toBe(content.split(original).join(replacement));
  });

  it('refuses a stale snapshot or malformed plan without changing the file', () => {
    const fixtureOne = fixture();
    writeFileSync(fixtureOne.path, `${fixtureOne.content}\nconcurrent edit\n`);
    expect(
      updateDeliveryChecklistFile({
        path: fixtureOne.path,
        expectedContent: fixtureOne.content,
        itemId: 'item-4',
        proofId: 'proof',
        receiptId: 'receipt-1',
        revision: 'a'.repeat(40),
        evidenceClass: 'current_revision_real_boundary',
      }),
    ).toMatchObject({ ok: false, code: 'execution_plan_changed' });
    expect(readFileSync(fixtureOne.path, 'utf8')).toBe(`${fixtureOne.content}\nconcurrent edit\n`);

    const fixtureTwo = fixture();
    writeFileSync(fixtureTwo.path, '# broken\n');
    expect(
      updateDeliveryChecklistFile({
        path: fixtureTwo.path,
        expectedContent: '# broken\n',
        itemId: 'item-4',
        proofId: 'proof',
        receiptId: 'receipt-1',
        revision: 'a'.repeat(40),
        evidenceClass: 'current_revision_real_boundary',
      }),
    ).toMatchObject({ ok: false, code: 'missing_proof_specifications' });
    expect(readFileSync(fixtureTwo.path, 'utf8')).toBe('# broken\n');
  });
});
