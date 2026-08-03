import { describe, expect, it } from 'vitest';

import { effectsFromMutationJournal } from '../../src/cli-protocol/mutation-effects.js';

describe('mutation journal effects', () => {
  it('groups mutations by protocol surface without changing their order or identity', () => {
    expect(
      effectsFromMutationJournal([
        { surface: 'network', kind: 'issue', target: 'github', operation: 'create' },
        { surface: 'file', kind: 'write', target: 'ticket.md', operation: 'create' },
        { surface: 'configuration', kind: 'write', target: 'config.json', operation: 'update' },
      ]),
    ).toEqual({
      files: [{ kind: 'write', target: 'ticket.md', operation: 'create' }],
      configuration: [{ kind: 'write', target: 'config.json', operation: 'update' }],
      network: [{ kind: 'issue', target: 'github', operation: 'create' }],
    });
  });
});
