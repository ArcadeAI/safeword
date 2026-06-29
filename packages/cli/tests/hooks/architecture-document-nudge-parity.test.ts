/**
 * Differential test (P58R22 pattern) pinning the hook-side `parseGeneratedFingerprint`
 * against the canonical CLI `readDocumentFingerprint` that WRITES the generated doc
 * (ticket AXRC4D, GitHub #559). The hook lib deliberately re-implements the parser
 * (hooks run standalone under bun in customer repos, with no import path to the CLI), so
 * the two could silently diverge if the doc's frontmatter format ever changes. This test
 * makes that divergence loud: for every fixture, both readers must agree.
 */

import { describe, expect, it } from 'vitest';

import { readDocumentFingerprint } from '../../src/utils/architecture-document.js';
import { parseGeneratedFingerprint } from '../../templates/hooks/lib/architecture-document-nudge.js';

const FIXTURES: Record<string, string> = {
  'canonical doc':
    '---\ngenerator: safeword-architecture\nfingerprint: abc123\n---\n\n# Architecture\n',
  'fingerprint as the only key': '---\nfingerprint: deadbeef\n---\n',
  'fingerprint not the first key':
    '---\ngenerator: safeword-architecture\nfingerprint: zzz999\n---\n',
  'CRLF line endings': '---\r\ngenerator: safeword-architecture\r\nfingerprint: c0ffee\r\n---\r\n',
  'empty fingerprint value': '---\nfingerprint:\n---\n',
  'no frontmatter at all': '# Architecture\n\nThe human narrative, no fences.\n',
  'a fingerprint-looking line OUTSIDE the frontmatter':
    '---\ngenerator: safeword-architecture\n---\n\nfingerprint: not-this-one\n',
  'empty content': '',
  'unterminated frontmatter': '---\nfingerprint: abc\n',
};

describe('parseGeneratedFingerprint ⇄ readDocumentFingerprint differential', () => {
  for (const [name, content] of Object.entries(FIXTURES)) {
    it(`agrees on: ${name}`, () => {
      expect(parseGeneratedFingerprint(content)).toBe(readDocumentFingerprint(content));
    });
  }
});
