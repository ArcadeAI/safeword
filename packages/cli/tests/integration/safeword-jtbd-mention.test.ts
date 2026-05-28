/**
 * R8.2 (ticket Y2HCNJ, slice D) — SAFEWORD.md's Clarify / Phase 0
 * description mentions the JTBD authoring sub-step, in BOTH the canonical
 * template and this repo's dogfood copy (canonical-first discipline;
 * dogfood-parity keeps them in sync).
 *
 * Doc-presence test: the agent reads SAFEWORD.md at session start, so the
 * instruction living in the file IS the shipped behavior.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const CANONICAL = fileURLToPath(new URL('../../templates/SAFEWORD.md', import.meta.url));
const DOGFOOD = fileURLToPath(new URL('../../../../.safeword/SAFEWORD.md', import.meta.url));

describe.each([
  ['canonical template', CANONICAL],
  ['dogfood copy', DOGFOOD],
])('SAFEWORD.md JTBD mention — %s', (_label, filePath) => {
  const content = readFileSync(filePath, 'utf8');

  it('mentions the JTBD sub-step within the Clarify / Phase 0 section', () => {
    const clarify = content.slice(
      content.indexOf('### 1. Clarify'),
      content.indexOf('### 2. Classify'),
    );
    expect(clarify).toMatch(/Jobs To Be Done|JTBD/);
  });
});
