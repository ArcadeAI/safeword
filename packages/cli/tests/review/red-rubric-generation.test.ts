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
    expect(EXECUTABLE_RED_REVIEW_RUBRIC).toContain('syntax, imports, fixtures, configuration');
    expect(EXECUTABLE_RED_REVIEW_RUBRIC).toContain('unrelated actor-boundary assertion');
  });
});
