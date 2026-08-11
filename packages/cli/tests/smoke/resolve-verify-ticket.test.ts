import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const installedHelper = nodePath.join(repoRoot, '.safeword/hooks/resolve-verify-ticket.ts');
const templateHelper = nodePath.join(
  repoRoot,
  'packages/cli/templates/hooks/resolve-verify-ticket.ts',
);

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
