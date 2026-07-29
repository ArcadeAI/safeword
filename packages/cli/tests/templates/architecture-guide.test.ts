import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const guidePath = nodePath.resolve(
  import.meta.dirname,
  '../../templates/guides/architecture-guide.md',
);

describe('architecture guide generated-document ownership', () => {
  it('distinguishes derived structure from preserved module purpose prose', () => {
    const guide = readFileSync(guidePath, 'utf8');

    expect(guide).toMatch(/root index.+fully machine-owned/is);
    expect(guide).toMatch(/module.+purpose prose.+human-owned.+preserved/is);
    expect(guide).toMatch(/headings, code references, fingerprints,/i);
    expect(guide).toMatch(/only while that module remains present/i);
    expect(guide).not.toContain('preserved byte-for-byte');
    expect(guide).not.toContain("Don't hand-edit it");
  });
});
