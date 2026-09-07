import { describe, expect, it } from 'vitest';

import { positiveInteger } from '../src/runtime-config.js';

describe('collector runtime configuration', () => {
  it('uses defaults and accepts positive integers', () => {
    expect(positiveInteger(undefined, 20, 'LIMIT')).toBe(20);
    expect(positiveInteger('5', 20, 'LIMIT')).toBe(5);
  });

  it.each(['', '0', '-1', '1.5', 'garbage'])('rejects an unsafe quota value %j', value => {
    expect(() => positiveInteger(value, 20, 'LIMIT')).toThrow('LIMIT must be a positive integer');
  });
});
