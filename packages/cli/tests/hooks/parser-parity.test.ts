/**
 * Differential test (ticket P58R22). The hook's skip-mask + inline-strip
 * primitives in `jtbd.ts` are a hand-maintained copy of the CLI's
 * `markdown-sections.ts` ones — they cannot share a module (deployed hooks run
 * standalone from `.safeword/hooks/` with no access to the CLI's dist). This
 * test pins the hook's COPIES byte-for-byte to the CLI originals: `activeLines`
 * (hook) composes the hook's copies; `cliActiveLines` composes the CLI's
 * imported originals. They diverge the moment someone edits one copy and not
 * the other — which is exactly how the prior fence gap slipped in.
 *
 * Scope note: this pins the shared *primitives* (fence + block-comment skip,
 * inline-comment strip). It does NOT assert the higher-level parsers are
 * identical — the hook applies inline-stripping uniformly via `activeLines`
 * whereas the CLI's consumers apply it selectively (header text only). That
 * asymmetry is deliberate and benign (the hook, which drives the gate, strips a
 * stray body-line comment *more* cleanly than the CLI), so it's left as-is.
 */

import { describe, expect, it } from 'vitest';

import { computeSkipMask, stripInlineComments } from '../../src/utils/markdown-sections.js';
import { activeLines } from '../../templates/hooks/lib/jtbd.js';

/** The CLI-side active-line walk, composed from its two exported primitives. */
function cliActiveLines(content: string): { index: number; text: string }[] {
  const lines = content.split('\n');
  const skip = computeSkipMask(lines);
  const out: { index: number; text: string }[] = [];
  for (const [index, line] of lines.entries()) {
    if (skip[index]) continue;
    const text = stripInlineComments(line).trim();
    if (text !== '') out.push({ index, text });
  }
  return out;
}

const fixtures: Record<string, string> = {
  plain_headings: ['## Jobs', '', '### JTBD-1', '#### JTBD-1.AC1 — capability'].join('\n'),

  multiline_block_comment: [
    '## Jobs',
    '<!-- a note',
    'still in the comment',
    '-->',
    '### JTBD-1',
  ].join('\n'),

  midline_unclosed_comment_is_literal: ['## Jobs <!-- trailing note', '### JTBD-1'].join('\n'),

  closed_inline_comment_is_stripped: ['### JTBD-1 <!-- id: 7 --> live', '#### JTBD-1.AC1 — x'].join(
    '\n',
  ),

  // The divergence P58R22 must catch: a fenced block whose content begins with
  // `<!--` and never closes inside the fence. The CLI masks the whole fence and
  // resumes after it; a parser that lacks fence handling enters comment-state
  // and swallows the closing fence + every heading that follows.
  fence_with_stray_comment: [
    '## Jobs',
    '```',
    '<!-- example comment in a code sample',
    'const x = 1;',
    '```',
    '### JTBD-1',
    '#### JTBD-1.AC1 — capability',
  ].join('\n'),

  fence_with_plain_content: ['## Jobs', '```ts', 'const y = 2;', '```', '### JTBD-1'].join('\n'),

  // Inline comment on a body (non-heading) line: pins the hook's stripInlineComments
  // copy to the CLI's on the same input the asymmetry note above is about.
  body_line_inline_comment: ['### JTBD-1', '**Persona:** Operator <!-- internal -->'].join('\n'),

  // CRLF line endings (specs may be authored on Windows): both split on '\n',
  // leaving a trailing '\r' that the final trim removes — assert they still agree.
  crlf_line_endings: ['## Jobs', '```', '<!-- x', '```', '### JTBD-1'].join('\r\n'),
};

describe('hook ↔ CLI markdown parser parity (P58R22)', () => {
  for (const [name, content] of Object.entries(fixtures)) {
    it(`agrees on active lines: ${name}`, () => {
      expect(activeLines(content)).toEqual(cliActiveLines(content));
    });
  }
});
