import { describe, expect, it } from 'vitest';

import { createPlan, isPlanCurrent } from '../../src/cli-protocol/plan.js';

describe('CLI plan protocol', () => {
  it('binds plan identity to command, effects, and preconditions', () => {
    const plan = createPlan({
      command: 'remove',
      preconditionDigest: 'tree-a',
      effects: {
        destructive: [{ kind: 'remove', target: '.safeword' }],
      },
      requiresConfirmation: true,
    });

    expect(plan).toMatchObject({
      schemaVersion: 1,
      command: 'remove',
      preconditionDigest: 'tree-a',
      requiresConfirmation: true,
    });
    expect(plan.id).toMatch(/^[a-f\d]{64}$/);
    expect(isPlanCurrent(plan, 'tree-a')).toBe(true);
    expect(isPlanCurrent(plan, 'tree-b')).toBe(false);
  });

  it('normalizes every effect category even when empty', () => {
    expect(createPlan({ command: 'status', preconditionDigest: 'tree' }).effects).toEqual({
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    });
  });
});
