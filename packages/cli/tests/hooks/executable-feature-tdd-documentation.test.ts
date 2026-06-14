import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const bddSkillCopies = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/bdd'),
  nodePath.join(repoRoot, '.agents/skills/bdd'),
  nodePath.join(repoRoot, '.claude/skills/bdd'),
];

describe('executable feature-source TDD documentation (ZA0JQR)', () => {
  it.each(bddSkillCopies)('%s explains how feature scenarios become executable', skillDirectory => {
    const tdd = readFileSync(nodePath.join(skillDirectory, 'TDD.md'), 'utf8');
    const scenarios = readFileSync(nodePath.join(skillDirectory, 'SCENARIOS.md'), 'utf8');

    expect(tdd).toContain('Cucumber step definitions');
    expect(tdd).toContain('test:bdd');
    expect(tdd).toContain('Vitest');
    expect(scenarios).toContain('implementation stubs');
    expect(scenarios).toContain('acceptance proof');
  });
});
