import { describe, expect, it } from 'vitest';

import { buildDigest } from '../../templates/hooks/lib/retro-extract.js';

describe('buildDigest', () => {
  // invisible-retro-claude.TB2.AC3 — a multi-MB transcript is digested, not fed raw:
  // signal (assistant text + tool-use names) survives under the cap, while an
  // oversized raw tool-result body is omitted (so naive truncation can't keep it
  // and drop the later markers).
  it('invisible-retro-claude.TB2.AC3.large_transcript_is_digested_before_extraction', () => {
    const oversizedBody = `BIGRESULT_${'Z'.repeat(50_000)}`;
    const lines = [
      // oversized tool-result FIRST: if it weren't filtered, truncation would keep
      // it and never reach the markers below.
      JSON.stringify({
        message: { role: 'user', content: [{ type: 'tool_result', content: oversizedBody }] },
      }),
      JSON.stringify({
        message: { role: 'assistant', content: [{ type: 'text', text: 'note MARKER_X here' }] },
      }),
      JSON.stringify({
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'TOOL_Y', input: { a: 1 } }],
        },
      }),
    ];
    const padding = Array.from({ length: 300 }, (_, i) =>
      JSON.stringify({
        message: { role: 'assistant', content: [{ type: 'text', text: `pad line ${i}` }] },
      }),
    );
    const transcript = [...lines, ...padding].join('\n');
    const cap = 4000;

    const digest = buildDigest(transcript, cap);

    expect(digest.length).toBeLessThanOrEqual(cap);
    expect(digest).toContain('MARKER_X');
    expect(digest).toContain('TOOL_Y');
    expect(digest).not.toContain(oversizedBody);
  });

  it('keeps a short error-ish tool-result (friction signal) but is resilient to malformed lines', () => {
    const transcript = [
      'not json at all',
      JSON.stringify({
        message: {
          role: 'user',
          content: [{ type: 'tool_result', content: 'gate BLOCKED: stale' }],
        },
      }),
    ].join('\n');
    const digest = buildDigest(transcript, 10_000);
    expect(digest).toContain('BLOCKED');
  });
});
