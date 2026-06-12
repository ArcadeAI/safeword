/**
 * Unit tests for styled-output glyph formatting (ticket 469YSR).
 *
 * A leading newline in a styled message must hoist ABOVE the glyph, so the
 * blank line prints first and the glyph stays attached to its text:
 * `success('\nFoo')` → `\n✓ Foo`, not `✓ \nFoo` (which orphaned the glyph on
 * its own line and dropped the text below it, unglyphed).
 */

import { describe, expect, it } from 'vitest';

import { formatGlyphLine } from './output.js';

describe('formatGlyphLine (469YSR)', () => {
  it('keeps the glyph attached to the text for a plain message', () => {
    expect(formatGlyphLine('✓', 'Configuration is healthy')).toBe('✓ Configuration is healthy');
  });

  it('hoists a leading newline above the glyph, not after it', () => {
    expect(formatGlyphLine('✓', '\nConfiguration is healthy')).toBe('\n✓ Configuration is healthy');
  });

  it('hoists multiple leading newlines above the glyph', () => {
    expect(formatGlyphLine('⚠', '\n\nHeads up')).toBe('\n\n⚠ Heads up');
  });
});
