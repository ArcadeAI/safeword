import { describe, expect, it } from 'vitest';

import { filterOutEquivalentSafewordHooks, filterOutSafewordHooks } from '../../src/utils/hooks.js';

describe('Safeword hook ownership', () => {
  it('preserves a historical hook modified only by timeout', () => {
    const owned = {
      matcher: '*',
      hooks: [{ type: 'command', command: 'bun hook.ts', timeout: 10 }],
    };
    const modified = {
      matcher: '*',
      hooks: [{ type: 'command', command: 'bun hook.ts', timeout: 30 }],
    };

    expect(filterOutSafewordHooks([owned, modified], [owned])).toEqual([modified]);
  });

  it('replaces a current hook that differs only by timeout', () => {
    const current = { hooks: [{ type: 'command', command: 'bun hook.ts', timeout: 30 }] };
    const older = { hooks: [{ type: 'command', command: 'bun hook.ts' }] };

    expect(filterOutEquivalentSafewordHooks([older], [current])).toEqual([]);
  });

  it('preserves timeout changes outside the owned command timeout fields', () => {
    const owned = {
      hooks: [{ type: 'command', command: 'bun hook.ts', timeout: 10, options: { timeout: 1 } }],
    };
    const modified = {
      hooks: [{ type: 'command', command: 'bun hook.ts', timeout: 10, options: { timeout: 2 } }],
    };

    expect(filterOutEquivalentSafewordHooks([modified], [owned])).toEqual([modified]);
  });
});
