import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const reviewGuides = [
  'packages/cli/templates/skills/review-spec/SKILL.md',
  '.safeword/skills/review-spec/SKILL.md',
  '.claude/skills/review-spec/SKILL.md',
  'packages/cli/codex-plugin/skills/review-spec/SKILL.md',
  'plugin/skills/review-spec/SKILL.md',
];

const tddGuides = [
  'packages/cli/templates/skills/bdd/TDD.md',
  '.safeword/skills/bdd/TDD.md',
  '.claude/skills/bdd/TDD.md',
  'packages/cli/codex-plugin/skills/bdd/references/TDD.md',
  'plugin/skills/bdd/TDD.md',
];

const read = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

const normalized = (relativePath: string): string => read(relativePath).replaceAll(/\s+/gu, ' ');

describe('BDD scenario scope guidance', () => {
  it.each(reviewGuides)('%s separates acceptance examples from contract matrices', path => {
    const content = normalized(path);

    expect(content).toContain('Keep acceptance examples representative');
    expect(content).toContain('table-driven lower-level tests');
    expect(content).toContain('Keep one numbered Rule boundary');
    expect(content).toContain('Keep outlines coherent');
  });

  it.each(reviewGuides)('%s reviews cross-Rule outcomes and incoherent outlines', path => {
    const content = normalized(path);

    expect(content).toContain(
      'An outcome owned by a different Rule is a lineage defect, not an atomicity defect',
    );
    expect(content).toContain('rows vary one behavioral dimension');
    expect(content).toContain('table-driven lower-level tests');
  });

  it.each(tddGuides)('%s requires manual and live scenarios to own their evidence', path => {
    const content = normalized(path);

    expect(content).toContain(
      'record the command or steps performed, observed result, and retained evidence identity in the ticket work log',
    );
    expect(content).toContain(
      'fixtures and lower-level tests may de-risk it, but cannot lend it their evidence',
    );
    expect(content).toContain('This annotation is agent-attested evidence');
    expect(content).toContain('Manual/live evidence uses the separate path above');
  });
});
