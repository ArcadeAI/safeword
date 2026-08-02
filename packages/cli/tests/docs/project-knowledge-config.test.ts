import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const DOCUMENTS = ['README.md', 'packages/website/src/content/docs/reference/configuration.mdx'];

describe('public project-knowledge configuration contract', () => {
  it.each(DOCUMENTS)('%s documents the complete ownership and health lifecycle', path => {
    const content = readFileSync(nodePath.join(ROOT, path), 'utf8');

    for (const key of ['principles', 'personas', 'surfaces']) {
      expect(content).toContain(`paths.${key}`);
      expect(content).toContain(`${key}.md`);
    }
    expect(content).toMatch(/scaffold/i);
    expect(content).toMatch(/preserv/i);
    expect(content).toMatch(/missing/i);
    expect(content).toMatch(/orphan/i);
    expect(content).toMatch(/never deletes? user/i);
  });
});
