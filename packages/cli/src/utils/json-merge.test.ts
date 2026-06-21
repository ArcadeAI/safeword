import { describe, expect, it } from 'vitest';

import { assignOrPrune } from './json-merge.js';

describe('assignOrPrune', () => {
  it('assigns the value and returns true when it has entries', () => {
    const target: Record<string, unknown> = { keep: 1 };
    const value = { a: 1 };

    const isKept = assignOrPrune(target, 'nested', value);

    expect(isKept).toBe(true);
    expect(target).toEqual({ keep: 1, nested: { a: 1 } });
  });

  it('deletes an existing key and returns false when the value is empty', () => {
    const target: Record<string, unknown> = { keep: 1, nested: { old: 1 } };

    const isKept = assignOrPrune(target, 'nested', {});

    expect(isKept).toBe(false);
    expect(target).toEqual({ keep: 1 });
    expect('nested' in target).toBe(false);
  });

  it('is a no-op (returns false) when pruning an absent key', () => {
    const target: Record<string, unknown> = { keep: 1 };

    const isKept = assignOrPrune(target, 'missing', {});

    expect(isKept).toBe(false);
    expect(target).toEqual({ keep: 1 });
  });
});
