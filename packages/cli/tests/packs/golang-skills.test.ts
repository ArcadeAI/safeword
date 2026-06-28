import { describe, expect, it } from 'vitest';

import {
  GOLANG_SKILL_DIR_PATTERN,
  GOLANG_SKILL_SELECTION,
  GOLANG_SKILL_SOURCE,
} from '../../src/packs/golang/skills.js';

describe('golang skill manifest', () => {
  it('points at the jeffallan source (same author as Python/TS)', () => {
    expect(GOLANG_SKILL_SOURCE).toContain('jeffallan/claude-skills');
  });

  it('selects the single language-tier skill by name', () => {
    // Multi-domain source, so a named one-skill selection (not `'*'`), matching
    // the Python/TS packs. Go is no longer the 44-skill + dispatcher special case.
    expect(GOLANG_SKILL_SELECTION).toEqual(['golang-pro']);
  });

  it('recognizes the installed golang-pro skill directory', () => {
    expect('golang-pro').toMatch(GOLANG_SKILL_DIR_PATTERN);
  });

  it('does not match other directories (incl. the old samber atomic skills)', () => {
    expect('SKILL.md').not.toMatch(GOLANG_SKILL_DIR_PATTERN);
    expect('golang-context').not.toMatch(GOLANG_SKILL_DIR_PATTERN); // samber-era, no longer ours
    expect('python-pro').not.toMatch(GOLANG_SKILL_DIR_PATTERN);
    expect('golang').not.toMatch(GOLANG_SKILL_DIR_PATTERN);
  });
});
