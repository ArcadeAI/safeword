import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

describe.each([
  ['canonical spec template', nodePath.join(repoRoot, 'packages/cli/templates/spec-template.md')],
  ['dogfood spec template', nodePath.join(repoRoot, '.safeword/templates/spec-template.md')],
])('%s surfaces section', (_label, filePath) => {
  const content = readFileSync(filePath, 'utf8');

  it('includes optional ## Surfaces guidance after Personas', () => {
    const personasAt = content.indexOf('## Personas');
    const surfacesAt = content.indexOf('## Surfaces');
    const vocabularyAt = content.indexOf('## Vocabulary');

    expect(personasAt).toBeGreaterThan(-1);
    expect(surfacesAt).toBeGreaterThan(personasAt);
    expect(vocabularyAt).toBeGreaterThan(surfacesAt);
  });

  it('tells agents to reference project surfaces and tag affected contexts', () => {
    const section = content.slice(content.indexOf('## Surfaces'), content.indexOf('## Vocabulary'));

    expect(section).toMatch(/configured\s+surfaces file/);
    expect(section).toContain('spec-local');
    expect(section).toContain('Affected:');
    expect(section).toContain('Unaffected:');
    expect(section).toContain('@surface.<slug>');
  });
});
