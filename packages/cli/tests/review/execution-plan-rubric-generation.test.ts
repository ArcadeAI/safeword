import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const skillPath = nodePath.join(packageRoot, 'templates/skills/bdd/PLAN_EXECUTION.md');
const artifactPath = nodePath.join(
  packageRoot,
  'templates/doc-templates/execution-plan-template.md',
);
const generatedPath = nodePath.join(packageRoot, 'src/review/execution-plan-rubric.generated.ts');
const startMarker = '<!-- SAFEWORD:EXECUTION_PLAN_RUBRIC_START -->';
const endMarker = '<!-- SAFEWORD:EXECUTION_PLAN_RUBRIC_END -->';

describe('Execution Plan contract generation', () => {
  it('packages one author/reviewer contract with every slicing obligation', () => {
    expect(existsSync(skillPath), 'canonical Execution Planning contract').toBe(true);
    expect(existsSync(artifactPath), 'Execution Plan artifact template').toBe(true);
    expect(existsSync(generatedPath), 'generated reviewer rubric').toBe(true);

    const skill = readFileSync(skillPath, 'utf8');
    expect(skill.split(startMarker)).toHaveLength(2);
    expect(skill.split(endMarker)).toHaveLength(2);
    const start = skill.indexOf(startMarker) + startMarker.length;
    const end = skill.indexOf(endMarker);
    const rubric = skill.slice(start, end).trim();
    const generated = readFileSync(generatedPath, 'utf8');

    expect(generated).toContain(JSON.stringify(rubric));
    expect(generated).toContain(
      `export const EXECUTION_PLAN_REVIEW_RUBRIC_SHA256 = ${JSON.stringify(
        createHash('sha256').update(rubric).digest('hex'),
      )};`,
    );
    for (const obligation of [
      'Slicing decision',
      'Complete slices',
      'Startable steps',
      'Dependency safety',
      'Conceptual reviewability',
      'Obligation and decision preservation',
      'Scenario and approach coverage',
      'Proof quality',
      'Checklist completeness and applicability',
    ]) {
      expect(rubric).toContain(`- **${obligation}:**`);
    }
  });

  it('templates the fields needed for an independently reviewable slice', () => {
    const artifact = readFileSync(artifactPath, 'utf8');

    expect(artifact).toContain('**Decision:**');
    for (const field of [
      '**Purpose:**',
      '**Boundary:**',
      '**Prerequisites:**',
      '**Proof:**',
      '**Completion signal:**',
      '**Relies on an unmerged successor:**',
    ]) {
      expect(artifact).toContain(field);
    }
    expect(artifact).toContain('## Obligation ownership');
    expect(artifact).toContain('## Decision accounting');
    expect(artifact).toContain('## Proof specifications');
    expect(artifact).toContain('<!-- safeword:delivery-checklist:v1 -->');
    expect(artifact).toContain('| Proof ID');
    expect(artifact).toContain('| ID');
  });
});
