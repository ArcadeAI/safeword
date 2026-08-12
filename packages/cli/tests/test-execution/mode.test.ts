import { describe, expect, it } from 'vitest';

import { resolveExecutionMode } from '../../src/test-execution/mode';

describe('resolveExecutionMode', () => {
  it('lets a local command override win over personal and project remote preferences', () => {
    expect(
      resolveExecutionMode({
        command: 'local',
        personal: 'remote-preferred',
        project: 'remote-preferred',
      }),
    ).toEqual({ mode: 'local', source: 'command' });
  });
});
