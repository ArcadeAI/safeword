import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const templates = nodePath.resolve(import.meta.dirname, '../../templates');

function readTemplate(relativePath: string): string {
  return readFileSync(nodePath.join(templates, relativePath), 'utf8');
}

describe('class-1 review surface parity', () => {
  it.each([
    ['skills/quality-review/SKILL.md', 'quality-review'],
    ['skills/review-spec/SKILL.md', 'scenario-gate'],
    ['skills/bdd/SKILL.md', 'scenario-gate'],
    ['skills/bdd/PLAN_IMPLEMENTATION.md', 'plan-implementation'],
    ['skills/bdd/TDD.md', 'plan-implementation'],
  ])('%s enters the shared %s coordinator', (relativePath, kind) => {
    expect(readTemplate(relativePath), relativePath).toContain(`safeword review run ${kind}`);
  });

  it.each([
    'skills/audit/SKILL.md',
    'skills/verify/SKILL.md',
    'skills/tdd-review/SKILL.md',
    'skills/refactor/SKILL.md',
  ])('%s stays outside the class-1 coordinator', relativePath => {
    expect(readTemplate(relativePath), relativePath).not.toContain('safeword review run');
  });
});
