import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const bddTddCopies = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/bdd/TDD.md'),
  nodePath.join(repoRoot, '.claude/skills/bdd/TDD.md'),
];

const tddReviewCopies = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/tdd-review/SKILL.md'),
  nodePath.join(repoRoot, '.claude/skills/tdd-review/SKILL.md'),
];

function expectSectionBetween(content: string, start: string, end: string): string {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end, startIndex + start.length);

  expect(startIndex, `missing section ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing section ${end}`).toBeGreaterThan(startIndex);

  return content.slice(startIndex, endIndex);
}

describe('scenario proof fidelity documentation (issue #1698)', () => {
  it.each(bddTddCopies)('%s preserves the scenario action boundary', path => {
    const content = readFileSync(path, 'utf8');

    expect(content).toContain('Scenario proof fidelity');
    expect(content).toContain('actor-facing entry point');
    expect(content).toMatch(/direct\s+application-store call/);
    expect(content).toContain('injected lower-level browser event');
  });

  it.each(bddTddCopies)('%s preserves the scenario result boundary', path => {
    const content = readFileSync(path, 'utf8');

    expect(content).toContain('actor-visible result');
    expect(content).toMatch(/Store, editor, or component\s+state is supporting evidence/);
    expect(content).toContain("Assert the result's material values");
    expect(content).toContain('A proxy property is not enough');
    expect(content).toContain('Assert attempt order only when that order is part of the promised');
  });

  it.each(bddTddCopies)('%s keeps setup and lower-level checks proportionate', path => {
    const content = readFileSync(path, 'utf8');

    expect(content).toContain('Setup shortcuts belong in `Given`');
    expect(content).toContain('supporting evidence');
  });

  it.each(bddTddCopies)('%s reports unavailable automation without overclaiming', path => {
    const content = readFileSync(path, 'utf8');

    expect(content).toContain('does not prove');
    expect(content).toContain('@manual');
    expect(content).toContain('@live');
  });

  it.each(tddReviewCopies)('%s checks scenario fidelity at RED and REFACTOR', path => {
    const content = readFileSync(path, 'utf8');
    const redReview = expectSectionBetween(content, '## After RED', '## After GREEN');
    const refactorReview = expectSectionBetween(
      content,
      '## After REFACTOR',
      '### Concrete example',
    );

    for (const review of [redReview, refactorReview]) {
      expect(review).toContain('Scenario fidelity?');
      expect(review).toContain('actor-facing entry point');
      expect(review).toContain('actor-visible result');
    }
  });
});
