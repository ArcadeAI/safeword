import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const root = nodePath.resolve(import.meta.dirname, '../../../..');

describe('planning fallback documentation', () => {
  it('marks the older coordinator decision as superseded in part', () => {
    const architecture = readFileSync(nodePath.join(root, 'ARCHITECTURE.md'), 'utf8');
    const olderRecord = architecture
      .split('**Date:** 2026-08-02', 2)[1]
      ?.split('**OpenCode extension', 1)[0];
    expect(olderRecord).toContain(
      'Superseded in part by the 2026-09-20 planning fallback decision',
    );
    expect(olderRecord).toContain('immutable coordinator packet');
  });

  it('describes reduced fallback honestly in the public overview', () => {
    const readme = readFileSync(nodePath.join(root, 'README.md'), 'utf8');
    expect(readme).toContain('reduced independence');
    expect(readme).not.toContain('Both read the live worktree, so');
  });
});
