/**
 * Unit tests for slug normalization (ticket 158, slice 3).
 *
 * Slugs come from CLI args and now live in frontmatter (folder name is the
 * Crockford ID). Normalize at the boundary so downstream code never sees
 * uppercase, spaces, or stray punctuation.
 */

import { describe, expect, it } from 'vitest';

import { normalizeSlug, SlugError } from './slug.js';

describe('normalizeSlug', () => {
  it('lowercases and replaces whitespace with -', () => {
    expect(normalizeSlug('Login Bug')).toBe('login-bug');
  });

  it('collapses non-alphanumeric runs into a single - and strips edges', () => {
    expect(normalizeSlug('fix/auth-flow!')).toBe('fix-auth-flow');
  });

  it('throws SlugError on an empty input', () => {
    expect(() => normalizeSlug('')).toThrow(SlugError);
  });

  it('throws SlugError on input that normalizes to empty', () => {
    expect(() => normalizeSlug('!!!')).toThrow(SlugError);
  });

  it('preserves an already-normalized slug', () => {
    expect(normalizeSlug('login-bug')).toBe('login-bug');
  });

  it('collapses repeated separators', () => {
    expect(normalizeSlug('foo   bar___baz')).toBe('foo-bar-baz');
  });
});
