import { describe, expect, it } from 'vitest';

import {
  GOLANG_SKILL_NAMES,
  GOLANG_SKILL_SOURCE,
  GOLANG_SKILLS,
} from '../../src/packs/golang/skills.js';

describe('golang skill manifest', () => {
  it('points at the samber source', () => {
    expect(GOLANG_SKILL_SOURCE).toContain('samber/cc-skills-golang');
  });

  it('every declared skill name is a golang- skill', () => {
    for (const name of GOLANG_SKILL_NAMES) {
      expect(name).toMatch(/^golang-[a-z-]+$/);
    }
  });

  it('has no duplicate names across groups', () => {
    expect(new Set(GOLANG_SKILL_NAMES).size).toBe(GOLANG_SKILL_NAMES.length);
  });

  it('flat list equals the union of all groups', () => {
    const byName = (a: string, b: string): number => a.localeCompare(b);
    const fromGroups = Object.values(GOLANG_SKILLS).flat();
    expect([...GOLANG_SKILL_NAMES].toSorted(byName)).toEqual([...fromGroups].toSorted(byName));
  });

  it('excludes library-specific skills (general-purpose set only)', () => {
    const excluded = [
      'grpc',
      'graphql',
      'spf13',
      'uber-',
      'samber-',
      'testify',
      'swagger',
      'temporal',
    ];
    for (const name of GOLANG_SKILL_NAMES) {
      for (const frag of excluded) {
        expect(name).not.toContain(frag);
      }
    }
  });

  it('declares a non-trivial set', () => {
    expect(GOLANG_SKILL_NAMES.length).toBeGreaterThanOrEqual(20);
  });
});
