import { afterEach, describe, expect, it } from 'vitest';

import { GOLANG_SKILL_SELECTION, GOLANG_SKILL_SOURCE } from '../../src/packs/golang/skills.js';
import { buildSkillsArgv, installSkills, SAFEWORD_SKILL_AGENTS } from '../../src/skills/install.js';

describe('buildSkillsArgv', () => {
  it('selects all skills via --skill * and targets only safeword agents (never --all)', () => {
    const argv = buildSkillsArgv(GOLANG_SKILL_SOURCE, 'all');
    expect(argv).toEqual([
      'npx',
      '-y',
      'skills@latest',
      'add',
      GOLANG_SKILL_SOURCE,
      '--skill',
      '*',
      '-a',
      'claude-code',
      '-a',
      'codex',
      '-a',
      'cursor',
      '--copy',
      '-y',
    ]);
    // The bloat-bomb flag must never appear: --all fans out to ~48 agent dirs.
    expect(argv).not.toContain('--all');
  });

  it('repeats -a per agent (the installer does not split a comma/space list)', () => {
    const argv = buildSkillsArgv(GOLANG_SKILL_SOURCE, 'all');
    const agentFlags = argv.filter(token => token === '-a');
    expect(agentFlags).toHaveLength(SAFEWORD_SKILL_AGENTS.length);
    for (const agent of SAFEWORD_SKILL_AGENTS) {
      expect(argv).toContain(agent);
    }
  });

  it('consumes the golang manifest verbatim (no hardcoded source/selection)', () => {
    const argv = buildSkillsArgv(GOLANG_SKILL_SOURCE, GOLANG_SKILL_SELECTION);
    expect(argv).toContain(GOLANG_SKILL_SOURCE);
    expect(argv).toContain('--skill');
  });
});

describe('installSkills degrade-not-fail', () => {
  const originalInstall = process.env.SAFEWORD_SKIP_INSTALL;
  const originalSkills = process.env.SAFEWORD_SKIP_SKILLS;
  afterEach(() => {
    if (originalInstall === undefined) delete process.env.SAFEWORD_SKIP_INSTALL;
    else process.env.SAFEWORD_SKIP_INSTALL = originalInstall;
    if (originalSkills === undefined) delete process.env.SAFEWORD_SKIP_SKILLS;
    else process.env.SAFEWORD_SKIP_SKILLS = originalSkills;
  });

  function runSkip(): ReturnType<typeof installSkills> {
    return installSkills({
      source: GOLANG_SKILL_SOURCE,
      selection: GOLANG_SKILL_SELECTION,
      cwd: process.cwd(),
    });
  }

  it('skips (does not shell out) when SAFEWORD_SKIP_INSTALL is set', () => {
    delete process.env.SAFEWORD_SKIP_SKILLS;
    process.env.SAFEWORD_SKIP_INSTALL = '1';
    expect(runSkip().status).toBe('skipped');
  });

  it('skips when SAFEWORD_SKIP_SKILLS is set (deps still install)', () => {
    delete process.env.SAFEWORD_SKIP_INSTALL;
    process.env.SAFEWORD_SKIP_SKILLS = '1';
    expect(runSkip().status).toBe('skipped');
  });
});
