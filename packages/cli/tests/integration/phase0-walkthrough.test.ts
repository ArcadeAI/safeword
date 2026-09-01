import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const copies = [
  fileURLToPath(new URL('../../templates/skills/bdd/DISCOVERY.md', import.meta.url)),
  fileURLToPath(new URL('../../../../.claude/skills/bdd/DISCOVERY.md', import.meta.url)),
];

describe.each(copies)('lean intake walkthrough contract — %s', path => {
  const content = readFileSync(path, 'utf8');

  it('covers the full-plan and delta-child paths without a duplicated worked example', () => {
    expect(content).toContain('## Full Product Plan');
    expect(content).toContain('## Child contribution');
    expect(content).not.toContain('## Worked example: intake end to end');
  });

  it('keeps Rule lineage and the parent bootstrap command explicit', () => {
    expect(content).toContain('<parent-job>.<child-ticket-id>.R<n>');
    expect(content).toContain('safeword ticket reconcile-parent <ticket-id>');
  });
});
