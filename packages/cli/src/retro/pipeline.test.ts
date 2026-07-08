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
  it('turns a valid raw finding into an encounter with the resolved surface', async () => {
    const report = await prepareEncounters([rawFinding()]);
    const [encounter] = report.encounters;
    expect(encounter).toBeDefined();
    expect(encounter?.draft.signature.startsWith('retro:')).toBe(true);
    expect(encounter?.draft.body).toContain('hooks/stop-quality.ts');
    expect(encounter?.manifestation).toBeTruthy();
  });

  it('drops a finding whose safeword_surface does not resolve (fail closed)', async () => {
    const report = await prepareEncounters([rawFinding({ safeword_surface: 'src/billing.ts' })]);
    expect(report.encounters).toEqual([]);
    expect(report.drops).toEqual({ schema: 0, surface: 1 });
  });

  it('drops a finding that fails the schema (bad category)', async () => {
    const { encounters } = await prepareEncounters([rawFinding({ category: 'whatever' })]);
    expect(encounters).toEqual([]);
  });

  it('caps the number of raw findings processed (anti-abuse bound on secretlint cost)', async () => {
    // A runaway/adversarial extractor array must not fire unbounded secretlint
    // passes inside the synchronous Stop; the cap (50) drops the excess.
    const many = Array.from({ length: 200 }, (_, i) => rawFinding({ title: `friction ${i}` }));
    const { encounters } = await prepareEncounters(many);
    expect(encounters.length).toBeLessThanOrEqual(50);
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

  it('sanitizes free-text fields so no secret or customer path reaches the draft', async () => {
    const report = await prepareEncounters([
      rawFinding({
        what_happened: 'blocked editing /Users/jdoe/app/billing.ts with key sk_live_TESTONLY1',
      }),
    ]);
    const [encounter] = report.encounters;
    expect(encounter).toBeDefined();
    expect(encounter?.draft.body).not.toContain('/Users/jdoe/app/billing.ts');
    expect(encounter?.draft.body).not.toContain('sk_live_TESTONLY1');
    expect(encounter?.draft.body).toContain('[path]');
    expect(encounter?.draft.body).toContain('[redacted]');
  });

  // Review (#543): the modern leak formats must not reach the assembled body
  // end-to-end (LLM-provider keys + Bearer + relative customer paths).
  it('scrubs hyphenated provider keys, Bearer tokens, and relative customer paths from the draft', async () => {
    const report = await prepareEncounters([
      rawFinding({
        what_happened:
          'used sk-ant-api03-AbCdEf012345_-ghIJklMnOpQrStuv editing src/customers/acme/secret.ts',
        why_friction: 'the header was Authorization: Bearer abcdef0123456789ABCDEF0123',
      }),
    ]);
    const [encounter] = report.encounters;
    expect(encounter).toBeDefined();
    const body = encounter?.draft.body ?? '';
    expect(body).not.toContain('sk-ant');
    expect(body).not.toContain('src/customers/acme/secret.ts');
    expect(body).not.toContain('abcdef0123456789');
  });

  // SPNZKM: a well-formed modern provider key the broad regex would NOT catch
  // (secretlint's maintained anthropic rule fires on the exact 108-char shape)
  // must not reach the assembled body — proves the secretlint layer is wired in
  // end-to-end, not just unit-tested.
  it('scrubs a well-formed secretlint-only provider key from the draft', async () => {
    const wellFormed = `sk-ant-api03-${'A'.repeat(93)}AA`;
    const report = await prepareEncounters([
      rawFinding({ what_happened: `key ${wellFormed} hit the gate` }),
    ]);
    const [encounter] = report.encounters;
    expect(encounter).toBeDefined();
    const body = encounter?.draft.body ?? '';
    expect(body).not.toContain(wellFormed);
    expect(body).toContain('[redacted]');
  });
});

describe('prepareEncounters — process-level surfaces (PNZM3B)', () => {
  it('turns a valid process-area finding into a filable encounter naming that surface', async () => {
    const report = await prepareEncounters([rawFinding({ safeword_surface: 'process/tdd-loop' })]);
    const [encounter] = report.encounters;
    expect(encounter).toBeDefined();
    expect(encounter?.draft.body).toContain('process/tdd-loop');
  });

  it.each([
    ['TDD-Loop', 'uppercase'],
    ['tdd_loop', 'underscore'],
    ['tdd/loop', 'nested separator'],
    ['verify-suite-timeout-and-tdd-loop', '33 chars, one over the bound'],
    ['', 'empty slug'],
    ['deadbeefcafe', 'sub-20-char hex run'],
    ['3f9d2c7b1a8e4d6f0b5a9c8d7e6f1a2b', '32-char hex (secret-shaped)'],
    ['3f9d-2c7b-1a8e-4d6f', 'hyphen-split hex'],
    ['k9x2m7q4w8z3j6v1n5r0', 'high-entropy non-hex token'],
    ['deadbe1f-zzzzzzzz', 'embedded 8-hex run amid low-entropy padding'],
  ])('drops process/%s (%s) and counts it at the surface wall', async (slug: string) => {
    const report = await prepareEncounters([rawFinding({ safeword_surface: `process/${slug}` })]);
    expect(report.encounters).toEqual([]);
    expect(report.drops).toEqual({ schema: 0, surface: 1 });
  });

  it('keeps an ordinary word slug at the 32-char length boundary', async () => {
    // 32 chars, dictionary words, low entropy — the passing side of the bound.
    const slug = 'verify-suite-timeout-and-tdd-lop';
    expect(slug).toHaveLength(32);
    const report = await prepareEncounters([rawFinding({ safeword_surface: `process/${slug}` })]);
    expect(report.encounters).toHaveLength(1);
    expect(report.drops).toEqual({ schema: 0, surface: 0 });
  });

  it('keeps a slug with a hex-alphabet dictionary word among non-hex segments', async () => {
    // "dead" is pure hex-alphabet; "code"/"cleanup" are not — an over-aggressive
    // per-segment hex check would wrongly kill this honest slug.
    const report = await prepareEncounters([
      rawFinding({ safeword_surface: 'process/dead-code-cleanup' }),
    ]);
    expect(report.encounters).toHaveLength(1);
    expect(report.drops).toEqual({ schema: 0, surface: 0 });
  });

  it('rejects a finding that omits its surface at the schema wall', async () => {
    const { safeword_surface: _dropped, ...withoutSurface } = rawFinding();
    const report = await prepareEncounters([withoutSurface]);
    expect(report.encounters).toEqual([]);
    expect(report.drops).toEqual({ schema: 1, surface: 0 });
  });
});
