import { describe, expect, it } from 'vitest';

import { isResolvedReceiptState, isTerminalReceiptState, type ReceiptState } from '../src/types.js';

const states: ReceiptState[] = [
  'accepted',
  'claimed',
  'dispatching',
  'filed',
  'ambiguous',
  'retryable',
  'dead-letter',
  'rejected',
  'tombstone',
];

describe('receipt state classification', () => {
  it('treats dead letters and completed outcomes as terminal for clients', () => {
    expect(states.filter(isTerminalReceiptState)).toEqual([
      'filed',
      'dead-letter',
      'rejected',
      'tombstone',
    ]);
  });

  it('only treats completed outcomes as resolved for duplicate submission', () => {
    expect(states.filter(isResolvedReceiptState)).toEqual(['filed', 'rejected', 'tombstone']);
  });
});
