import { describe, expect, it } from 'vitest';

import type { Finding } from './finding.js';
import { manifestationKey, prepareEncounters } from './pipeline.js';

const rawFinding = (over: Record<string, unknown> = {}) => ({
  category: 'rough-edge',
  title: 'Coverage gate message omits file and number',
  safeword_surface: 'hooks/stop-quality.ts',
  what_happened: 'The coverage gate blocked with no file and no number.',
  why_friction: 'I could not tell the user how to unblock.',
  repro: 'safeword check after an edit that drops coverage',
  ...over,
});

describe('prepareEncounters', () => {
  it('turns a valid raw finding into an encounter with the resolved surface', () => {
    const [encounter] = prepareEncounters([rawFinding()]);
    expect(encounter).toBeDefined();
    expect(encounter?.draft.signature.startsWith('retro:')).toBe(true);
    expect(encounter?.draft.body).toContain('hooks/stop-quality.ts');
    expect(encounter?.manifestation).toBeTruthy();
  });

  it('drops a finding whose safeword_surface does not resolve (fail closed)', () => {
    const encounters = prepareEncounters([rawFinding({ safeword_surface: 'src/billing.ts' })]);
    expect(encounters).toEqual([]);
  });

  it('drops a finding that fails the schema (bad category)', () => {
    const encounters = prepareEncounters([rawFinding({ category: 'whatever' })]);
    expect(encounters).toEqual([]);
  });

  it('manifestationKey distinguishes a new repro with the same symptom', () => {
    const base: Finding = {
      category: 'bug',
      title: 'same title',
      safewordSurface: 'hooks/stop-quality.ts',
      whatHappened: 'same symptom',
      whyFriction: 'same friction',
      repro: 'repro one',
    };
    expect(manifestationKey(base)).toBe(manifestationKey({ ...base }));
    expect(manifestationKey(base)).not.toBe(manifestationKey({ ...base, repro: 'repro two' }));
  });

  it('sanitizes free-text fields so no secret or customer path reaches the draft', () => {
    const [encounter] = prepareEncounters([
      rawFinding({
        what_happened: 'blocked editing /Users/jdoe/app/billing.ts with key sk_live_TESTONLY1',
      }),
    ]);
    expect(encounter).toBeDefined();
    expect(encounter?.draft.body).not.toContain('/Users/jdoe/app/billing.ts');
    expect(encounter?.draft.body).not.toContain('sk_live_TESTONLY1');
    expect(encounter?.draft.body).toContain('[path]');
    expect(encounter?.draft.body).toContain('[redacted]');
  });
});
