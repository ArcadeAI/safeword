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
});
