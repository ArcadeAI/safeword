import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (path: string): string => readFileSync(nodePath.join(repoRoot, path), 'utf8');

const bddRoots = [
  'packages/cli/templates/skills/bdd',
  '.safeword/skills/bdd',
  '.claude/skills/bdd',
];

const reviewSpecCopies = [
  'packages/cli/templates/skills/review-spec/SKILL.md',
  '.safeword/skills/review-spec/SKILL.md',
  '.claude/skills/review-spec/SKILL.md',
  'packages/cli/codex-plugin/skills/review-spec/SKILL.md',
];

describe('BDD review evidence contract', () => {
  it.each(bddRoots)('%s keeps pending independent reviews in flight', root => {
    const content = read(`${root}/SKILL.md`).replaceAll(/\s+/gu, ' ');

    expect(content).toContain('`REVIEW_PENDING` is a live review, not a verdict');
    expect(content).toContain('never start a replacement review');
    expect(content).toContain('Only a terminal verdict may advance the phase');
  });

  it.each(bddRoots)('%s requires terminal test evidence for GREEN', root => {
    const content = read(`${root}/TDD.md`).replaceAll(/\s+/gu, ' ');

    expect(content).toContain(
      'A launched, queued, lock-waiting, timed-out, or still-running command is',
    );
    expect(content).toContain('not GREEN');
    expect(content).toContain('reaches a terminal result');
  });

  it.each(reviewSpecCopies)('%s reconciles scope and challenges proof boundaries', path => {
    const content = read(path).replaceAll(/\s+/gu, ' ');

    expect(content).toContain('material partition in the supplied dimensions context');
    expect(content).toContain(
      'could the proposed test pass while the user-facing claim is still broken?',
    );
    expect(content).toContain('Same-process proof cannot establish caller-exit survival');
    expect(content).toContain('an injected fake cannot establish real CLI wiring');
  });
});
