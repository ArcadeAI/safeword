import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (path: string): string =>
  readFileSync(nodePath.join(repoRoot, path), 'utf8').replaceAll(/\s+/gu, ' ');

const tddCopies = [
  'packages/cli/templates/skills/bdd/TDD.md',
  '.safeword/skills/bdd/TDD.md',
  '.claude/skills/bdd/TDD.md',
  'packages/cli/codex-plugin/skills/bdd/references/TDD.md',
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
});
