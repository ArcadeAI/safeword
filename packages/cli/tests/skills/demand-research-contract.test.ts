import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const root = nodePath.resolve(import.meta.dirname, '../../../..');

function read(path: string): string {
  return readFileSync(nodePath.join(root, path), 'utf8');
}

describe('bounded demand research contract', () => {
  it('keeps the useful decision output and explicit no-busy-work exclusions', () => {
    const skill = read('packages/cli/templates/skills/demand-research/SKILL.md');
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
    const discovery = read('packages/cli/templates/skills/bdd/DISCOVERY.md');
    expect(discovery).toContain('unresolved,\ndecision-critical demand claim');
    expect(discovery).toContain('user explicitly requests demand research');
    expect(discovery).toContain('safeword ticket reconcile-parent <ticket-id>');
    expect(discovery).toContain('Immediately before changing a child');
  });
});
