import { describe, expect, it } from 'vitest';

import {
  GOLANG_SKILL_DIR_PATTERN,
  GOLANG_SKILL_SELECTION,
  GOLANG_SKILL_SOURCE,
} from '../../src/packs/golang/skills.js';

describe('golang skill manifest', () => {
  it('points at the samber source', () => {
    expect(GOLANG_SKILL_SOURCE).toContain('samber/cc-skills-golang');
  });

  it('selects the full set (no name list to drift)', () => {
    // The installer has no general-purpose-group flag, so anything other than
    // 'all' would require enumerating skill names here — the drift we refuse.
    expect(GOLANG_SKILL_SELECTION).toBe('all');
  });

  it('recognizes installed golang- skill directories', () => {
    expect('golang-context').toMatch(GOLANG_SKILL_DIR_PATTERN);
    expect('golang-error-handling').toMatch(GOLANG_SKILL_DIR_PATTERN);
    expect('golang-data-structures').toMatch(GOLANG_SKILL_DIR_PATTERN);
  });

  it('does not match non-golang directories', () => {
    expect('SKILL.md').not.toMatch(GOLANG_SKILL_DIR_PATTERN);
    expect('python-typing').not.toMatch(GOLANG_SKILL_DIR_PATTERN);
    expect('golang').not.toMatch(GOLANG_SKILL_DIR_PATTERN);
  });
});
