import { describe, expect, it } from 'vitest';

import { serializedProfilePreconditions } from '../../src/lifecycle/commands.js';

describe('lifecycle profile preconditions', () => {
  it('ignores observation time without hiding semantic profile changes', () => {
    const observation = (status: string, recordedAt: string) => [
      {
        agent: 'codex',
        observation: {
          proof: { status, recorded_at: recordedAt },
          project: '/workspace/example',
        },
      },
    ];

    const baseline = serializedProfilePreconditions(
      '/workspace/example',
      observation('current', '2026-09-12T20:00:00.000Z'),
    );

    expect(
      serializedProfilePreconditions(
        '/workspace/example',
        observation('current', '2026-09-12T20:01:00.000Z'),
      ),
    ).toBe(baseline);
    expect(baseline).toContain('<project>');
    expect(serializedProfilePreconditions('/workspace/example', observation('stale', ''))).not.toBe(
      baseline,
    );
  });
});
