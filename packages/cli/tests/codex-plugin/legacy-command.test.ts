import { describe, expect, it } from 'vitest';

import { legacyCommandIdentity } from '../../src/codex-plugin/legacy-command.js';

describe('legacy Codex command identity', () => {
  it.each([
    ['npx --yes safeword hook codex pre-tool-use', { kind: 'package', event: 'pre-tool-use' }],
    ['npx --yes safeword codex-hook stop', { kind: 'package', event: 'stop' }],
    [
      'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/stop.ts"',
      { kind: 'script', event: 'stop', script: 'codex/stop.ts' },
    ],
    [
      'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/session-safeword-context.ts" --agent=codex',
      {
        kind: 'script',
        event: 'session-start',
        script: 'session-safeword-context.ts',
      },
    ],
  ])('recognizes the supported historical command %s', (command, identity) => {
    expect(legacyCommandIdentity(command)).toEqual(identity);
  });

  it.each([
    'bunx --yes safeword hook codex stop',
    'safeword hook codex stop',
    'npx --yes safeword hook codex stop --extra',
    'npx --yes safeword hook cursor stop',
    'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/user-script.ts"',
    'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/stop.ts" --user-flag',
  ])('does not claim the user-authored lookalike %s', command => {
    expect(legacyCommandIdentity(command)).toBeUndefined();
  });
});
