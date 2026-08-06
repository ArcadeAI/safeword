import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');
const repoRoot = nodePath.resolve(cliRoot, '../..');

function template(relativePath: string): string {
  return readFileSync(nodePath.join(cliRoot, 'templates', relativePath), 'utf8');
}

describe('in-session review fallback guidance', () => {
  it('uses one fresh-context leaf subagent only after every CLI route is exhausted', () => {
    const qualityReview = template('skills/quality-review/SKILL.md');

    expect(qualityReview).toContain('REVIEW_ROUTES_EXHAUSTED');
    expect(qualityReview).toContain('exactly one fresh-context subagent');
    expect(qualityReview).toContain('must not call `safeword review run` or delegate again');
  });

  it('keeps the host fallback degraded and unable to satisfy require policy', () => {
    const reviewGuides = [
      template('skills/quality-review/SKILL.md'),
      template('skills/bdd/SKILL.md'),
      template('skills/bdd/TDD.md'),
      template('skills/bdd/PLAN_IMPLEMENTATION.md'),
    ];

    for (const guide of reviewGuides) {
      expect(guide).toContain('in-session subagent');
      expect(guide).toContain('`degraded`');
      expect(guide).toMatch(/must not satisfy\s+`crossAgentReview: require`/u);
    }
  });

  it('ships the fallback contract to the dogfood and native-plugin surfaces', () => {
    const installedGuides = [
      '.claude/skills/quality-review/SKILL.md',
      '.safeword/skills/quality-review/SKILL.md',
      'packages/cli/codex-plugin/skills/quality-review/SKILL.md',
      'plugin/skills/quality-review/SKILL.md',
      '.claude/skills/bdd/SKILL.md',
      'packages/cli/codex-plugin/skills/bdd/SKILL.md',
      'plugin/skills/bdd/SKILL.md',
    ];

    for (const relativePath of installedGuides) {
      const guide = readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
      expect(guide).toContain('REVIEW_ROUTES_EXHAUSTED');
      expect(guide).toContain('in-session subagent');
    }
  });
});
