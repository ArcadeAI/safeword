/**
 * Doc-presence guard for the implement-exit reconciliation step (ticket
 * ERVA6V). Covers test-definitions.md Rule 3 — both the canonical templates
 * copy and the dogfood copy of TDD.md must teach the reconciliation walk,
 * the status flip, and a worked example with a changed decision.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.join(__dirname, '../../../..');
const copies = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/bdd/TDD.md'),
  nodePath.join(repoRoot, '.claude/skills/bdd/TDD.md'),
];

describe('reconciliation docs (Rule 3)', () => {
  for (const tddPath of copies) {
    const label = tddPath.includes('templates') ? 'canonical' : 'dogfood';

    it(`${label} TDD.md documents the implement-exit reconciliation`, () => {
      const content = readFileSync(tddPath, 'utf8');
      expect(
        content,
        'reconciliation walk (Decisions / Arch alignment / Assessment triggers)',
      ).toMatch(/reconcile/i);
      expect(content, 'walks the Decisions section').toContain('Decisions');
      expect(content, 'moves drift to Known deviations').toContain('Known deviations');
      expect(content, 'status flip').toContain('**Status:** implemented');
      expect(content, 'worked example with a changed decision').toMatch(
        /changed.*mid-implementation|mid-implementation.*changed/i,
      );
    });
  }
});
