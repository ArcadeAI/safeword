/**
 * R8.1 (ticket Y2HCNJ, slice D) — DISCOVERY.md Phase 0 documents an
 * "Jobs To Be Done" section inside the full Product Plan, after glossary
 * loading and before "Understanding", in BOTH the canonical template
 * and this repo's dogfood copy. Separate parity checks own byte equality.
 *
 * Doc-presence test only: this does not prove packaging or model compliance.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Resolve relative to this file (cwd is unreliable under the workspace runner).
const CANONICAL = fileURLToPath(
  new URL('../../templates/skills/bdd/DISCOVERY.md', import.meta.url),
);
const DOGFOOD = fileURLToPath(
  new URL('../../../../.claude/skills/bdd/DISCOVERY.md', import.meta.url),
);

describe.each([
  ['canonical template', CANONICAL],
  ['dogfood copy', DOGFOOD],
])('DISCOVERY.md JTBD sub-step — %s', (_label, filePath) => {
  const content = readFileSync(filePath, 'utf8');

  it('places Jobs To Be Done inside the full Product Plan after glossary loading', () => {
    const glossaryAt = content.indexOf('## Load project glossary');
    const planAt = content.indexOf('## Full Product Plan');
    const jtbdAt = content.indexOf('### Jobs To Be Done');
    const shapeAt = content.indexOf('### Shape');
    const understandingAt = content.indexOf('## Understanding');
    expect(glossaryAt).toBeGreaterThan(-1);
    expect(planAt).toBeGreaterThan(glossaryAt);
    expect(jtbdAt).toBeGreaterThan(planAt);
    expect(shapeAt).toBeGreaterThan(jtbdAt);
    expect(understandingAt).toBeGreaterThan(shapeAt);
  });

  it('references the one-persona-per-JTBD rule and the pause-and-confirm step', () => {
    const start = content.indexOf('### Jobs To Be Done');
    const end = content.indexOf('### Shape');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // Matched by shape, not by sentence: the surrounding prose is edited often
    // (#3688 reworded this very line to "pause once ... as a set"), and an exact
    // string here turns every wording change into a spurious failure.
    const jtbdSection = content.slice(start, end);
    expect(jtbdSection).toMatch(/one persona/iu);
    expect(jtbdSection).toMatch(/pause|confirm/iu);
  });
});
