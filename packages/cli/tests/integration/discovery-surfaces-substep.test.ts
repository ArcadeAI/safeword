/**
 * Issue #509 — BDD intake documents a "Load project surfaces" sub-step after
 * personas and glossary in the canonical template and installed dogfood copies.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const CANONICAL = fileURLToPath(
  new URL('../../templates/skills/bdd/DISCOVERY.md', import.meta.url),
);
const CLAUDE_DOGFOOD = fileURLToPath(
  new URL('../../../../.claude/skills/bdd/DISCOVERY.md', import.meta.url),
);
const CODEX_DOGFOOD = fileURLToPath(
  new URL('../../../../.agents/skills/bdd/DISCOVERY.md', import.meta.url),
);

describe.each([
  ['canonical template', CANONICAL],
  ['Claude dogfood copy', CLAUDE_DOGFOOD],
  ['Codex dogfood copy', CODEX_DOGFOOD],
])('DISCOVERY.md surfaces sub-step — %s', (_label, filePath) => {
  const content = readFileSync(filePath, 'utf8');

  it('loads surfaces after personas and glossary', () => {
    const personasAt = content.indexOf('## Load project personas');
    const glossaryAt = content.indexOf('## Load project glossary');
    const surfacesAt = content.indexOf('## Load project surfaces');

    expect(personasAt).toBeGreaterThan(-1);
    expect(glossaryAt).toBeGreaterThan(personasAt);
    expect(surfacesAt).toBeGreaterThan(glossaryAt);
  });

  it('references paths.surfaces, the default surfaces path, and the empty-file soft prompt', () => {
    const section = content.slice(content.indexOf('## Load project surfaces'));

    expect(section).toContain('paths.surfaces');
    expect(section).toContain('<namespace-root>/surfaces.md');
    expect(section).toMatch(/empty.*add.*surfaces.*now|add.*surfaces.*now.*proceed/i);
  });

  it('explains when to promote a spec-local surface into project surfaces', () => {
    const section = content.slice(content.indexOf('## Load project surfaces'));

    expect(section).toMatch(/OpenAI Codex/i);
    expect(section).toMatch(/@surface\.<slug>/i);
    expect(section).toMatch(/recurring across tickets/i);
    expect(section).toMatch(/ambiguous enough to drift/i);
    expect(section).toMatch(/untested/i);
  });
});
