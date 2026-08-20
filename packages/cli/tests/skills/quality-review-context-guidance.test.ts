import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const QUALITY_REVIEW_SKILLS = [
  'packages/cli/templates/skills/quality-review/SKILL.md',
  '.claude/skills/quality-review/SKILL.md',
  '.safeword/skills/quality-review/SKILL.md',
  'packages/cli/codex-plugin/skills/quality-review/SKILL.md',
] as const;

describe('quality-review supporting context guidance', () => {
  it.each(QUALITY_REVIEW_SKILLS)('%s keeps review targets distinct from minimum context', path => {
    const content = readFileSync(nodePath.join(repoRoot, path), 'utf8');

    expect(content).toContain('Keep each work-product under review as a target');
    expect(content).toContain('minimum directly relevant supporting evidence');
    expect(content).toContain('--context path/to/evidence');
    expect(content).toMatch(/source, test, contract, or plan/u);
    expect(content).toContain('Do not dump the repository');
    expect(content).toContain('context is not additional work under review');
  });
});
