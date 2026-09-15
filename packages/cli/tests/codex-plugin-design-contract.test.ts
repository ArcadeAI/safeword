import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');

describe('Codex plugin design contract', () => {
  it('records the independently adoptable task-bound Codex plugin-root contract', () => {
    const ticketRelativePath = '0HZBXF-keep-cachebusted-codex-plugins-operational/design.md';
    const activeDesignPath = nodePath.join(REPO_ROOT, '.project/tickets', ticketRelativePath);
    const designPath = existsSync(activeDesignPath)
      ? activeDesignPath
      : nodePath.join(REPO_ROOT, '.project/tickets/completed', ticketRelativePath);
    const design = readFileSync(designPath, 'utf8');
    const upstreamContract = design
      .split('## Upstream Codex contract\n', 2)[1]
      ?.split('\n## ', 1)[0];

    expect(upstreamContract).toContain('task-bound `PLUGIN_ROOT`');
    expect(upstreamContract).toContain('exact immutable plugin directory');
    expect(upstreamContract).toContain('Host adoption is a non-dependency for this delivery');
    expect(upstreamContract).toContain('independently adoptable later');
  });
});
