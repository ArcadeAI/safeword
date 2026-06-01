/**
 * KD4BYF integration assertion (ticket YR6C49, Task 6).
 *
 * Snapshots arcade's real `.project/glossary.md` into tests/fixtures and
 * asserts it parses unchanged under safeword's canonical reader — the
 * empirical check behind the X-C schema decision (required Definition +
 * optional rich fields, lenient parsing). If this fails, the arcade-side
 * adoption (KD4BYF) would need a migration; passing means arcade adopts
 * safeword's glossary with zero content changes.
 *
 * The fixture exercises real-world shape the synthetic unit tests don't:
 * multi-line wrapped definitions, mixed `**Used in:**` / `**Used in**:`
 * colon variants, a `## <Term>` example inside a code fence (must be
 * skipped), and `---` horizontal-rule separators between entries.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseGlossary, validateGlossary } from '../../src/utils/glossary.js';

const FIXTURE_PATH = fileURLToPath(new URL('../fixtures/arcade-glossary.md', import.meta.url));

describe('arcade glossary compatibility (KD4BYF / R8.1)', () => {
  it("parses arcade's real glossary into 7 terms with zero validation errors", () => {
    const content = readFileSync(FIXTURE_PATH, 'utf8');

    const entries = parseGlossary(content);
    const errors = validateGlossary(entries);

    expect(entries.map(entry => entry.name)).toEqual([
      'Tool',
      'Toolkit',
      'Customer',
      'Organization',
      'Project',
      'valid request',
      'authorized request',
    ]);
    // The `## <Term>` example inside the format-instructions code fence is
    // skipped (skip-mask), so 7 real terms, not 8.
    expect(errors).toEqual([]);
  });

  it('captures multi-line definitions in full (no truncation)', () => {
    const content = readFileSync(FIXTURE_PATH, 'utf8');

    const tool = parseGlossary(content).find(entry => entry.name === 'Tool');

    expect(tool).toBeDefined();
    // Definition wraps across three source lines; all are joined.
    expect(tool?.definition).toContain('A single callable capability');
    expect(tool?.definition).toContain('returns a structured result');
  });
});
