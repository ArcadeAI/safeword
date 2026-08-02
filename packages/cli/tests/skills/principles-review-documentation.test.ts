import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const read = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

const QUALITY_REVIEW_SURFACES = [
  'packages/cli/templates/skills/quality-review/SKILL.md',
  '.claude/skills/quality-review/SKILL.md',
  'packages/cli/codex-plugin/skills/quality-review/SKILL.md',
];

const AUDIT_SURFACES = [
  'packages/cli/templates/skills/audit/SKILL.md',
  '.claude/skills/audit/SKILL.md',
  'packages/cli/codex-plugin/skills/audit/SKILL.md',
];

describe('principles in independent review', () => {
  it.each(QUALITY_REVIEW_SURFACES)(
    '%s reconciles declared principles against shipped proof',
    path => {
      const content = read(path);

      expect(content).toContain('paths.principles');
      expect(content).toContain('impl-plan.md');
      expect(content).toMatch(/principle[\s\S]*consequence[\s\S]*proof/i);
      expect(content).toMatch(/experiential[\s\S]*tests alone/i);
      expect(content).toMatch(/primary sources/i);
    },
  );

  it.each(AUDIT_SURFACES)('%s checks trace integrity without judging principle quality', path => {
    const content = read(path);

    expect(content).toMatch(/principle trace/i);
    expect(content).toContain('paths.principles');
    expect(content).toMatch(/observable facts only/i);
    expect(content).toMatch(/do not judge[\s\S]*applicab/i);
    expect(content).toMatch(/E010/);
  });
});
