/**
 * Doc-presence guard for the harness degraded-path branch (ticket CNGBNT).
 * Both the canonical templates copy and the dogfood copy of TDD.md must
 * document the implement-entry harness check and the graceful-degradation
 * branch (existing service test patterns + follow-up recommendation).
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.join(__dirname, '../../../..');
const copies = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/bdd/TDD.md'),
  nodePath.join(repoRoot, '.claude/skills/bdd/TDD.md'),
];

describe('harness degraded-path docs (CNGBNT)', () => {
  for (const tddPath of copies) {
    const label = tddPath.includes('templates') ? 'canonical' : 'dogfood';

    it(`${label} TDD.md documents the harness check and degraded path`, () => {
      const content = readFileSync(tddPath, 'utf8');
      expect(content, 'harness availability check at entry').toMatch(/harness/i);
      expect(content, 'degraded branch keeps R/G/R discipline').toMatch(/existing test patterns/i);
      expect(content, 'work-log annotation when degrading').toMatch(/Harness absent/);
      expect(content, 'follow-up recommendation').toMatch(/follow-up ticket/i);
    });
  }
});
