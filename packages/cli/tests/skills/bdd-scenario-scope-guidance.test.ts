import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const scenarioGuides = [
  'packages/cli/templates/skills/bdd/SCENARIOS.md',
  '.safeword/skills/bdd/SCENARIOS.md',
  '.claude/skills/bdd/SCENARIOS.md',
  'packages/cli/codex-plugin/skills/bdd/references/SCENARIOS.md',
  'plugin/skills/bdd/SCENARIOS.md',
];

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

describe('BDD scenario scope guidance', () => {
  it.each(scenarioGuides)('%s separates acceptance examples from contract matrices', path => {
    const content = read(path);

    expect(content).toContain('Keep acceptance examples representative');
    expect(content).toContain('table-driven lower-level tests');
    expect(content).toContain('Keep one Rule boundary');
    expect(content).toContain('Keep outlines coherent');
  });

  it.each(reviewGuides)('%s reviews cross-Rule outcomes and incoherent outlines', path => {
    const content = read(path);

    expect(content).toContain('an outcome owned by a different Rule');
    expect(content).toContain('rows vary one behavioral dimension');
    expect(content).toContain('table-driven lower-level tests');
  });

  it.each(tddGuides)('%s requires manual and live scenarios to own their evidence', path => {
    const content = read(path);

    expect(content).toContain('needs its own recorded');
    expect(content).toMatch(/cannot\s+lend it their evidence/u);
  });
});
