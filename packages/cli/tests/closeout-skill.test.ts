import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const canonicalSkillPath = nodePath.join(
  repoRoot,
  'packages/cli/templates/skills/closeout/SKILL.md',
);

function canonicalSkill(): string {
  expect(existsSync(canonicalSkillPath), 'canonical closeout skill must be shipped').toBe(true);
  return existsSync(canonicalSkillPath) ? readFileSync(canonicalSkillPath, 'utf8') : '';
}

describe('closeout delivery evidence (93C14D NTB1.R1)', () => {
  it('requires current local and hosted evidence before merge or cleanup', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('current pull request head');
    expect(skill).toContain('required checks');
    expect(skill).toContain('review requirements');
    expect(skill).toContain('draft');
    expect(skill).toMatch(/no merge or cleanup/i);
    expect(skill).not.toMatch(/merge command.*proves.*merged/i);
  });
});
