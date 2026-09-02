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
    expect(skill).not.toMatch(/allowed-tools:\s*['"]?\*/i);
  });

  it('excludes general market-history and vendor-research modes', () => {
    expect(skill).not.toMatch(
      /30[-–]40|vendor landscape|competitor history|market history|\bF\d+\b/i,
    );
  });

  it('keeps child features out of repeated demand research', () => {
    expect(skill).toContain('child features');
  });

  it('excludes mandated work from automatic demand research', () => {
    expect(skill).toContain('mandated work');
  });

  it('excludes parity work from automatic demand research', () => {
    expect(skill).toContain('parity work');
  });

  it('prefers a cheaper experiment when it can settle the decision', () => {
    expect(skill).toContain('cheaper experiment');
  });

  it('honors an explicit demand-research request', () => {
    expect(discovery).toContain('user explicitly requests demand research');
  });

  it('routes unresolved decision-critical demand to research', () => {
    expect(discovery).toContain('unresolved, decision-critical demand claim');
  });

  it('routes Product Bet research conditionally and reconciles children at intake exit', () => {
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
  });

  it('documents inconclusive evidence without sponsor-favoring certainty', () => {
    expect(skill).toContain("state the ambiguity instead of resolving it in the sponsor's favor");
    expect(skill).toContain('Missing negative evidence is unknown, not support');
    expect(skill).toContain(
      '`ABSENT` and `UNAVAILABLE` are evidence states, not approval blockers',
    );
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
