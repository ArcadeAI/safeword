import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

function read(relativePath: string): string {
  return readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
}

describe('intake brief rung-0 (NWFT20)', () => {
  it('spec-template.md carries an Intake Brief section, after Intent, with the three fields', () => {
    const spec = read('packages/cli/templates/spec-template.md');
    expect(spec).toContain('## Intake Brief');
    // Placed after Intent (the positive "why"), before Jobs To Be Done.
    expect(spec.indexOf('## Intent')).toBeLessThan(spec.indexOf('## Intake Brief'));
    expect(spec.indexOf('## Intake Brief')).toBeLessThan(spec.indexOf('## Jobs To Be Done'));
    const lower = spec.toLowerCase();
    expect(lower).toContain('requested by');
    expect(lower).toContain('cost of inaction');
    expect(lower).toContain('reversibility');
  });

  it('DISCOVERY.md authors the brief as rung 0 and folds it into the JTBD gate with a triage question', () => {
    const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('Intake Brief');
    // Rung 0: the brief step precedes the Jobs To Be Done step.
    expect(discovery.indexOf('Author Intake Brief')).toBeGreaterThan(-1);
    expect(discovery.indexOf('Author Intake Brief')).toBeLessThan(
      discovery.indexOf('Author Jobs To Be Done'),
    );
    // The feature-vs-task triage question earns the brief its place.
    expect(discovery.toLowerCase()).toContain('feature, or a task');
  });
});
