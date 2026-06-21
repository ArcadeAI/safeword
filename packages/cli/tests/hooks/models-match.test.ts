/**
 * Unit tests for modelsMatch — the cross-model independence check (ticket
 * MR5M3A). Same model (or indeterminate) → match → gate blocks; a confirmed
 * different model → no match → gate allows. Proves test-definitions Rule
 * "Cross-model review" at the comparison level.
 */

import { describe, expect, it } from 'vitest';

import { modelsMatch } from '../../templates/hooks/lib/review-ledger.js';

describe('modelsMatch — cross-model independence', () => {
  it('matches identical tags (same_recorded_model_blocks)', () => {
    expect(modelsMatch('claude-opus-4-8', 'claude-opus-4-8')).toBe(true);
  });

  it('does not match confirmed different models (different_recorded_model_passes)', () => {
    expect(modelsMatch('claude-opus-4-8', 'claude-sonnet-4-6')).toBe(false);
  });

  it('matches the same model differing only in case or whitespace (same_model_differing_case_blocks)', () => {
    expect(modelsMatch('Claude-Opus-4-8', '  claude-opus-4-8 ')).toBe(true);
  });

  it('matches (fails closed) when the author tag is absent (author_model_unknown_blocks)', () => {
    expect(modelsMatch('claude-opus-4-8')).toBe(true);
  });

  it('matches (fails closed) when the author tag is empty', () => {
    expect(modelsMatch('claude-opus-4-8', ' '.repeat(3))).toBe(true);
  });

  it('matches (fails closed) when the reviewer tag is absent', () => {
    expect(modelsMatch(undefined, 'claude-opus-4-8')).toBe(true);
  });
});
