/**
 * Doc-presence guard for the ADR consultation procedure (ticket K4BWTQ).
 * Covers test-definitions.md Rule 3 — both the canonical templates copy and
 * the dogfood copy must teach the consultation step, the canonical
 * "None recorded yet" copy, and the first-ADR prompt with both branches.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.join(__dirname, '../../../..');
const copies = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/bdd/SCENARIOS.md'),
  nodePath.join(repoRoot, '.claude/skills/bdd/SCENARIOS.md'),
];

describe('ADR consultation docs (Rule 3)', () => {
  for (const scenariosPath of copies) {
    const label = scenariosPath.includes('templates') ? 'canonical' : 'dogfood';

    it(`${label} SCENARIOS.md documents the consultation procedure`, () => {
      const content = readFileSync(scenariosPath, 'utf8');
      expect(content, 'consultation step (read records at the configured location)').toMatch(
        /architecture record|paths\.architecture/,
      );
      expect(content, 'canonical no-records copy').toContain('None recorded yet');
      expect(content, 'first-ADR prompt').toMatch(/first ADR/i);
    });
  }
});
