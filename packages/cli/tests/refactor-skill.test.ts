import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

const refactorSkillSurfaces: [string, string][] = [
  [
    'template skill',
    readFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/skills/refactor/SKILL.md'),
      'utf8',
    ),
  ],
  [
    'dogfood agents skill',
    readFileSync(nodePath.join(repoRoot, '.agents/skills/refactor/SKILL.md'), 'utf8'),
  ],
  [
    'dogfood claude skill',
    readFileSync(nodePath.join(repoRoot, '.claude/skills/refactor/SKILL.md'), 'utf8'),
  ],
];

describe('refactor skill commit guidance (E5VDEF / #407)', () => {
  it.each(refactorSkillSurfaces)(
    '%s preserves commit-after-green on a clean branch',
    (_name, content) => {
      expect(content).toContain('clean branch');
      expect(content).toContain('commit with `refactor: [what changed]`');
    },
  );

  it.each(refactorSkillSurfaces)(
    '%s prevents mixed feature+refactor commits in dirty worktrees',
    (_name, content) => {
      expect(content).toContain('mixed dirty tree');
      expect(content).toContain('commit only the isolated refactor files');
      expect(content).toContain('defer the commit');
      expect(content).toContain('mixed feature+refactor commit');
    },
  );

  it.each(refactorSkillSurfaces)(
    '%s gives detached HEAD an explicit branch-or-defer path',
    (_name, content) => {
      expect(content).toContain('detached HEAD');
      expect(content).toContain('create or switch to a branch');
      expect(content).toContain('defer the commit');
    },
  );
});
