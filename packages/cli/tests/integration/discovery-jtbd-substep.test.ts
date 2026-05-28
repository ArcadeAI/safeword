/**
 * R8.1 (ticket Y2HCNJ, slice D) — DISCOVERY.md Phase 0 documents an
 * "Author Jobs To Be Done" sub-step positioned after "Load project
 * glossary" and before "Understanding", in BOTH the canonical template
 * and this repo's dogfood copy (canonical-first discipline; dogfood-parity
 * keeps them in sync).
 *
 * Doc-presence test: the agent reads DISCOVERY.md at intake start, so the
 * authoring instruction living in the file IS the shipped behavior. Run
 * from packages/cli (cwd), per the project's vitest convention.
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

  it('has an "Author Jobs To Be Done" sub-step between glossary loading and Understanding', () => {
    const glossaryAt = content.indexOf('## Load project glossary');
    const jtbdAt = content.indexOf('## Author Jobs To Be Done');
    const understandingAt = content.indexOf('## Understanding');
    expect(jtbdAt).toBeGreaterThan(-1);
    expect(jtbdAt).toBeGreaterThan(glossaryAt);
    expect(jtbdAt).toBeLessThan(understandingAt);
  });

  it('references the one-persona-per-JTBD rule and the pause-and-confirm step', () => {
    const jtbdSection = content.slice(
      content.indexOf('## Author Jobs To Be Done'),
      content.indexOf('## Understanding'),
    );
    expect(jtbdSection).toMatch(/one persona/i);
    expect(jtbdSection).toMatch(/pause|confirm/i);
  });
});
