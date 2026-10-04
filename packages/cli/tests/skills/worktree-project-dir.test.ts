/**
 * /audit and /verify resolve PROJECT_DIR from the working tree they run in, not
 * the launch checkout CLAUDE_PROJECT_DIR keeps pointing at (#5361).
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const skillPath = (name: string) =>
  nodePath.join(import.meta.dirname, '../../templates/skills', name, 'SKILL.md');

// The PROJECT_DIR assignment as it appears in the skill's executable blocks.
function projectDirectoryAssignment(skill: string): string {
  const line = readFileSync(skillPath(skill), 'utf8')
    .split('\n')
    .find(candidate => candidate.startsWith('PROJECT_DIR="$(top='));
  if (line === undefined) throw new Error(`${skill}: no worktree-aware PROJECT_DIR block`);
  return line;
}

describe('every skill PROJECT_DIR resolution is worktree-aware (#5361)', () => {
  const worktreeAware = /"\$\(top=\$\(git rev-parse[^\n]*?\$PWD\}\}"; fi\)"/g;

  for (const skill of ['audit', 'verify']) {
    it(`/${skill} leaves no bare CLAUDE_PROJECT_DIR resolution outside the worktree-aware form`, () => {
      const content = readFileSync(skillPath(skill), 'utf8');
      expect(content.match(worktreeAware)?.length ?? 0).toBeGreaterThan(0);
      expect(content.replaceAll(worktreeAware, '')).not.toContain('CLAUDE_PROJECT_DIR');
    });
  }
});

describe('skill PROJECT_DIR resolution in a worktree (#5361)', () => {
  let root: string;
  let launch: string;
  let worktree: string;

  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });

  beforeEach(() => {
    root = realpathSync(createTemporaryDirectory());
    launch = nodePath.join(root, 'launch');
    mkdirSync(nodePath.join(launch, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(launch, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    git(root, 'init', '-q', launch);
    git(launch, 'add', '-A');
    git(launch, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init');
    worktree = nodePath.join(root, 'wt');
    git(launch, 'worktree', 'add', '-q', worktree, '-b', 'wt');
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  function resolve(skill: string, cwd: string, env: Record<string, string>): string {
    const result = spawnSync(
      'bash',
      ['-c', `${projectDirectoryAssignment(skill)}\nprintf %s "$PROJECT_DIR"`],
      {
        cwd,
        env: { PATH: process.env.PATH ?? '', ...env },
        encoding: 'utf8',
      },
    );
    return result.stdout;
  }

  for (const skill of ['audit', 'verify']) {
    it(`/${skill} roots at the worktree despite CLAUDE_PROJECT_DIR naming the launch checkout`, () => {
      expect(resolve(skill, worktree, { CLAUDE_PROJECT_DIR: launch })).toBe(
        execFileSync('git', ['rev-parse', '--show-toplevel'], {
          cwd: worktree,
          encoding: 'utf8',
        }).trim(),
      );
    });

    it(`/${skill} keeps the launch checkout when run from it`, () => {
      expect(resolve(skill, launch, { CLAUDE_PROJECT_DIR: launch })).toBe(launch);
    });

    it(`/${skill} honours CLAUDE_PROJECT_DIR when cwd is outside any enrolled tree`, () => {
      expect(resolve(skill, root, { CLAUDE_PROJECT_DIR: launch })).toBe(launch);
    });

    it(`/${skill} falls back to the working directory with no CLAUDE_PROJECT_DIR and no git tree`, () => {
      expect(resolve(skill, root, {})).toBe(root);
    });
  }
});
