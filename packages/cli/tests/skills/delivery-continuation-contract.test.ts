import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const readRaw = (path: string): string => {
  const fullPath = nodePath.join(repoRoot, path);
  expect(existsSync(fullPath), `missing installed guidance: ${path}`).toBe(true);
  return readFileSync(fullPath, 'utf8');
};
const read = (path: string): string => readRaw(path).replaceAll(/\s+/gu, ' ');

const tddCopies = [
  'packages/cli/templates/skills/bdd/TDD.md',
  '.safeword/skills/bdd/TDD.md',
  '.claude/skills/bdd/TDD.md',
  'packages/cli/codex-plugin/skills/bdd/references/TDD.md',
];

const prReadinessCopies = [
  'packages/cli/templates/skills/pr-readiness/SKILL.md',
  '.safeword/skills/pr-readiness/SKILL.md',
  '.claude/skills/pr-readiness/SKILL.md',
  'packages/cli/codex-plugin/skills/pr-readiness/SKILL.md',
];

const unsuccessfulSteps = [
  {
    outcome: 'RED proof passes',
    current: 'RED',
    evidence: 'proof passed',
    following: 'implementation',
  },
  {
    outcome: 'GREEN check fails',
    current: 'GREEN',
    evidence: 'check failed',
    following: 'refactor',
  },
];

describe('installed delivery continuation contract', () => {
  it.each(tddCopies)('%s advances from approved RED without a routine prompt', path => {
    const content = read(path);

    expect(content).toContain(
      'After an approved RED, continue directly into implementation without asking whether to proceed.',
    );
  });

  it('routes Cursor TDD guidance to the canonical installed contract', () => {
    expect(read('.cursor/rules/bdd-tdd.mdc')).toContain('@.safeword/skills/bdd/TDD.md');
  });

  it.each(tddCopies)('%s advances from GREEN through refactor to the next scenario', path => {
    const content = read(path);

    expect(content).toContain(
      'After GREEN, continue through refactor and then start the next incomplete scenario without asking whether to proceed.',
    );
  });

  it.each(tddCopies.flatMap(path => unsuccessfulSteps.map(step => ({ path, ...step }))))(
    '$path keeps $outcome at its failing evidence',
    ({ path, outcome, current, evidence, following }) => {
      const content = readRaw(path);
      expect(content).toContain('### Trusted executable RED review');
      const section =
        content
          .split(
            'An unsuccessful TDD step stays at the failing step and reports its evidence:',
            2,
          )[1]
          ?.split('### Trusted executable RED review', 1)[0] ?? '';
      const rows = section
        .split('\n')
        .filter(line => line.startsWith('|'))
        .filter(line => line.split('|', 2)[1]?.trim() === outcome);

      expect(rows, `missing unhealthy-step directive for ${outcome}`).toHaveLength(1);
      const cells = rows[0]?.split('|').map(cell => cell.trim()) ?? [];
      expect(cells).toHaveLength(5);
      const directive = cells[2] ?? '';
      expect(directive).toContain(current);
      expect(directive).toContain(evidence);
      expect(directive.toLowerCase()).not.toContain(following.toLowerCase());
    },
  );

  it.each(tddCopies)('%s closes the whole ticket after the final scenario', path => {
    expect(read(path)).toContain(
      'After the final scenario, continue in order through whole-ticket review, plan reconciliation, verification, audit, and recorded ticket closure without asking whether to proceed.',
    );
  });

  it.each(prReadinessCopies)('%s returns from Draft evidence to delivery', path => {
    const content = readRaw(path);
    expect(content).toContain('## Observe and preserve');
    expect(content).toContain('## Seven hard Ready-for-Review gates');
    const draftSection = content
      .split('## Observe and preserve', 2)[1]
      ?.split('## Seven hard Ready-for-Review gates', 1)[0]
      .replaceAll(/\s+/gu, ' ');

    expect(draftSection).toContain(
      'After creating a Draft pull request for evidence, return directly to the next unfinished delivery step instead of reporting the change ready for review.',
    );
  });

  it('routes Cursor PR-readiness guidance to the canonical installed contract', () => {
    expect(read('.cursor/rules/safeword-pr-readiness.mdc')).toContain(
      '@.safeword/skills/pr-readiness/SKILL.md',
    );
  });
});
