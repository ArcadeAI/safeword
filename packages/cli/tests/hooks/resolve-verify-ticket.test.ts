import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const helperPath = nodePath.join(repoRoot, 'packages/cli/templates/hooks/resolve-verify-ticket.ts');

const context = { projectDirectory: '', temporaryRoot: '' };

function isolatedGitEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
}

function git(...args: string[]): string {
  return execFileSync('git', ['-C', context.projectDirectory, ...args], {
    encoding: 'utf8',
    env: isolatedGitEnvironment(),
  }).trim();
}

function writeTicket(folder: string, id: string, status = 'in_progress'): string {
  const ticketDirectory = nodePath.join(context.projectDirectory, '.project', 'tickets', folder);
  mkdirSync(ticketDirectory, { recursive: true });
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  writeFileSync(
    ticketPath,
    `---\nid: ${id}\ntype: task\nphase: verify\nstatus: ${status}\n---\n\n# ${folder}\n`,
  );
  return ticketPath;
}

function commitAll(message: string): void {
  git('add', '.');
  git('commit', '-m', message);
}

function cleanRunEnvironment(): NodeJS.ProcessEnv {
  const environment = isolatedGitEnvironment();
  delete environment.CLAUDE_SESSION_ID;
  delete environment.CLAUDE_CODE_SESSION_ID;
  delete environment.CODEX_THREAD_ID;
  delete environment.SAFEWORD_AGENT_RUNTIME;
  return environment;
}

function runResolver(
  options: { env?: NodeJS.ProcessEnv; ticket?: string; omitProject?: boolean } = {},
) {
  const args = [helperPath];
  if (!options.omitProject) args.push(context.projectDirectory);
  if (options.ticket !== undefined) args.push('--ticket', options.ticket);
  return spawnSync('bun', args, {
    encoding: 'utf8',
    cwd: context.projectDirectory,
    env: options.env ?? cleanRunEnvironment(),
  });
}

beforeEach(() => {
  context.projectDirectory = createTemporaryDirectory();
  context.temporaryRoot = context.projectDirectory;
  mkdirSync(nodePath.join(context.projectDirectory, '.project', 'tickets'), { recursive: true });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'verify-ticket@example.test');
  git('config', 'user.name', 'Verify Ticket Test');
  writeFileSync(nodePath.join(context.projectDirectory, 'README.md'), '# Fixture\n');
  commitAll('base');
});

afterEach(() => {
  removeTemporaryDirectory(context.temporaryRoot);
});

