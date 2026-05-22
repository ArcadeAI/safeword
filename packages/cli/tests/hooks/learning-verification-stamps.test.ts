/**
 * Tests for the verification-stamp detector in
 * `.safeword/hooks/post-tool-sync-learnings.ts` (Ticket XV72DT).
 *
 * The hook scans just-written learning files for fabricated "✅ Verified"
 * style stamps and emits a `additionalContext` warning pointing to verify.md.
 *
 * Strict-regex policy: only flag the explicit stamp shapes
 * (`✅ Verified`, `Verified by X`, `verified:`). Skip legitimate
 * research-methodology idioms ("verified gap", "verified across tickets")
 * to avoid the synonym arms race documented in arxiv:2504.11168 and the
 * alignment-faking risk documented in arxiv:2511.18397.
 *
 * Mirror of patterns in post-tool-sync-learnings.ts: if those change, this
 * file must change too.
 */

import { describe, expect, it } from 'vitest';

import { hasVerificationStamp } from '../../templates/hooks/lib/learning-verification-stamps.js';

describe('hasVerificationStamp — positive cases (must flag)', () => {
  it.each([
    '✅ Verified by `bun run build` completing cleanly',
    '✅ Verified',
    'Verified by build',
    'Verified by reading src/foo.ts',
    'Some prose. Verified by commit 05a2b5c.',
    '- ✅ Verified',
    'verified: true',
    'Verified by running the test suite',
  ])('flags %s', input => {
    expect(hasVerificationStamp(input)).toBe(true);
  });
});

describe('hasVerificationStamp — exempt cases (must NOT flag)', () => {
  it.each([
    'verified gap, April 2026',
    'empirically verified across tickets #124a and #124b',
    'Source: verified across 2 tickets',
    'verified in the literature review',
    'This claim has not been verified.',
    'Plain prose with no stamp shape at all.',
    '## Verified Examples', // section heading — not a stamp claim
    'The user has verified their email.', // product domain term
  ])('does not flag %s', input => {
    expect(hasVerificationStamp(input)).toBe(false);
  });
});

describe('hasVerificationStamp — frontmatter is skipped', () => {
  it('ignores verified: inside YAML frontmatter delimiters', () => {
    const frontmatterOnly = ['---', 'id: foo', 'verified: true', '---', '', '# Title'].join('\n');
    expect(hasVerificationStamp(frontmatterOnly)).toBe(false);
  });

  it('still flags verified: in body even when frontmatter is present', () => {
    const both = [
      '---',
      'id: foo',
      '---',
      '',
      '# Title',
      '',
      'verified: true (in body — should flag)',
    ].join('\n');
    expect(hasVerificationStamp(both)).toBe(true);
  });
});
