import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  GOLANG_SKILL_DIR_PATTERN,
  GOLANG_SKILL_SELECTION,
  GOLANG_SKILL_SOURCE,
} from '../../src/packs/golang/skills.js';
import {
  buildSkillsArgv,
  installSkills,
  SAFEWORD_SKILL_AGENTS,
  skillInstallCommand,
  skillsInstalled,
} from '../../src/skills/install.js';

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

  it('selects a named subset via --skill <name...> (multi-domain source, no *)', () => {
    const argv = buildSkillsArgv('github.com/jeffallan/claude-skills', ['python-pro']);
    const skillIndex = argv.indexOf('--skill');
    expect(skillIndex).toBeGreaterThanOrEqual(0);
    expect(argv[skillIndex + 1]).toBe('python-pro');
    // A named selection must NOT widen to every skill.
    expect(argv).not.toContain('*');
  });

  it('repeats --skill per name (the installer does not split a space-separated list)', () => {
    const argv = buildSkillsArgv('github.com/x/y', ['a-skill', 'b-skill']);
    // Each name gets its own flag: --skill a-skill --skill b-skill.
    expect(argv.filter(token => token === '--skill')).toHaveLength(2);
    const joined = argv.join(' ');
    expect(joined).toContain('--skill a-skill --skill b-skill');
  });

  it('skillInstallCommand renders the full npx command for the failure hint', () => {
    const command = skillInstallCommand(GOLANG_SKILL_SOURCE, 'all');
    expect(command).toBe(buildSkillsArgv(GOLANG_SKILL_SOURCE, 'all').join(' '));
    expect(command.startsWith('npx -y skills@latest add ')).toBe(true);
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

describe('skillsInstalled (derive presence from disk)', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('is false when no agent skill dir exists', () => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'sw-skills-'));
    expect(skillsInstalled(dir, GOLANG_SKILL_DIR_PATTERN)).toBe(false);
  });

  it('is true when a golang- skill dir is present under .claude/skills', () => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'sw-skills-'));
    mkdirSync(nodePath.join(dir, '.claude', 'skills', 'golang-context'), { recursive: true });
    expect(skillsInstalled(dir, GOLANG_SKILL_DIR_PATTERN)).toBe(true);
  });

  it('is true when present under .agents/skills (codex/cursor target)', () => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'sw-skills-'));
    mkdirSync(nodePath.join(dir, '.agents', 'skills', 'golang-error-handling'), {
      recursive: true,
    });
    expect(skillsInstalled(dir, GOLANG_SKILL_DIR_PATTERN)).toBe(true);
  });

  it('ignores non-matching dirs (e.g. unrelated skills)', () => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'sw-skills-'));
    mkdirSync(nodePath.join(dir, '.claude', 'skills', 'python-typing'), { recursive: true });
    expect(skillsInstalled(dir, GOLANG_SKILL_DIR_PATTERN)).toBe(false);
  });
});
