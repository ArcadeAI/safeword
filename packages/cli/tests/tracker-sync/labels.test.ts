import { describe, expect, it } from 'vitest';

import { reconcileOwnedLabels } from '../../src/tracker-sync/labels.js';

/**
 * Label reconciliation (JS5K5G AC7) — re-sync must replace a changed owned label,
 * not accrete it, while never touching human labels.
 */
describe('reconcileOwnedLabels', () => {
  it('removes a stale owned label and adds the new one when an epic changes', () => {
    const result = reconcileOwnedLabels(
      ['epic:bridge', 'type:feature'],
      ['epic:sync', 'type:feature'],
    );
    expect(result.remove).toEqual(['epic:bridge']);
    expect(result.add).toEqual(['epic:sync']);
  });

  it('replaces a changed type label', () => {
    const result = reconcileOwnedLabels(['type:task'], ['type:feature']);
    expect(result.remove).toEqual(['type:task']);
    expect(result.add).toEqual(['type:feature']);
  });

  it('never removes human labels', () => {
    const result = reconcileOwnedLabels(['priority:high', 'epic:bridge'], ['epic:bridge']);
    expect(result.remove).toEqual([]);
    expect(result.add).toEqual([]);
  });

  it('is a no-op when owned labels already match', () => {
    const result = reconcileOwnedLabels(
      ['epic:bridge', 'type:feature', 'needs-triage'],
      ['epic:bridge', 'type:feature'],
    );
    expect(result.add).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it('adds owned labels onto an issue that has only human labels', () => {
    const result = reconcileOwnedLabels(['needs-triage'], ['epic:bridge', 'type:feature']);
    expect(result.add).toEqual(['epic:bridge', 'type:feature']);
    expect(result.remove).toEqual([]);
  });
});
