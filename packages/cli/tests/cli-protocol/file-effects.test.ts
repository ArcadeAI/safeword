import { describe, expect, it } from 'vitest';

import { diffFileSnapshots } from '../../src/cli-protocol/file-effects.js';

describe('file snapshot effects', () => {
  it('reports creates, updates, and deletes in stable observation order', () => {
    expect(
      diffFileSnapshots(
        new Map([
          ['updated.txt', 'before'],
          ['deleted.txt', 'before'],
        ]),
        new Map([
          ['created.txt', 'after'],
          ['updated.txt', 'after'],
        ]),
      ),
    ).toEqual([
      { kind: 'create', target: 'created.txt' },
      { kind: 'update', target: 'updated.txt' },
      { kind: 'delete', target: 'deleted.txt' },
    ]);
  });
});
