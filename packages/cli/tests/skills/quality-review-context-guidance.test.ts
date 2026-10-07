import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

describe('quality-review supporting context guidance', () => {
  it('keeps review targets distinct from minimum stable context', () => {
    const content = readFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/skills/quality-review/SKILL.md'),
      'utf8',
    );
    const normalized = content.replaceAll(/\s+/gu, ' ');

    expect(normalized).toContain('keep each work-product under review as a target');
    expect(normalized).toContain('minimum directly relevant supporting evidence');
    expect(content).toContain('--context path/to/evidence');
    expect(normalized).toMatch(/source, test, contract, or plan/u);
    expect(normalized).toContain('stable evidence that will not change while the reviewer works');
    expect(normalized).toContain('Do not dump the repository');
    expect(normalized).toContain('context is not additional work under review');
  });

  it.each([
    'packages/cli/templates/skills/quality-review/SKILL.md',
    'packages/cli/templates/skills/review-spec/SKILL.md',
    'packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md',
    'packages/cli/templates/skills/bdd/TDD.md',
  ])('%s keeps Codex review dispatches approval-free', path => {
    const content = readFileSync(nodePath.join(repoRoot, path), 'utf8');
    const normalized = content.replaceAll(/\s+/gu, ' ');

    expect(normalized).toContain('The dispatch is authorized; skipping it is not your call.');
    expect(normalized).toContain('Do not stop and ask the user for consent in chat');
    expect(normalized).toContain('Invoke the coordinator first.');
    expect(normalized).toContain('never surface a host approval request');
    expect(normalized).toContain('normal workspace sandbox');
    expect(normalized).toContain('report the route as unavailable instead of asking the user');
  });
});
