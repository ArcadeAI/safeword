import { describe, expect, it } from 'vitest';

import { readRepoFile } from '../helpers';

describe('bounded demand research contract', () => {
  const skill = readRepoFile('packages/cli/templates/skills/demand-research/SKILL.md').replaceAll(
    /\s+/gu,
    ' ',
  );
  const discovery = readRepoFile('packages/cli/templates/skills/bdd/DISCOVERY.md').replaceAll(
    /\s+/gu,
    ' ',
  );

  it('keeps the useful decision output and explicit no-busy-work exclusions', () => {
    for (const token of [
      'PRESENT',
      'WEAK',
      'ABSENT',
      'UNAVAILABLE',
      'Strongest evidence',
      'Gaps',
      'Cheapest validation',
    ]) {
      expect(skill).toContain(token);
    }
    for (const exclusion of [
      'child features',
      'mandated work',
      'parity work',
      'cheaper experiment',
    ]) {
      expect(skill).toContain(exclusion);
    }
    expect(skill).not.toMatch(
      /30[-–]40|vendor landscape|competitor history|market history|\bF\d+\b/i,
    );
    expect(skill).not.toMatch(/allowed-tools:\s*['"]?\*/i);
  });

  it('routes Product Bet research conditionally and reconciles children at intake exit', () => {
    expect(discovery).toContain('unresolved, decision-critical demand claim');
    expect(discovery).toContain('user explicitly requests demand research');
    expect(discovery).toContain('safeword ticket reconcile-parent <ticket-id>');
    expect(discovery).toContain('Immediately before changing a child');
  });

  it('uses existing decision-bearing evidence before external research', () => {
    expect(skill).toContain('Start with first-party evidence');
  });

  it('documents anti-confirmation-bias controls without a separate audit', () => {
    expect(skill).toMatch(/Frame the single decision neutrally/i);
    expect(skill).toMatch(/Do not frame the task as proving demand/i);
    expect(skill).toMatch(/seek the strongest evidence against demand/i);
    expect(skill).toMatch(/supporting and contradicting evidence together/i);
    expect(skill).toMatch(/instead of resolving it in the sponsor's favor/i);
  });

  it('documents absent and unavailable verdicts as advisory evidence states', () => {
    expect(skill).toContain(
      '`ABSENT` and `UNAVAILABLE` are evidence states, not approval blockers',
    );
  });

  it('reports unavailable evidence without inventing demand strength', () => {
    expect(skill).toContain('UNAVAILABLE');
    expect(skill).toMatch(/Do not\s+invent evidence/i);
  });
});
