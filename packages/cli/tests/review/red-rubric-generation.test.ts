import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { EXECUTABLE_RED_REVIEW_RUBRIC } from '../../src/review/red-rubric.generated.js';
import { extractExecutableRedRubric } from '../../src/review/red-rubric.js';

describe('executable RED rubric generation', () => {
  it('keeps runtime attribution rules equal to the canonical TDD-review skill', () => {
    const skill = readFileSync(
      nodePath.resolve(import.meta.dirname, '../../templates/skills/tdd-review/SKILL.md'),
      'utf8',
    );

    expect(EXECUTABLE_RED_REVIEW_RUBRIC).toBe(extractExecutableRedRubric(skill));
  });

  it('accepts the intended actor-boundary assertion as executable RED evidence', () => {
    expect(EXECUTABLE_RED_REVIEW_RUBRIC).toContain('syntax, imports, fixtures, configuration');
  });

  it.each([
    'syntax',
    'imports',
    'fixtures',
    'configuration',
    'infrastructure',
    'unrelated actor-boundary assertion',
  ])('rejects %s as the wrong executable RED failure reason', failureReason => {
    expect(EXECUTABLE_RED_REVIEW_RUBRIC).toContain(failureReason);
  });

  it.each([
    ['a fresh approved receipt', 'independently confirmed'],
    ['no fresh approved receipt', 'not independently confirmed'],
    ['an author self-review only', 'not independently confirmed'],
    ['cached passing suite status', 'not independently confirmed'],
  ])('describes %s as %s', (reviewState, message) => {
    const workflow = readFileSync(
      nodePath.resolve(import.meta.dirname, '../../templates/skills/bdd/TDD.md'),
      'utf8',
    );
    const normalizedWorkflow = workflow.replaceAll(/\s+/g, ' ');

    expect(normalizedWorkflow).toContain(reviewState);
    expect(normalizedWorkflow).toContain(message);
  });
});
