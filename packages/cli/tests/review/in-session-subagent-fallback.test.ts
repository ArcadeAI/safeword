import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const cliRoot = nodePath.resolve(import.meta.dirname, '../..');

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
      expect(guide).toContain('must not satisfy `crossAgentReview: require`');
    }
  });
});
