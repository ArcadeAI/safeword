import { describe, expect, it } from 'vitest';

import { readRepoFile as read } from './helpers';

describe('lean Product Plan intake', () => {
  it('replaces the separate Intake Brief with one decision-bearing Product Bet', () => {
    const spec = read('packages/cli/templates/spec-template.md');
    expect(spec).toContain('## Product Bet');
    expect(spec).toContain('**Problem / Why now:**');
    expect(spec).toContain('**Success threshold:**');
    expect(spec).not.toContain('## Intake Brief');
  });

  it('keeps demand research conditional rather than mandatory intake work', () => {
    const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('unresolved,\ndecision-critical demand claim');
    expect(discovery).toContain('cheaper\nexperiment');
  });

  it('rejects template prose as a falsifiable success threshold', () => {
    const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('restated template prompt is not a threshold');
  });

  it('requires an authored success threshold that can be disproven', () => {
    const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('outcome could be disproven');
  });

  it('requires a persona-facing, observable Killer Demo payoff', () => {
    const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('Template\nprompts or generic restatements do not qualify');
    expect(discovery).toContain('persona-facing before/after change');
    expect(discovery).toContain('Proof must make it observable');
  });
});