describe('resolve-verify-ticket', () => {
  it('uses the session-bound ticket instead of unrelated committed active state', () => {
    const sessionTicket = writeTicket('SESSION1-bound-ticket', 'SESSION1');
    commitAll('add session ticket');
    writeFileSync(
      nodePath.join(
        context.projectDirectory,
        '.project',
        'quality-state-claude-review-session.json',
      ),
      JSON.stringify({ activeTicket: 'SESSION1' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    environment.CLAUDE_SESSION_ID = 'review-session';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(sessionTicket);
  });

  it('fails closed when session and current-work ticket evidence conflict', () => {
    const sessionTicket = writeTicket('SESSION1-bound-ticket', 'SESSION1');
    const changedTicket = writeTicket('CHANGED1-diff-ticket', 'CHANGED1');
    commitAll('add ticket baseline');
    writeTicket('CHANGED1-diff-ticket', 'CHANGED1', 'done');
    writeFileSync(
      nodePath.join(
        context.projectDirectory,
        '.project',
        'quality-state-claude-review-session.json',
      ),
      JSON.stringify({ activeTicket: 'SESSION1' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    environment.CLAUDE_SESSION_ID = 'review-session';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Session-bound ticket conflicts');
    expect(result.stderr).toContain(sessionTicket);
    expect(result.stderr).toContain(changedTicket);
  });

  it('fails closed when both the session ticket and another existing ticket changed', () => {
    const sessionTicket = writeTicket('SESSION1-bound-ticket', 'SESSION1');
    const changedTicket = writeTicket('CHANGED1-diff-ticket', 'CHANGED1');
    commitAll('add ticket baseline');
    writeTicket('SESSION1-bound-ticket', 'SESSION1', 'done');
    writeTicket('CHANGED1-diff-ticket', 'CHANGED1', 'done');
    writeFileSync(
      nodePath.join(
        context.projectDirectory,
        '.project',
        'quality-state-claude-review-session.json',
      ),
      JSON.stringify({ activeTicket: 'SESSION1' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    environment.CLAUDE_SESSION_ID = 'review-session';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Session-bound ticket conflicts');
    expect(result.stderr).toContain(sessionTicket);
    expect(result.stderr).toContain(changedTicket);
  });

  it('fails closed when a session binding cannot distinguish a newly added ticket', () => {
    const sessionTicket = writeTicket('SESSION1-bound-ticket', 'SESSION1');
    commitAll('add session ticket');
    writeTicket('FOLLOW1-new-follow-up', 'FOLLOW1');
    writeFileSync(
      nodePath.join(
        context.projectDirectory,
        '.project',
        'quality-state-claude-review-session.json',
      ),
      JSON.stringify({ activeTicket: 'SESSION1' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    environment.CLAUDE_SESSION_ID = 'review-session';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Session-bound ticket conflicts');
    expect(result.stderr).toContain(sessionTicket);
    expect(result.stderr).toContain(
      nodePath.join(context.projectDirectory, '.project/tickets/FOLLOW1-new-follow-up/ticket.md'),
    );
  });

  it('uses a valid session binding when the Git base is unavailable', () => {
    git('branch', '-M', 'trunk');
    const sessionTicket = writeTicket('SESSION1-bound-ticket', 'SESSION1');
    commitAll('add session ticket');
    git('checkout', '-b', 'feature/verify-ticket');
    writeFileSync(
      nodePath.join(
        context.projectDirectory,
        '.project',
        'quality-state-claude-review-session.json',
      ),
      JSON.stringify({ activeTicket: 'SESSION1' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    environment.CLAUDE_SESSION_ID = 'review-session';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(sessionTicket);
  });

  it('falls back to one current-work ticket when the session binding is stale', () => {
    const changedTicket = writeTicket('CHANGED1-diff-ticket', 'CHANGED1');
    writeFileSync(
      nodePath.join(
        context.projectDirectory,
        '.project',
        'quality-state-claude-review-session.json',
      ),
      JSON.stringify({ activeTicket: 'MISSING1' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    environment.CLAUDE_SESSION_ID = 'review-session';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(changedTicket);
  });

  it('continues ticketless when a stale session binding has no current-work candidate', () => {
    writeFileSync(
      nodePath.join(
        context.projectDirectory,
        '.project',
        'quality-state-claude-review-session.json',
      ),
      JSON.stringify({ activeTicket: 'MISSING1' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    environment.CLAUDE_SESSION_ID = 'review-session';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(
      'No current-work ticket found; continue without an active ticket.',
    );
  });

  it('selects an already-done ticket changed by the current worktree', () => {
    const ticketPath = writeTicket('DONE123-current-change', 'DONE123', 'done');

    const result = runResolver();

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(ticketPath);
  });

  it('selects a ticket committed on the current feature branch relative to main', () => {
    const ticketPath = writeTicket('PR12345-current-pr', 'PR12345');
    commitAll('add ticket on main');
    git('checkout', '-b', 'feature/verify-ticket');
    writeTicket('PR12345-current-pr', 'PR12345', 'done');
    commitAll('complete current PR ticket');

    const result = runResolver();

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(ticketPath);
  });

  it('resolves committed ticket evidence when the project is below the Git root', () => {
    const gitRoot = context.projectDirectory;
    const projectDirectory = nodePath.join(gitRoot, 'packages/app');
    mkdirSync(projectDirectory, { recursive: true });
    context.projectDirectory = projectDirectory;
    git('checkout', '-b', 'feature/subproject-ticket');
    const ticketPath = writeTicket('SUBPR01-current-pr', 'SUBPR01', 'done');
    commitAll('add subproject ticket');

    const result = runResolver();

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(ticketPath);
  });

  it('uses origin HEAD to resolve committed work from a nonstandard default branch', () => {
    git('branch', '-M', 'trunk');
    git('update-ref', 'refs/remotes/origin/trunk', 'HEAD');
    git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
    git('checkout', '-b', 'feature/verify-ticket');
    const ticketPath = writeTicket('PR12345-current-pr', 'PR12345', 'done');
    commitAll('add current PR ticket');

    const result = runResolver();

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(ticketPath);
  });

  it('uses origin master when the remote HEAD symref and local default branch are absent', () => {
    git('branch', '-M', 'trunk');
    git('update-ref', 'refs/remotes/origin/master', 'HEAD');
    git('checkout', '-b', 'feature/verify-ticket');
    const ticketPath = writeTicket('PR12345-current-pr', 'PR12345', 'done');
    commitAll('add current PR ticket');

    const result = runResolver();

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(ticketPath);
  });

  it('fails closed when committed work has no discoverable base', () => {
    git('branch', '-M', 'trunk');
    git('checkout', '-b', 'feature/verify-ticket');
    writeTicket('PR12345-current-pr', 'PR12345', 'done');
    commitAll('add current PR ticket');

    const result = runResolver();

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Unable to determine the current-work Git base');
  });

  it('continues ticketless instead of selecting unrelated committed active state', () => {
    writeTicket('STALE01-unrelated-active', 'STALE01');
    commitAll('add unrelated active ticket');

    const result = runResolver();

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(
      'No current-work ticket found; continue without an active ticket.',
    );
  });

  it.each(['staged', 'unstaged', 'committed'] as const)(
    'fails closed when current work contains a %s ticket deletion',
    state => {
      const ticketPath = writeTicket('DELETE1-current-ticket', 'DELETE1');
      commitAll('add ticket baseline');
      git('checkout', '-b', 'feature/delete-ticket');

      if (state === 'staged') {
        git('rm', nodePath.relative(context.projectDirectory, ticketPath));
      } else {
        unlinkSync(ticketPath);
        if (state === 'committed') commitAll('delete current ticket');
      }

      const result = runResolver();

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Current-work ticket file was deleted');
      expect(result.stderr).toContain(ticketPath);
    },
  );

  it('fails closed when multiple changed tickets need disambiguation', () => {
    const first = writeTicket('FIRST01-first-change', 'FIRST01');
    const second = writeTicket('SECOND1-second-change', 'SECOND1');

    const result = runResolver();

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Multiple current-work ticket candidates found');
    expect(result.stderr).toContain(first);
    expect(result.stderr).toContain(second);
  });

  it('selects one active epic when current work also changes completed child tickets', () => {
    const epic = writeTicket('EPIC001-active-epic', 'EPIC001');
    writeTicket('CHILD01-completed-child', 'CHILD01', 'done');
    writeTicket('CHILD02-completed-child', 'CHILD02', 'done');

    const result = runResolver();

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(epic);
  });

  it('accepts an explicit ticket id from injected session context', () => {
    const ticketPath = writeTicket('EXPL123-explicit-context', 'EXPL123', 'done');
    commitAll('add explicit ticket');

    const result = runResolver({ ticket: 'EXPL123' });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(ticketPath);
  });

  it('uses a Codex thread binding to resolve its session ticket', () => {
    const ticketPath = writeTicket('CODEX01-thread-ticket', 'CODEX01');
    commitAll('add Codex session ticket');
    writeFileSync(
      nodePath.join(context.projectDirectory, '.project', 'quality-state-codex-thread-2083.json'),
      JSON.stringify({ activeTicket: 'CODEX01' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'codex';
    environment.CODEX_THREAD_ID = 'thread/2083';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(ticketPath);
  });

  it('accepts --ticket without an explicit project directory', () => {
    const ticketPath = writeTicket('EXPL123-explicit-context', 'EXPL123', 'done');

    const result = runResolver({ ticket: 'EXPL123', omitProject: true });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(realpathSync(ticketPath));
  });

  it('rejects --ticket without a ticket id', () => {
    const result = runResolver({ ticket: '', omitProject: true });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Usage: resolve-verify-ticket.ts');
  });

  it('rejects an explicit ticket id that does not exist', () => {
    const result = runResolver({ ticket: 'MISSING1' });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('explicit-bound ticket "MISSING1" not found');
  });

  it.each(['staged', 'unstaged'] as const)(
    'selects an %s ticket in a repository with no HEAD',
    state => {
      removeTemporaryDirectory(context.projectDirectory);
      context.projectDirectory = createTemporaryDirectory();
      context.temporaryRoot = context.projectDirectory;
      mkdirSync(nodePath.join(context.projectDirectory, '.project', 'tickets'), {
        recursive: true,
      });
      git('init', '--initial-branch=main');
      const ticketPath = writeTicket('FIRST01-initial-staged-ticket', 'FIRST01');
      if (state === 'staged') git('add', '.');

      const result = runResolver();

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(ticketPath);
    },
  );

  it('fails closed when a session binding cannot distinguish new tickets in a repository with no HEAD', () => {
    removeTemporaryDirectory(context.projectDirectory);
    context.projectDirectory = createTemporaryDirectory();
    context.temporaryRoot = context.projectDirectory;
    mkdirSync(nodePath.join(context.projectDirectory, '.project', 'tickets'), {
      recursive: true,
    });
    git('init', '--initial-branch=main');
    const sessionTicket = writeTicket('SESSION1-bound-ticket', 'SESSION1');
    writeTicket('FOLLOW1-new-follow-up', 'FOLLOW1');
    writeFileSync(
      nodePath.join(
        context.projectDirectory,
        '.project',
        'quality-state-claude-review-session.json',
      ),
      JSON.stringify({ activeTicket: 'SESSION1' }),
    );

    const environment = cleanRunEnvironment();
    environment.SAFEWORD_AGENT_RUNTIME = 'claude';
    environment.CLAUDE_SESSION_ID = 'review-session';
    const result = runResolver({ env: environment });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Session-bound ticket conflicts');
    expect(result.stderr).toContain(sessionTicket);
    expect(result.stderr).toContain(
      nodePath.join(context.projectDirectory, '.project/tickets/FOLLOW1-new-follow-up/ticket.md'),
    );
  });

  it.each(['--help', '--tickets'])('rejects the unknown option %s', option => {
    const result = spawnSync('bun', [helperPath, option, 'EXPL123'], {
      encoding: 'utf8',
      cwd: context.projectDirectory,
      env: cleanRunEnvironment(),
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Usage: resolve-verify-ticket.ts');
  });
});
