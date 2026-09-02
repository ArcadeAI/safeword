import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const root = nodePath.resolve(import.meta.dirname, '../../../..');

function read(path: string): string {
  return readFileSync(nodePath.join(root, path), 'utf8');
}

describe('bounded demand research contract', () => {
  const skill = read('packages/cli/templates/skills/demand-research/SKILL.md');
  const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');

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
    expect(skill).not.toMatch(/30[-–]40|vendor landscape|competitor history|F\d+/i);
  });

  it('routes Product Bet research conditionally and reconciles children at intake exit', () => {
    expect(discovery).toContain('unresolved,\ndecision-critical demand claim');
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

  it('honors an explicit demand-research request', () => {
    expect(discovery).toContain('user explicitly requests demand research');
  });

  it('routes unresolved decision-critical demand to research', () => {
    expect(discovery).toContain('unresolved,\ndecision-critical demand claim');
  });

  it('keeps child features out of repeated demand research', () => {
    expect(skill).toContain('child features');
  });

  it('prefers a cheaper experiment when it can settle the decision', () => {
    expect(skill).toContain('cheaper experiment');
  });

  it('excludes mandated work from automatic demand research', () => {
    expect(skill).toContain('mandated work');
  });

  it('excludes parity work from automatic demand research', () => {
    expect(skill).toContain('parity work');
  });

  it('keeps an absent verdict advisory rather than blocking', () => {
    expect(skill).toContain('ABSENT');
    expect(skill).toMatch(/not approval blockers/i);
  });

  it('records an inconclusive result as an absent evidence state', () => {
    expect(skill).toMatch(/ABSENT.*evidence states/is);
  });

  it('excludes general market-history and vendor-research modes', () => {
    expect(skill).not.toMatch(/vendor landscape|competitor history|market history/i);
  });

  it('reports unavailable evidence without inventing demand strength', () => {
    expect(skill).toContain('UNAVAILABLE');
    expect(skill).toMatch(/Do not\s+invent evidence/i);
  });
});
