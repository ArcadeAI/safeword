import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { adaptReviewerLoginGuidance } from '../../src/review/login-guidance.js';

const templates = [
  'skills/bdd/PLAN_IMPLEMENTATION.md',
  'skills/bdd/TDD.md',
  'skills/quality-review/SKILL.md',
  'skills/review-spec/SKILL.md',
];

describe('plugin reviewer sign-in guidance', () => {
  it.each(templates)('replaces the shell recovery text in %s', relativePath => {
    const template = readFileSync(
      nodePath.resolve(import.meta.dirname, '../../templates', relativePath),
      'utf8',
    );
    const adapted = adaptReviewerLoginGuidance(template);

    expect(adapted).toContain('mcp__safeword_review__start_reviewer_login');
    expect(adapted).not.toContain('execute its exact recovery command');
  });
});
