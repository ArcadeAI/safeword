import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { selfHeal } from '../../src/utils/architecture-document.js';
import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  runCli,
} from '../helpers.js';

const REPOSITORY_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK_PATH = nodePath.join(
  REPOSITORY_ROOT,
  'packages/cli/templates/hooks/pre-tool-architecture-stage.ts',
);

describe('pre-tool architecture staging hook', () => {
  let directory: string;

  function git(...args: string[]): string {
    return execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  }

  function runHook(command: string): ReturnType<typeof spawnSync> {
    symlinkSync(
      nodePath.join(REPOSITORY_ROOT, 'packages'),
      nodePath.join(directory, 'packages'),
      'dir',
    );
    return spawnSync('bun', [HOOK_PATH], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
      input: JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command },
      }),
    });
  }

  beforeEach(() => {
    directory = createTemporaryDirectory();
    initGitRepo(directory);
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(directory, 'src', 'auth'), { recursive: true });
    mkdirSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'fixture' }));
    writeFileSync(
      nodePath.join(directory, 'src', 'auth', 'index.ts'),
      'export const auth = true;\n',
    );
    writeFileSync(
      nodePath.join(directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    selfHeal(directory);
    git('add', '-A');
    git('commit', '-m', 'initial fixture');
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  it('keeps a git commit -a snapshot fresh in a clean checkout', async () => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook('git commit -am "remove billing"');
    expect(hook.status).toBe(0);

    git('commit', '-am', 'remove billing');
    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it('keeps healed architecture bytes when git commit -a restages tracked files', async () => {
    const documentPath = nodePath.join(directory, '.project', 'architecture.generated.md');
    writeFileSync(
      documentPath,
      readFileSync(documentPath, 'utf8').replace(
        'No description yet — awaiting prose.',
        'IMPORTANT HUMAN PROSE.',
      ),
    );
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook('git commit -am "remove billing"');
    expect(hook.status).toBe(0);

    git('commit', '-am', 'remove billing');
    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
      expect(
        readFileSync(nodePath.join(cleanCheckout, '.project', 'architecture.generated.md'), 'utf8'),
      ).toContain('IMPORTANT HUMAN PROSE.');
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it('preserves worktree-only architecture prose across git commit -a healing', async () => {
    const documentPath = nodePath.join(directory, '.project', 'architecture.generated.md');
    mkdirSync(nodePath.join(directory, 'src', 'drafts'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'src', 'drafts', 'index.ts'),
      'export const drafts = true;\n',
    );
    const generate = await runCli(['architecture'], { cwd: directory });
    expect(generate.exitCode).toBe(0);
    writeFileSync(
      documentPath,
      readFileSync(documentPath, 'utf8').replaceAll(
        'No description yet — awaiting prose.',
        'IMPORTANT WORKTREE PROSE.',
      ),
    );
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook('git commit -am "remove billing"');
    expect(hook.status).toBe(0);

    git('commit', '-am', 'remove billing');
    const worktreeDocument = readFileSync(documentPath, 'utf8');
    expect(worktreeDocument).toContain('### drafts');
    expect(worktreeDocument).toContain('IMPORTANT WORKTREE PROSE.');

    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it.each([
    ['git -C . commit -am "remove billing"', ['-C', '.', 'commit', '-am', 'remove billing']],
    [
      'git -c core.abbrev=7 commit -am "remove billing"',
      ['-c', 'core.abbrev=7', 'commit', '-am', 'remove billing'],
    ],
  ])('keeps a global-option %s commit fresh in a clean checkout', async (command, gitArguments) => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook(command);
    expect(hook.status).toBe(0);

    git(...gitArguments);
    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it('does not stage tracked worktree changes when git commit -a aborts', () => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    const preCommitHook = nodePath.join(directory, '.git', 'hooks', 'pre-commit');
    writeFileSync(preCommitHook, '#!/bin/sh\nexit 1\n');
    chmodSync(preCommitHook, 0o755);

    const hook = runHook('git commit -am "remove billing"');
    expect(hook.status).toBe(0);
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/billing/index.ts');

    const commit = spawnSync('git', ['commit', '-am', 'remove billing'], {
      cwd: directory,
      encoding: 'utf8',
    });

    expect(commit.status).not.toBe(0);
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/billing/index.ts');
    expect(git('diff', '--name-only')).toContain('src/billing/index.ts');
  });

  it('keeps a chained git add && git commit snapshot fresh in a clean checkout', async () => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    const command = 'git add src/billing/index.ts && git commit -m "remove billing"';

    const hook = runHook(command);
    expect(hook.status).toBe(0);

    const commit = spawnSync('bash', ['-c', command], {
      cwd: directory,
      encoding: 'utf8',
    });
    expect(commit.status).toBe(0);

    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it('keeps a chained git add -A && git commit snapshot fresh in a clean checkout', async () => {
    const documentPath = nodePath.join(directory, '.project', 'architecture.generated.md');
    writeFileSync(
      documentPath,
      readFileSync(documentPath, 'utf8').replace(
        'No description yet — awaiting prose.',
        'IMPORTANT HUMAN PROSE.',
      ),
    );
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    const command = 'git add -A && git commit -m "remove billing"';

    const hook = runHook(command);
    expect(hook.status).toBe(0);

    const commit = spawnSync('bash', ['-c', command], {
      cwd: directory,
      encoding: 'utf8',
    });
    expect(commit.status).toBe(0);

    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
      expect(
        readFileSync(nodePath.join(cleanCheckout, '.project', 'architecture.generated.md'), 'utf8'),
      ).toContain('IMPORTANT HUMAN PROSE.');
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it('stages a workspace package purpose change that stays fresh in a clean checkout', async () => {
    rmSync(nodePath.join(directory, 'src'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', private: true, workspaces: ['apps/*'] }),
    );
    mkdirSync(nodePath.join(directory, 'apps', 'worker', 'src'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'apps', 'worker', 'package.json'),
      JSON.stringify({ name: 'worker', description: 'Runs background jobs.' }),
    );
    writeFileSync(
      nodePath.join(directory, 'apps', 'worker', 'src', 'index.ts'),
      'export const worker = true;\n',
    );
    selfHeal(directory);
    git('add', '-A');
    git('commit', '-m', 'convert fixture to a workspace');

    writeFileSync(
      nodePath.join(directory, 'apps', 'worker', 'package.json'),
      JSON.stringify({ name: 'worker', description: 'Runs scheduled background jobs.' }),
    );
    git('add', '--', 'apps/worker/package.json');

    const hook = runHook('git commit -m "update worker purpose"');
    expect(hook.status).toBe(0);
    expect(git('diff', '--cached', '--name-only')).toContain('.project/architecture.generated.md');

    git('commit', '-m', 'update worker purpose');
    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
      expect(
        readFileSync(nodePath.join(cleanCheckout, '.project', 'architecture.generated.md'), 'utf8'),
      ).toContain('Runs scheduled background jobs.');
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it.each([
    ['git -C', (target: string) => `git -C "${target}" commit -am "remove billing"`],
    [
      'git --git-dir/--work-tree',
      (target: string) =>
        `git --git-dir="${target}/.git" --work-tree="${target}" commit -am "remove billing"`,
    ],
    [
      'GIT_DIR/GIT_WORK_TREE',
      (target: string) =>
        `GIT_DIR="${target}/.git" GIT_WORK_TREE="${target}" git commit -am "remove billing"`,
    ],
    ['cd && git commit', (target: string) => `cd "${target}" && git commit -am "remove billing"`],
  ])(
    'honors the repository selected by %s without touching the ambient repository',
    async (_label, commandForTarget) => {
      const targetDirectory = createTemporaryDirectory();
      try {
        initGitRepo(targetDirectory);
        mkdirSync(nodePath.join(targetDirectory, '.safeword'), { recursive: true });
        mkdirSync(nodePath.join(targetDirectory, 'src', 'auth'), { recursive: true });
        mkdirSync(nodePath.join(targetDirectory, 'src', 'billing'), { recursive: true });
        writeFileSync(
          nodePath.join(targetDirectory, 'package.json'),
          JSON.stringify({ name: 'target-fixture' }),
        );
        writeFileSync(
          nodePath.join(targetDirectory, 'src', 'auth', 'index.ts'),
          'export const auth = true;\n',
        );
        writeFileSync(
          nodePath.join(targetDirectory, 'src', 'billing', 'index.ts'),
          'export const billing = true;\n',
        );
        selfHeal(targetDirectory);
        execFileSync('git', ['add', '-A'], { cwd: targetDirectory });
        execFileSync('git', ['commit', '-m', 'initial target fixture'], { cwd: targetDirectory });
        symlinkSync(
          nodePath.join(REPOSITORY_ROOT, 'packages'),
          nodePath.join(targetDirectory, 'packages'),
          'dir',
        );

        rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
        rmSync(nodePath.join(targetDirectory, 'src', 'billing'), { recursive: true });
        const command = commandForTarget(targetDirectory);

        const hook = runHook(command);
        expect(hook.status).toBe(0);
        expect(git('diff', '--cached', '--name-only')).not.toContain(
          '.project/architecture.generated.md',
        );

        const commit = spawnSync('bash', ['-c', command], {
          cwd: directory,
          encoding: 'utf8',
        });
        expect(commit.status).toBe(0);
        const cleanCheckout = createTemporaryDirectory();
        try {
          execFileSync('git', ['clone', '--quiet', '--no-local', targetDirectory, cleanCheckout]);

          const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

          expect(check.exitCode).toBe(0);
        } finally {
          removeTemporaryDirectory(cleanCheckout);
        }
      } finally {
        removeTemporaryDirectory(targetDirectory);
      }
    },
  );

  it.each([
    ['a short-circuited commit', 'false && git commit -am "remove billing"'],
    [
      'a piped pathspec add',
      String.raw`printf "src/billing/index.ts\n" | git add --pathspec-from-file=- && git commit -m "remove billing"`,
    ],
  ])('does not mutate the index for %s that the hook cannot model exactly', (_label, command) => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook(command);

    expect(hook.status).toBe(0);
    expect(git('diff', '--cached', '--name-only')).not.toContain(
      '.project/architecture.generated.md',
    );
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/billing/index.ts');
  });

  it.each([
    ['a status preflight', 'git status --short && git commit -m "remove billing"'],
    ['a lint preflight', 'bun run lint && git commit -m "remove billing"'],
  ])('visibly declines architecture auto-staging for %s', (_label, command) => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    git('add', '--', 'src/billing/index.ts');

    const hook = runHook(command);

    expect(hook.status).toBe(0);
    expect(hook.stderr).toBe('');
    const output = JSON.parse(String(hook.stdout)) as {
      hookSpecificOutput?: { additionalContext?: string; hookEventName?: string };
      systemMessage?: string;
    };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(output.systemMessage).toContain('run safeword architecture --stage');
    expect(output.hookSpecificOutput).toEqual({
      additionalContext: output.systemMessage,
      hookEventName: 'PreToolUse',
    });
    expect(git('diff', '--cached', '--name-only')).not.toContain(
      '.project/architecture.generated.md',
    );
  });

  it('preserves an untracked foreign architecture doc during a modeled commit', () => {
    const documentPath = nodePath.join(directory, '.project', 'architecture.generated.md');
    git('rm', '--', '.project/architecture.generated.md');
    git('commit', '-m', 'remove generated architecture');
    const foreign = '# Team Architecture\n\nHand-written and untracked.\n';
    mkdirSync(nodePath.dirname(documentPath), { recursive: true });
    writeFileSync(documentPath, foreign);
    mkdirSync(nodePath.join(directory, 'src', 'drafts'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'src', 'drafts', 'index.ts'),
      'export const drafts = true;\n',
    );

    const hook = runHook('git add src/drafts/index.ts && git commit -m "add drafts"');

    expect(hook.status).toBe(0);
    expect(readFileSync(documentPath, 'utf8')).toBe(foreign);
    expect(git('diff', '--cached', '--name-only')).not.toContain(
      '.project/architecture.generated.md',
    );
  });

  it.each([
    'git commit -ma',
    'git commit -m "document -a behavior"',
    'git commit --message="-a"',
    'git commit -uall -m status',
    'git commit -Salpha -m signed',
    'echo "git commit -a"',
    'git commit -a --dry-run',
    'git commit -a --short',
    'git commit -a --porcelain',
    'git commit -a --long',
    'git commit -a -z',
    'git commit -a --null',
    'git commit -a --dry',
    'git commit -a --sho',
    'git commit -a --porc',
    'git commit -a --lon',
    'git commit -a --nul',
    'git commit -a -h',
    'git commit -a --help',
    'git commit --mess -a',
  ])('does not broaden a non-all commit: %s', command => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook(command);

    expect(hook.status).toBe(0);
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/billing/index.ts');
    expect(git('diff', '--cached', '--name-only')).not.toContain(
      '.project/architecture.generated.md',
    );
  });

  it.each(['git commit --dry-run', 'git commit -a --help'])(
    'does not mutate an already-staged tree for non-committing mode: %s',
    command => {
      rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
      git('add', '--', 'src/billing/index.ts');

      const hook = runHook(command);

      expect(hook.status).toBe(0);
      expect(git('diff', '--cached', '--name-only')).toContain('src/billing/index.ts');
      expect(git('diff', '--cached', '--name-only')).not.toContain(
        '.project/architecture.generated.md',
      );
    },
  );

  it('does not fall back to the real index when a projected git add fails', () => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    git('add', '--', 'src/billing/index.ts');

    const hook = runHook(
      'git add --pathspec-from-file=missing-pathspec && git commit -m "remove billing"',
    );

    expect(hook.status).toBe(0);
    expect(git('diff', '--cached', '--name-only')).toContain('src/billing/index.ts');
    expect(git('diff', '--cached', '--name-only')).not.toContain(
      '.project/architecture.generated.md',
    );
  });
});
