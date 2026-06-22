/**
 * Unit tests for the prose reconcile/marker engine (ticket QD5DTT, Slice 1).
 * Covers the "stale prose is visibly flagged, never silently wrong" rule from
 * features/architecture-state-docs.feature.
 */

import { describe, expect, it } from 'vitest';

import { reconcileSections } from '../../src/utils/architecture-reconcile.js';

const CURRENT = 'fingerprint-current';
const OLDER = 'fingerprint-older';

describe('reconcileSections — stale prose is visibly flagged', () => {
  it('shows no marker when a section is reconciled with the current structure', () => {
    const verdicts = reconcileSections({
      nodeNames: ['auth'],
      fingerprint: CURRENT,
      priorStamps: { auth: CURRENT },
    });

    expect(verdicts).toEqual([{ node: 'auth', status: 'current' }]);
  });

  it('marks a section stale when its stamp has fallen behind the current structure', () => {
    const verdicts = reconcileSections({
      nodeNames: ['auth'],
      fingerprint: CURRENT,
      priorStamps: { auth: OLDER },
    });

    expect(verdicts).toEqual([{ node: 'auth', status: 'stale' }]);
  });

  it('flags a section describing a removed node as orphaned, not merely stale', () => {
    const verdicts = reconcileSections({
      nodeNames: [],
      fingerprint: CURRENT,
      priorStamps: { auth: OLDER },
    });

    expect(verdicts).toEqual([{ node: 'auth', status: 'orphaned' }]);
  });

  it('marks a new node without a prior stamp as placeholder, not stale', () => {
    const verdicts = reconcileSections({
      nodeNames: ['billing'],
      fingerprint: CURRENT,
      priorStamps: {},
    });

    expect(verdicts).toEqual([{ node: 'billing', status: 'placeholder' }]);
  });
});
