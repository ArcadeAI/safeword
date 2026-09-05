import { describe, expect, it } from 'vitest';

import { type ReceiptView, renderReceipt } from '../../src/pr-review/publish.js';

function receipt(runState: ReceiptView['runState']): ReceiptView {
  return {
    checks: [],
    findingCounts: { consequential: 0, nonConsequential: 0 },
    reviewedSha: 'a'.repeat(40),
    reviewers: [],
    runState,
    skippedChecks: [],
    tokenUsage: {},
    unknowns: [],
  };
}

function findingsLine(runState: ReceiptView['runState']): string {
  const line = renderReceipt(receipt(runState))
    .split('\n')
    .find(entry => entry.startsWith('Findings:'));
  if (line === undefined) throw new Error('the receipt rendered no findings line');
  return line;
}

describe('receipt findings line', () => {
  it('reads as a result of its own when the review completed', () => {
    expect(findingsLine('complete')).toBe('Findings: 0 consequential, 0 non-consequential');
  });

  it.each(['failed', 'incomplete'] as const)(
    'does not let a %s run read as a clean review',
    runState => {
      const line = findingsLine(runState);
      expect(line).toContain(runState);
      expect(line).toContain('did not finish');
      // The counts survive: an unfinished run still reports what it collected.
      expect(line).toContain('0 consequential, 0 non-consequential');
    },
  );

  it('keeps counts unqualified for a stale run, whose findings were really collected', () => {
    expect(findingsLine('stale')).toBe('Findings: 0 consequential, 0 non-consequential');
  });
});
