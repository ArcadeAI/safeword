import { describe, expect, it } from 'vitest';

import { readRepoFile as read } from './helpers';

const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md').replaceAll(/\s+/gu, ' ');

describe('lean Product Plan intake', () => {
  it('replaces the separate Intake Brief with one decision-bearing Product Bet', () => {
    const spec = read('packages/cli/templates/spec-template.md');
    expect(spec).toContain('## Product Bet');
    expect(spec).toContain('**Problem / Why now:**');
    expect(spec).toContain('**Success threshold:**');
    expect(spec).not.toContain('## Intake Brief');
  });

  it('keeps demand research conditional rather than mandatory intake work', () => {
    expect(discovery).toContain('unresolved, decision-critical demand claim');
    expect(discovery).toContain('cheaper experiment');
  });

  it('rejects template prose as a falsifiable success threshold', () => {
    expect(discovery).toContain('restated template prompt is not a threshold');
  });

  it('requires an authored success threshold that can be disproven', () => {
    expect(discovery).toContain('outcome could be disproven');
  });

  it('documents observable outcomes instead of inventing metrics', () => {
    expect(discovery).toContain('use an observable outcome when no honest metric exists');
  });

  it('requires a desirable, falsifiable Killer Demo in one sentence', () => {
    const spec = read('packages/cli/templates/spec-template.md');
    expect(discovery).toContain('understand, believe, and want');
    expect(discovery).toContain('realistic inputs, visible evidence');
    expect(discovery).toContain('prove it is not a trick');
    expect(spec).toContain(
      '> For <audience> starting with <real pain>, <decisive action> produces <unmistakably better outcome>, visibly proven by <evidence>, within <boundary>.',
    );
    expect(spec).not.toContain('- **Audience:**');
  });

  it('aligns the four plan sections and canonical persona code across instructions and template', () => {
    const instructions = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    const spec = read('packages/cli/templates/spec-template.md');
    const plan = instructions
      .split('## Full Product Plan', 2)[1]
      ?.split('## Child contribution', 1)[0];
    expect(plan?.replaceAll(/```[\s\S]*?```/gu, '').match(/^### .+$/gm)).toEqual([
      '### Product Bet',
      '### Jobs To Be Done',
      '### Shape',
      '### Killer Demo',
    ]);
    expect(spec).toContain('**Persona:** <canonical persona> (`<persona-code>`)');
  });
});
