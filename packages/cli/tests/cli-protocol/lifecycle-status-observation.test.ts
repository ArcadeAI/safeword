import { describe, expect, it, vi } from 'vitest';

import { observeLifecycleSurfaces } from '../../src/lifecycle/status.js';
import { createTemporaryDirectory } from '../helpers.js';

vi.mock('../../src/claude-plugin/status.js', async () => {
  const { createResult } = await import('../../src/cli-protocol/result.js');
  return {
    observeClaudeStatus: () =>
      createResult({
        state: 'healthy',
        data: { command: 'claude status', classification: 'plugin-mode' },
      }),
  };
});

vi.mock('../../src/codex-plugin/installer.js', async () => {
  const { createResult } = await import('../../src/cli-protocol/result.js');
  return {
    observeCodexMigration: () =>
      createResult({
        state: 'action_required',
        data: { command: 'codex status', classification: 'activation-pending' },
      }),
  };
});

describe('lifecycle profile observation', () => {
  it('observes selected independent profiles when project configuration is absent', async () => {
    const surfaces = await observeLifecycleSurfaces(createTemporaryDirectory(), [
      'claude',
      'codex',
    ]);

    expect(surfaces.map(surface => [surface.name, surface.result.state])).toEqual([
      ['project', 'action_required'],
      ['claude', 'healthy'],
      ['codex', 'action_required'],
    ]);
  });
});
