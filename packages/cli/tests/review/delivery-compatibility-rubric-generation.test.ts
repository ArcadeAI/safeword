import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const skillPath = nodePath.join(packageRoot, 'templates/skills/bdd/PLAN_EXECUTION.md');
const generatedPath = nodePath.join(
  packageRoot,
  'src/review/delivery-compatibility-rubric.generated.ts',
);
const startMarker = '<!-- SAFEWORD:DELIVERY_COMPATIBILITY_RUBRIC_START -->';
const endMarker = '<!-- SAFEWORD:DELIVERY_COMPATIBILITY_RUBRIC_END -->';

describe('delivery compatibility rubric generation', () => {
  it('packages the exact compatibility judgment from the canonical Execution Planning contract', () => {
    expect(existsSync(skillPath), 'canonical Execution Planning contract').toBe(true);
    expect(existsSync(generatedPath), 'generated compatibility reviewer rubric').toBe(true);

    const skill = readFileSync(skillPath, 'utf8');
    expect(skill.split(startMarker)).toHaveLength(2);
    expect(skill.split(endMarker)).toHaveLength(2);
    const start = skill.indexOf(startMarker) + startMarker.length;
    const end = skill.indexOf(endMarker);
    const rubric = skill.slice(start, end).trim();
    const readableRubric = rubric.replaceAll('*', '').replaceAll(/\s+/gu, ' ');
    const generated = readFileSync(generatedPath, 'utf8');

    expect(generated).toContain(JSON.stringify(rubric));
    for (const requirement of [
      'Does the earlier passing receipt still establish this retained proof boundary at the reviewed revision?',
      'every changed hunk',
      'tests, fixtures, command inputs, configuration, or dependencies',
      'complete bounded diff',
      'irrelevant to the retained proof boundary',
    ]) {
      expect(readableRubric).toContain(requirement);
    }
  });
});
