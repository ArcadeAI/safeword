import { describe, expect, it } from 'vitest';

import { verifyDraftBody } from '../../templates/hooks/lib/retro-draft-spool.js';
import { buildDraft, retroSignature } from './draft.js';
import type { Finding } from './finding.js';
import { shortHash } from './hash.js';

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

describe('buildDraft body seal (JDK0F0 — #773 rung 3)', () => {
  it('seals the FINAL body (signature marker included) with bodyDigest = shortHash(body)', () => {
    const draft = buildDraft(finding);
    // Digest of the body as spooled — marker and all — so any post-sanitization
    // edit (re-wording, un-redacting) breaks the seal.
    expect(draft.bodyDigest).toBe(shortHash(draft.body));
  });

  it('a built draft passes the spool-side verifier (algorithm agreement across modules)', () => {
    // draft.ts seals via src/retro/hash.ts; the self-contained spool module
    // recomputes with its own inline sha256-12hex. This pin is what keeps the
    // two implementations from drifting apart.
    expect(verifyDraftBody(buildDraft(finding))).toBe(true);
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
