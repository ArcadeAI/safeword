/**
 * R8.2 (ticket YR6C49, Task 6) — DISCOVERY.md Phase 0 documents a
 * "Load project glossary" sub-step parallel to the existing "Load
 * project personas" block, in BOTH the canonical template and this
 * repo's dogfood copy (canonical-first discipline; dogfood-parity
 * keeps them in sync).
 *
 * Doc-presence test: the agent reads DISCOVERY.md at intake start, so the
 * loading instruction living in the file IS the shipped behavior. Run
 * from packages/cli (cwd), per the project's vitest convention.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Resolve relative to this file (cwd is unreliable under the workspace runner).
// tests/integration → tests → packages/cli for the canonical template;
// four levels up reaches the repo root for the dogfood copy.
const CANONICAL = fileURLToPath(
  new URL('../../templates/skills/bdd/DISCOVERY.md', import.meta.url),
);
const DOGFOOD = fileURLToPath(
  new URL('../../../../.claude/skills/bdd/DISCOVERY.md', import.meta.url),
);

describe.each([
  ['canonical template', CANONICAL],
  ['dogfood copy', DOGFOOD],
])('DISCOVERY.md glossary sub-step — %s', (_label, filePath) => {
  const content = readFileSync(filePath, 'utf8');

  it('has a "Load project glossary" heading parallel to personas', () => {
    expect(content).toContain('## Load project personas');
    expect(content).toContain('## Load project glossary');
  });

  it('references .project/glossary.md and the empty-file soft prompt', () => {
    expect(content).toContain('.project/glossary.md');
    // Soft-prompt wording mirrors the persona equivalent ("empty — want to add").
    const glossarySection = content.slice(content.indexOf('## Load project glossary'));
    expect(glossarySection).toMatch(/empty.*add.*now|add.*now.*proceed/i);
  });
});
