import { describe, expect, it } from 'vitest';

import { assembleBody, normalizeFinding } from './finding.js';

// The raw shape the extraction agent emits per the retro guide (snake_case,
// matching the constrained schema in the feature file). normalizeFinding maps
// it to a typed Finding and drops anything outside the schema.
const rawValid = {
  category: 'rough-edge',
  title: 'Coverage gate message omits file and number',
  safeword_surface: 'hooks/stop-quality.ts',
  what_happened: 'The coverage gate blocked with no file and no number.',
  why_friction: 'I could not tell the user how to unblock.',
  repro: 'safeword check after an edit that drops coverage',
};

const byName = (a: string, b: string): number => a.localeCompare(b);

describe('normalizeFinding', () => {
  it('retro-transcript-mining.NTB1.AC1.stray_agent_field_is_ignored: drops fields outside the schema', () => {
    const out = normalizeFinding({
      ...rawValid,
      customer_context: 'sk_live_TESTONLY1 from /Users/jdoe/app/src/billing.ts',
    });
    expect(out).toBeDefined();
    expect(Object.keys(out ?? {}).toSorted(byName)).toEqual(
      ['category', 'repro', 'safewordSurface', 'title', 'whatHappened', 'whyFriction'].toSorted(
        byName,
      ),
    );
    expect(JSON.stringify(out)).not.toContain('customer_context');
    expect(JSON.stringify(out)).not.toContain('billing.ts');
  });

  it('returns undefined when category is not in the enum', () => {
    expect(normalizeFinding({ ...rawValid, category: 'whatever' })).toBeUndefined();
  });

  it('returns undefined when a required field is missing', () => {
    const missing = {
      category: rawValid.category,
      safeword_surface: rawValid.safeword_surface,
      what_happened: rawValid.what_happened,
      why_friction: rawValid.why_friction,
    };
    expect(normalizeFinding(missing)).toBeUndefined();
  });

  it('returns undefined for non-object input', () => {
    expect(normalizeFinding(undefined)).toBeUndefined();
    expect(normalizeFinding('a string')).toBeUndefined();
  });
});

describe('assembleBody', () => {
  it('retro-transcript-mining.NTB1.AC1.agent_prose_outside_schema_never_reaches_body', () => {
    const raw = {
      category: 'bug',
      title: 'MARKER_TITLE',
      safeword_surface: 'hooks/stop-quality.ts',
      what_happened: 'MARKER_WHAT',
      why_friction: 'MARKER_WHY',
      repro: 'MARKER_REPRO',
      // prose the agent rambled OUTSIDE the schema — must never reach the body
      free_prose: 'MARKER_PROSE leaked /Users/jdoe/secret.ts and sk_live_TESTONLY1',
    };
    const finding = normalizeFinding(raw);
    if (!finding) throw new Error('expected a normalized finding');
    const body = assembleBody(finding);
    expect(body).toContain('MARKER_WHAT');
    expect(body).toContain('MARKER_WHY');
    expect(body).toContain('MARKER_REPRO');
    expect(body).toContain('hooks/stop-quality.ts');
    expect(body).not.toContain('MARKER_PROSE');
  });
});
