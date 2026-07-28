import { describe, expect, it, vi } from 'vitest';

import { applyEffects } from '../../src/cli-protocol/apply.js';
import type { Effects } from '../../src/cli-protocol/result.js';

describe('planned effect application', () => {
  it('reports completed effects, a stable error, and recovery after a partial failure', async () => {
    const effects: Effects = {
      files: [
        { kind: 'write', target: 'first.txt' },
        { kind: 'write', target: 'second.txt' },
      ],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    };
    const execute = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('disk full'));

    const result = await applyEffects(effects, execute);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      state: 'failed',
      changed: true,
      effects: {
        files: [{ kind: 'write', target: 'first.txt' }],
      },
      errors: [{ code: 'EFFECT_APPLY_FAILED', retryable: true }],
      recovery: [
        {
          command: 'safeword status --verbose',
          requiresHuman: true,
        },
      ],
    });
  });
});
