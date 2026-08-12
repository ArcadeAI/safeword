import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const installedHelper = nodePath.join(repoRoot, '.safeword/hooks/resolve-verify-ticket.ts');
const templateHelper = nodePath.join(
  repoRoot,
  'packages/cli/templates/hooks/resolve-verify-ticket.ts',
);
const installedSkill = nodePath.join(repoRoot, '.safeword/skills/verify/SKILL.md');

const hostSurfaces = [
  {
    name: 'Claude',
    surface: nodePath.join(repoRoot, '.claude/skills/verify/SKILL.md'),
  },
  {
    name: 'Codex',
    surface: nodePath.join(repoRoot, 'packages/cli/codex-plugin/skills/verify/SKILL.md'),
  },
  {
    name: 'Cursor',
    surface: nodePath.join(repoRoot, '.cursor/commands/verify.md'),
  },
] as const;

function isolatedGitEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
}

function git(projectDirectory: string, ...args: string[]): void {
  execFileSync('git', ['-C', projectDirectory, ...args], {
    env: isolatedGitEnvironment(),
    stdio: 'ignore',
  });
}

describe('installed resolve-verify-ticket.ts smoke', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
    git(projectDirectory, 'init', '--initial-branch=main');
    git(projectDirectory, 'config', 'user.email', 'verify-smoke@example.test');
    git(projectDirectory, 'config', 'user.name', 'Verify Smoke Test');
    writeFileSync(nodePath.join(projectDirectory, 'README.md'), '# Fixture\n');
    git(projectDirectory, 'add', '.');
    git(projectDirectory, 'commit', '-m', 'base');
    git(projectDirectory, 'checkout', '-b', 'feature/verify-ticket');
    const hooksDirectory = nodePath.join(projectDirectory, '.safeword/hooks');
    const skillsDirectory = nodePath.join(projectDirectory, '.safeword/skills/verify');
    cpSync(nodePath.join(repoRoot, '.safeword/hooks'), hooksDirectory, { recursive: true });
    mkdirSync(skillsDirectory, { recursive: true });
    copyFileSync(installedSkill, nodePath.join(skillsDirectory, 'SKILL.md'));
    const ticketDirectory = nodePath.join(
      projectDirectory,
      '.project/tickets/SMOKE1-current-ticket',
    );
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      '---\nid: SMOKE1\ntype: task\nphase: verify\nstatus: in_progress\n---\n',
    );
    git(projectDirectory, 'add', '.');
    git(projectDirectory, 'commit', '-m', 'add current ticket');
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('matches the canonical resolver template exactly', () => {
    expect(readFileSync(installedHelper, 'utf8')).toBe(readFileSync(templateHelper, 'utf8'));
  });

  it.each(hostSurfaces)(
    'executes the installed $name verify surface against current-work evidence',
    ({ surface }) => {
      let surfaceSource = readFileSync(surface, 'utf8');
      if (surface.endsWith('.cursor/commands/verify.md')) {
        const pointer =
          /^Read and follow the instructions in (?<path>\.safeword\/skills\/verify\/SKILL\.md)$/mu.exec(
            surfaceSource,
          );
        expect(pointer?.groups?.path).toBe('.safeword/skills/verify/SKILL.md');
        surfaceSource = readFileSync(
          nodePath.join(projectDirectory, pointer?.groups?.path ?? ''),
          'utf8',
        );
      }
      const command =
        /^bun "\$PROJECT_DIR\/\.safeword\/hooks\/resolve-verify-ticket\.ts" "\$PROJECT_DIR"$/mu.exec(
          surfaceSource,
        )?.[0];
      expect(command).toBeDefined();

      const result = spawnSync('/bin/bash', ['-c', command ?? 'exit 127'], {
        cwd: projectDirectory,
        encoding: 'utf8',
        env: { ...isolatedGitEnvironment(), PROJECT_DIR: projectDirectory },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim()).toBe(
        nodePath.join(projectDirectory, '.project/tickets/SMOKE1-current-ticket/ticket.md'),
      );
    },
  );

  it('resolves an explicit ticket through the installed command surface', () => {
    const result = spawnSync('bun', [installedHelper, projectDirectory, '--ticket', 'SMOKE1'], {
      encoding: 'utf8',
      env: isolatedGitEnvironment(),
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(
      nodePath.join(projectDirectory, '.project/tickets/SMOKE1-current-ticket/ticket.md'),
    );
  });

  it('resolves current-work evidence through the installed command surface', () => {
    const result = spawnSync('bun', [installedHelper, projectDirectory], {
      encoding: 'utf8',
      env: isolatedGitEnvironment(),
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(
      nodePath.join(projectDirectory, '.project/tickets/SMOKE1-current-ticket/ticket.md'),
    );
  });
});
