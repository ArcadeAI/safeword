import { describe, expect, it } from 'vitest';

import { buildDraft, retroSignature } from './draft.js';
import type { Finding } from './finding.js';

const finding: Finding = {
  category: 'rough-edge',
  title: 'Coverage gate message omits file and number',
  safewordSurface: 'hooks/stop-quality.ts',
  whatHappened: 'The coverage gate blocked with no file and no number.',
  whyFriction: 'I could not tell the user how to unblock.',
  repro: 'safeword check after an edit that drops coverage',
};

describe('buildDraft', () => {
  it('retro-transcript-mining.SM1.AC1.finding_has_namespaced_draft_shape', () => {
    const draft = buildDraft(finding);
    expect(draft).toHaveProperty('signature');
    expect(draft).toHaveProperty('title');
    expect(draft).toHaveProperty('body');
    expect(draft).toHaveProperty('labels');
    expect(draft.signature.startsWith('retro:')).toBe(true);
    expect(draft.title).toBe(finding.title);
    expect(Array.isArray(draft.labels)).toBe(true);
  });

  it('retro-recall.SM2.AC1.body_embeds_the_searchable_signature_marker', () => {
    const draft = buildDraft(finding);
    // The signature must appear verbatim in the body so searchBySignature (in:body
    // + exact-filter) can dedupe re-fires on it rather than the variable title.
    expect(draft.body).toContain(draft.signature);
  });
});

describe('retroSignature', () => {
  it('retro-transcript-mining.SM1.AC1.retro_signature_never_equals_spool_signature', () => {
    // The deterministic spool signs as `<agent>:<class>@<source>` (self-report.ts
    // signatureOf). A retro signature for the same underlying surface must differ.
    const spoolSignature = 'claude:Error@stop-quality';
    expect(retroSignature(finding)).not.toBe(spoolSignature);
    expect(retroSignature(finding).startsWith('retro:')).toBe(true);
  });

  it('is stable for the same finding identity and distinct across surfaces', () => {
    expect(retroSignature(finding)).toBe(retroSignature({ ...finding }));
    expect(retroSignature(finding)).not.toBe(
      retroSignature({ ...finding, safewordSurface: 'hooks/post-tool-quality.ts' }),
    );
  });
});

describe('buildDraft — process label (PNZM3B)', () => {
  const processFinding = (surface: string) => ({
    category: 'gap' as const,
    title: 'TDD loop misses tsc errors',
    safewordSurface: surface,
    whatHappened: 'x',
    whyFriction: 'y',
    repro: 'z',
  });

  it('adds the process label to a process-surfaced draft alongside the standard labels', () => {
    const draft = buildDraft(processFinding('process/tdd-loop'));
    expect(draft.labels).toContain('process');
    expect(draft.labels).toContain('retro');
    expect(draft.labels).toContain('self-report');
    expect(draft.labels).toContain('gap');
  });

  it('leaves a file-surfaced draft without the process label', () => {
    const draft = buildDraft(processFinding('hooks/stop-quality.ts'));
    expect(draft.labels).not.toContain('process');
  });
});
