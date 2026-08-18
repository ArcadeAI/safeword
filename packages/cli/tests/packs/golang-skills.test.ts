import { describe, expect, it } from 'vitest';

import { golangSkillManifest } from '../../src/packs/golang/skills.js';

describe('golang skill manifest', () => {
  it('points at the jeffallan source (same author as Python/TS)', () => {
    expect(golangSkillManifest.source).toContain('jeffallan/claude-skills');
  });

  it('selects the single language-tier skill by name', () => {
    // Multi-domain source, so a named one-skill selection (not `'*'`), matching
    // the Python/TS packs. Go is no longer the 44-skill + dispatcher special case.
    expect(golangSkillManifest.selection).toEqual(['golang-pro']);
  });

  it('recognizes the installed golang-pro skill directory', () => {
    expect('golang-pro').toMatch(golangSkillManifest.dirPattern);
  });

  it('does not match other directories (incl. the old samber atomic skills)', () => {
    expect('SKILL.md').not.toMatch(golangSkillManifest.dirPattern);
    expect('golang-context').not.toMatch(golangSkillManifest.dirPattern); // samber-era, no longer ours
    expect('python-pro').not.toMatch(golangSkillManifest.dirPattern);
    expect('golang').not.toMatch(golangSkillManifest.dirPattern);
  });
});
