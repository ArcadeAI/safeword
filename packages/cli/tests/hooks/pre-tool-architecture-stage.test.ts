import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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

  function writeCheckoutModule(projectDirectory: string): void {
    mkdirSync(nodePath.join(projectDirectory, 'src', 'checkout'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, 'src', 'checkout', 'index.ts'),
      'export const checkout = true;\n',
    );
  }

  function createExplicitSelectorTarget(gitDirectoryName = 'repo.git'): {
    container: string;
    gitDirectory: string;
    worktree: string;
  } {
    const container = createTemporaryDirectory();
    const gitDirectory = nodePath.join(container, gitDirectoryName);
    const worktree = nodePath.join(container, 'worktree');
    execFileSync('git', ['init', '--quiet', `--separate-git-dir=${gitDirectory}`, worktree], {
      cwd: container,
    });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: worktree });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: worktree });
    mkdirSync(nodePath.join(worktree, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(worktree, 'src', 'auth'), { recursive: true });
    mkdirSync(nodePath.join(worktree, 'src', 'billing'), { recursive: true });
    writeFileSync(nodePath.join(worktree, 'package.json'), JSON.stringify({ name: 'target' }));
    writeFileSync(
      nodePath.join(worktree, 'src', 'auth', 'index.ts'),
      'export const auth = true;\n',
    );
    writeFileSync(
      nodePath.join(worktree, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    selfHeal(worktree);
    execFileSync('git', ['add', '-A'], { cwd: worktree });
    execFileSync('git', ['commit', '-m', 'initial target fixture'], { cwd: worktree });
    rmSync(nodePath.join(worktree, '.git'));
    return { container, gitDirectory, worktree };
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
    expect(output.systemMessage).toContain('run safeword project architecture --stage');
    expect(output.hookSpecificOutput).toEqual({
      additionalContext: output.systemMessage,
      hookEventName: 'PreToolUse',
    });
    expect(git('diff', '--cached', '--name-only')).not.toContain(
      '.project/architecture.generated.md',
    );
  });

  it.each([
    ['a status preflight', 'git status --short && git commit -m "docs: typo"'],
    ['a lint preflight', 'bun run lint && git commit -m "docs: typo"'],
  ])(
    'does not inject architecture guidance for a routine docs commit after %s',
    (_label, command) => {
      writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');
      git('add', '--', 'README.md');

      const hook = runHook(command);

      expect(hook.status).toBe(0);
      expect(hook.stdout).toBe('');
      expect(hook.stderr).toBe('');
    },
  );

  it('advises when an unsupported command will broadly add an unstaged architecture input', () => {
    writeCheckoutModule(directory);

    const hook = runHook('bun run lint && git add -A && git commit -m "add checkout"');

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as {
      hookSpecificOutput?: { additionalContext?: string; hookEventName?: string };
      systemMessage?: string;
    };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(output.hookSpecificOutput).toEqual({
      additionalContext: output.systemMessage,
      hookEventName: 'PreToolUse',
    });
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it.each([
    ['from the project root', 'git add src/checkout'],
    ['relative to a subdirectory', 'cd src && git add checkout'],
  ])('advises when an unsupported command will add an architecture pathspec %s', (_label, add) => {
    writeCheckoutModule(directory);

    const hook = runHook(`bun run lint && ${add} && git commit -m "add checkout"`);

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it.each([
    ['with a separate -C value', 'git -C . add src/checkout', 'git -C . commit -m "add checkout"'],
    [
      'with explicit repository selectors',
      'git --git-dir=.git --work-tree=. add src/checkout',
      'git --git-dir=.git --work-tree=. commit -m "add checkout"',
    ],
  ])('advises for an architecture pathspec add %s', (_label, stagingCommand, commitCommand) => {
    writeCheckoutModule(directory);

    const hook = runHook(`bun run lint && ${stagingCommand} && ${commitCommand}`);

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it('does not project an advisory add with an arbitrary Git config override', () => {
    writeCheckoutModule(directory);

    const hook = runHook(
      'bun run lint && git -c core.quotePath=false add src/checkout && git commit -m "add checkout"',
    );

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it('advises when an architecture pathspec will stage a tracked deletion', () => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook(
      'bun run lint && cd src && git add billing && git commit -m "remove billing"',
    );

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/billing/index.ts');
  });

  it.each([
    ['a broad add', 'git add -A'],
    ['a matching pathspec', 'git add src/billing/index.ts'],
    ['a broad add from a subdirectory', 'cd src && git add -A'],
  ])('does not advise when %s restores a staged deletion to HEAD', (_label, stagingCommand) => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    git('add', '--', 'src/billing/index.ts');
    mkdirSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );

    const hook = runHook(`bun run lint && ${stagingCommand} && git commit -m "no change"`);

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
    expect(git('diff', '--cached', '--name-status')).toContain('D\tsrc/billing/index.ts');
  });

  it('advises when an unrelated add leaves a staged deletion intact', () => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    git('add', '--', 'src/billing/index.ts');
    writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');

    const hook = runHook('bun run lint && git add README.md && git commit -m "remove billing"');

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
  });

  it('preserves assume-unchanged semantics while projecting a future add', () => {
    mkdirSync(nodePath.join(directory, 'src', 'experimental'), { recursive: true });
    const sourcePath = nodePath.join(directory, 'src', 'experimental', 'index.ts');
    writeFileSync(sourcePath, 'export const experimental = false;\n');
    git('add', '--', 'src/experimental/index.ts');
    git('commit', '-m', 'add experimental module');
    git('update-index', '--assume-unchanged', 'src/experimental/index.ts');
    writeFileSync(sourcePath, 'export const experimental = true;\n');
    writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');
    git('add', '--', 'README.md');

    const hook = runHook(
      'bun run lint && git add src/experimental/index.ts && git commit -m "docs"',
    );

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
    expect(git('diff', '--cached', '--name-only')).toBe('README.md\n');
  });

  it('does not advise when an add pathspec excludes an unstaged architecture input', () => {
    writeCheckoutModule(directory);
    writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');

    const hook = runHook(
      'bun run lint && git add README.md && git commit -m "routine docs change"',
    );

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it('still advises for a staged architecture input before an unrelated add', () => {
    writeCheckoutModule(directory);
    writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');
    git('add', '--', 'src/checkout/index.ts');

    const hook = runHook('bun run lint && git add README.md && git commit -m "add checkout"');

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
  });

  it('advises when an earlier cumulative add includes an architecture input', () => {
    writeCheckoutModule(directory);
    writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');

    const hook = runHook(
      'bun run lint && git add src/checkout && git add README.md && git commit -m "add checkout"',
    );

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it.each([
    ['an unsupported later add', 'git add -f README.md'],
    [
      'a later add in another repository',
      (otherDirectory: string) => `git -C "${otherDirectory}" add README.md`,
    ],
  ])('preserves an earlier architecture add across %s', (_label, laterAdd) => {
    const otherDirectory = createTemporaryDirectory();
    try {
      initGitRepo(otherDirectory);
      writeFileSync(nodePath.join(otherDirectory, 'README.md'), 'other repository\n');
      writeCheckoutModule(directory);
      writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');
      const laterCommand = typeof laterAdd === 'function' ? laterAdd(otherDirectory) : laterAdd;

      const hook = runHook(
        `bun run lint && git add src/checkout && ${laterCommand} && git commit -m "add checkout"`,
      );

      expect(hook.status).toBe(0);
      const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
      expect(output.systemMessage).toContain('skipped architecture auto-staging');
      expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
    } finally {
      rmSync(otherDirectory, { recursive: true, force: true });
    }
  });

  it('treats pathless add -A from a subdirectory as repository-wide', () => {
    mkdirSync(nodePath.join(directory, 'docs'), { recursive: true });
    writeCheckoutModule(directory);

    const hook = runHook('bun run lint && cd docs && git add -A && git commit -m "add checkout"');

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it.each([
    [
      'a Git status check',
      'bun run lint && git add -A && git status --short && git commit -m "add checkout"',
    ],
    [
      'a successful shell builtin',
      'bun run lint && git add -A && true && git commit -m "add checkout"',
    ],
    [
      'an empty pathspec terminator',
      'bun run lint && git add -A -- && git commit -m "add checkout"',
    ],
    ['a benign verbose flag', 'bun run lint && git add -A -v && git commit -m "add checkout"'],
    [
      'the long broad-add spelling with verbose output',
      'bun run lint && git add --no-ignore-removal --verbose && git commit -m "add checkout"',
    ],
    ['the --all spelling', 'bun run lint && git add --all && git commit -m "add checkout"'],
    ['a clustered broad-add flag', 'bun run lint && git add -Av && git commit -m "add checkout"'],
    [
      'a same-repository directory change',
      'bun run lint && git add -A && cd src && git commit -m "add checkout"',
    ],
  ])('retains broad-add advisory scope across %s', (_label, command) => {
    writeCheckoutModule(directory);

    const hook = runHook(command);

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it.each([
    ['a broad add', 'git add -A'],
    ['a pathspec add', 'git add package.json'],
  ])('uses %s instead of stale pre-command index content', (_label, add) => {
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', dependencies: { zod: '^4.0.0' } }),
    );
    git('add', '--', 'package.json');
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '2.0.0' }),
    );

    const hook = runHook(`bun run lint && ${add} && git commit -m "release"`);

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
    expect(git('show', ':package.json')).toContain('zod');
  });

  it('does not let a broad add from another repository override the commit index', () => {
    const targetDirectory = createTemporaryDirectory();
    try {
      initGitRepo(targetDirectory);
      mkdirSync(nodePath.join(targetDirectory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(targetDirectory, 'package.json'),
        JSON.stringify({ name: 'target-fixture' }),
      );
      execFileSync('git', ['add', '-A'], { cwd: targetDirectory });
      execFileSync('git', ['commit', '-m', 'initial target fixture'], { cwd: targetDirectory });
      writeFileSync(
        nodePath.join(targetDirectory, 'package.json'),
        JSON.stringify({ name: 'target-fixture', dependencies: { zod: '^4.0.0' } }),
      );
      execFileSync('git', ['add', '--', 'package.json'], { cwd: targetDirectory });
      writeFileSync(
        nodePath.join(targetDirectory, 'package.json'),
        JSON.stringify({ name: 'target-fixture', version: '2.0.0' }),
      );

      const hook = runHook(
        `bun run lint && git add -A && git -C "${targetDirectory}" commit -m "target change"`,
      );

      expect(hook.status).toBe(0);
      const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
      expect(output.systemMessage).toContain('skipped architecture auto-staging');
      expect(
        execFileSync('git', ['show', ':package.json'], {
          cwd: targetDirectory,
          encoding: 'utf8',
        }),
      ).toContain('zod');
    } finally {
      removeTemporaryDirectory(targetDirectory);
    }
  });

  it('does not mutate a commit target when a preceding add target cannot resolve', () => {
    const targetDirectory = createTemporaryDirectory();
    try {
      initGitRepo(targetDirectory);
      mkdirSync(nodePath.join(targetDirectory, '.safeword'), { recursive: true });
      mkdirSync(nodePath.join(targetDirectory, 'src', 'auth'), { recursive: true });
      writeFileSync(
        nodePath.join(targetDirectory, 'package.json'),
        JSON.stringify({ name: 'target-fixture' }),
      );
      writeFileSync(
        nodePath.join(targetDirectory, 'src', 'auth', 'index.ts'),
        'export const auth = true;\n',
      );
      selfHeal(targetDirectory);
      execFileSync('git', ['add', '-A'], { cwd: targetDirectory });
      execFileSync('git', ['commit', '-m', 'initial target fixture'], { cwd: targetDirectory });
      symlinkSync(
        nodePath.join(REPOSITORY_ROOT, 'packages'),
        nodePath.join(targetDirectory, 'packages'),
        'dir',
      );
      writeCheckoutModule(targetDirectory);
      execFileSync('git', ['add', '--', 'src/checkout/index.ts'], { cwd: targetDirectory });
      const originalIndex = readFileSync(nodePath.join(targetDirectory, '.git', 'index'));
      const documentPath = nodePath.join(targetDirectory, '.project', 'architecture.generated.md');
      const originalDocument = readFileSync(documentPath);
      const missingDirectory = nodePath.join(targetDirectory, 'missing');

      const hook = runHook(
        `git -C "${missingDirectory}" add -A && git -C "${targetDirectory}" commit -m "unreachable"`,
      );

      expect(hook.status).toBe(0);
      expect(readFileSync(nodePath.join(targetDirectory, '.git', 'index'))).toEqual(originalIndex);
      expect(readFileSync(documentPath)).toEqual(originalDocument);
    } finally {
      removeTemporaryDirectory(targetDirectory);
    }
  });

  it('does not let an alternate-index broad add override the commit index', () => {
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', dependencies: { zod: '^4.0.0' } }),
    );
    git('add', '--', 'package.json');
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '2.0.0' }),
    );
    const alternateIndex = nodePath.join(directory, '.git', 'alternate-index');

    const hook = runHook(
      `bun run lint && GIT_INDEX_FILE="${alternateIndex}" git add -A && git commit -m "real index change"`,
    );

    expect(hook.status).toBe(0);
    const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
    expect(output.systemMessage).toContain('skipped architecture auto-staging');
    expect(git('show', ':package.json')).toContain('zod');
  });

  it('does not mutate an alternate index while modeling preceding adds', () => {
    const alternateIndex = nodePath.join(directory, '.git', 'alternate-index');
    copyFileSync(nodePath.join(directory, '.git', 'index'), alternateIndex);
    const originalAlternateIndex = readFileSync(alternateIndex);
    writeCheckoutModule(directory);

    const hook = runHook(
      `GIT_INDEX_FILE="${alternateIndex}" git add -A && git commit -m "real index commit"`,
    );

    expect(hook.status).toBe(0);
    expect(readFileSync(alternateIndex)).toEqual(originalAlternateIndex);
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/checkout/index.ts');
  });

  it('does not retain an alternate index selector removed by env -u', () => {
    const alternateIndex = nodePath.join(directory, '.git', 'alternate-index');
    copyFileSync(nodePath.join(directory, '.git', 'index'), alternateIndex);
    writeCheckoutModule(directory);
    execFileSync('git', ['add', '--', 'src/checkout/index.ts'], {
      cwd: directory,
      env: { ...process.env, GIT_INDEX_FILE: alternateIndex },
    });
    writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');
    git('add', '--', 'README.md');
    const originalRealIndex = readFileSync(nodePath.join(directory, '.git', 'index'));
    const originalAlternateIndex = readFileSync(alternateIndex);

    const hook = runHook(
      `GIT_INDEX_FILE="${alternateIndex}" env -u GIT_INDEX_FILE git commit -m "docs"`,
    );

    expect(hook.status).toBe(0);
    expect(readFileSync(nodePath.join(directory, '.git', 'index'))).toEqual(originalRealIndex);
    expect(readFileSync(alternateIndex)).toEqual(originalAlternateIndex);
  });

  it('does not mutate either index when env clears inherited selectors', () => {
    const alternateIndex = nodePath.join(directory, '.git', 'alternate-index');
    copyFileSync(nodePath.join(directory, '.git', 'index'), alternateIndex);
    writeCheckoutModule(directory);
    execFileSync('git', ['add', '--', 'src/checkout/index.ts'], {
      cwd: directory,
      env: { ...process.env, GIT_INDEX_FILE: alternateIndex },
    });
    writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');
    git('add', '--', 'README.md');
    const originalRealIndex = readFileSync(nodePath.join(directory, '.git', 'index'));
    const originalAlternateIndex = readFileSync(alternateIndex);

    const hook = runHook(`GIT_INDEX_FILE="${alternateIndex}" env - git commit -m "docs"`);

    expect(hook.status).toBe(0);
    expect(readFileSync(nodePath.join(directory, '.git', 'index'))).toEqual(originalRealIndex);
    expect(readFileSync(alternateIndex)).toEqual(originalAlternateIndex);
  });

  it.each([
    ['short', (target: string) => `env -C "${target}" git commit -m "target"`],
    ['long', (target: string) => `env --chdir="${target}" git commit -m "target"`],
  ])('does not mutate another repository for the %s env chdir form', (_name, command) => {
    const targetDirectory = createTemporaryDirectory();
    try {
      initGitRepo(targetDirectory);
      writeFileSync(nodePath.join(targetDirectory, 'README.md'), 'target fixture\n');
      execFileSync('git', ['add', '-A'], { cwd: targetDirectory });
      execFileSync('git', ['commit', '-m', 'initial target fixture'], {
        cwd: targetDirectory,
      });

      writeCheckoutModule(directory);
      git('add', '--', 'src/checkout/index.ts');
      const originalSourceIndex = readFileSync(nodePath.join(directory, '.git', 'index'));
      const originalTargetIndex = readFileSync(nodePath.join(targetDirectory, '.git', 'index'));

      const hook = runHook(command(targetDirectory));

      expect(hook.status).toBe(0);
      expect(readFileSync(nodePath.join(directory, '.git', 'index'))).toEqual(originalSourceIndex);
      expect(readFileSync(nodePath.join(targetDirectory, '.git', 'index'))).toEqual(
        originalTargetIndex,
      );
    } finally {
      removeTemporaryDirectory(targetDirectory);
    }
  });

  it('preserves Git selector ordering when resolving a later -C', () => {
    const targetContainer = createTemporaryDirectory();
    const targetDirectory = nodePath.join(targetContainer, 'b');
    const targetGitDirectory = nodePath.join(targetContainer, 'a.git');
    try {
      execFileSync(
        'git',
        ['init', '--quiet', `--separate-git-dir=${targetGitDirectory}`, targetDirectory],
        { cwd: targetContainer },
      );
      execFileSync('git', ['config', 'user.email', 'test@example.com'], {
        cwd: targetDirectory,
      });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: targetDirectory });
      mkdirSync(nodePath.join(targetDirectory, '.safeword'), { recursive: true });
      writeFileSync(
        nodePath.join(targetDirectory, 'package.json'),
        JSON.stringify({ name: 'target-fixture' }),
      );
      execFileSync('git', ['add', '-A'], { cwd: targetDirectory });
      execFileSync('git', ['commit', '-m', 'initial target fixture'], { cwd: targetDirectory });
      writeFileSync(
        nodePath.join(targetDirectory, 'package.json'),
        JSON.stringify({ name: 'target-fixture', dependencies: { zod: '^4.0.0' } }),
      );
      execFileSync('git', ['add', '--', 'package.json'], { cwd: targetDirectory });
      writeFileSync(
        nodePath.join(targetDirectory, 'package.json'),
        JSON.stringify({ name: 'target-fixture', version: '2.0.0' }),
      );

      const hook = runHook(
        `bun run lint && git add -A && git --git-dir=a.git --work-tree=b -C "${targetContainer}" commit -m "target change"`,
      );

      expect(hook.status).toBe(0);
      const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
      expect(output.systemMessage).toContain('skipped architecture auto-staging');
      expect(
        execFileSync('git', ['show', ':package.json'], {
          cwd: targetDirectory,
          encoding: 'utf8',
        }),
      ).toContain('zod');
    } finally {
      removeTemporaryDirectory(targetContainer);
    }
  });

  it('stages architecture for an explicit-selector worktree without a .git marker', () => {
    const target = createExplicitSelectorTarget();
    try {
      symlinkSync(
        nodePath.join(REPOSITORY_ROOT, 'packages'),
        nodePath.join(target.worktree, 'packages'),
        'dir',
      );
      const originalDocument = readFileSync(
        nodePath.join(target.worktree, '.project', 'architecture.generated.md'),
        'utf8',
      );
      rmSync(nodePath.join(target.worktree, 'src', 'billing'), { recursive: true });
      const command =
        `cd "${target.worktree}" && ` +
        'GIT_DIR="../repo.git" GIT_WORK_TREE="." git commit -am "remove billing"';

      const hook = runHook(command);

      expect(hook.status).toBe(0);
      const gitEnvironment = {
        ...process.env,
        GIT_DIR: target.gitDirectory,
        GIT_WORK_TREE: target.worktree,
      };
      expect(
        execFileSync('git', ['diff', '--cached', '--name-only'], {
          cwd: target.worktree,
          encoding: 'utf8',
          env: gitEnvironment,
        }),
      ).toContain('.project/architecture.generated.md');
      const stagedDocument = execFileSync('git', ['show', ':.project/architecture.generated.md'], {
        cwd: target.worktree,
        encoding: 'utf8',
        env: gitEnvironment,
      });
      expect(stagedDocument).not.toBe(originalDocument);
      expect(stagedDocument).toContain('orphaned: this section describes a module');
    } finally {
      removeTemporaryDirectory(target.container);
    }
  });

  it('supports a direct Git selector assignment whose value ends in env', () => {
    const target = createExplicitSelectorTarget('env');
    try {
      symlinkSync(
        nodePath.join(REPOSITORY_ROOT, 'packages'),
        nodePath.join(target.worktree, 'packages'),
        'dir',
      );
      rmSync(nodePath.join(target.worktree, 'src', 'billing'), { recursive: true });
      const command =
        `cd "${target.worktree}" && ` +
        'GIT_DIR="../env" GIT_WORK_TREE="." git commit -am "remove billing"';

      const hook = runHook(command);

      expect(hook.status).toBe(0);
      const stagedNames = execFileSync('git', ['diff', '--cached', '--name-only'], {
        cwd: target.worktree,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_DIR: target.gitDirectory,
          GIT_WORK_TREE: target.worktree,
        },
      });
      expect(stagedNames).toContain('.project/architecture.generated.md');
    } finally {
      removeTemporaryDirectory(target.container);
    }
  });

  it('advises for a broad add in an explicit-selector worktree without a .git marker', () => {
    const target = createExplicitSelectorTarget();
    try {
      writeCheckoutModule(target.worktree);
      const selectors = 'GIT_DIR="../repo.git" GIT_WORK_TREE="."';
      const command =
        `cd "${target.worktree}" && bun run lint && ` +
        `${selectors} git add -A && ${selectors} git commit -m "add checkout"`;

      const hook = runHook(command);

      expect(hook.status).toBe(0);
      const output = JSON.parse(String(hook.stdout)) as { systemMessage?: string };
      expect(output.systemMessage).toContain('skipped architecture auto-staging');
      expect(
        execFileSync('git', ['diff', '--cached', '--name-only'], {
          cwd: target.worktree,
          encoding: 'utf8',
          env: {
            ...process.env,
            GIT_DIR: target.gitDirectory,
            GIT_WORK_TREE: target.worktree,
          },
        }),
      ).not.toContain('src/checkout/index.ts');
    } finally {
      removeTemporaryDirectory(target.container);
    }
  });

  it('does not advise when a broad add would stage only routine docs', () => {
    writeFileSync(nodePath.join(directory, 'README.md'), 'routine docs change\n');

    const hook = runHook('bun run lint && git add -A && git commit -m "docs: typo"');

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
  });

  it('does not advise when a broad add would stage only a package version bump', () => {
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '2.0.0' }),
    );

    const hook = runHook('bun run lint && git add --all && git commit -m "release"');

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
  });

  it.each([
    [
      'a quoted delimiter',
      `python3 - <<'PY'
git add -A
git commit -m "text inside stdin"
PY`,
    ],
    [
      'a backslash-quoted delimiter',
      String.raw`python3 - <<\EOF
git commit -m "text inside stdin"
EOF`,
    ],
    [
      'a numeric delimiter',
      `python3 - <<123
git commit -m "text inside stdin"
123`,
    ],
  ])('does not treat a heredoc body with %s as an executable commit', (_label, command) => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    git('add', '--', 'src/billing/index.ts');

    const hook = runHook(command);

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
  });

  it.each([
    'false && git commit -m "remove billing"',
    'false && true && git commit -m "remove billing"',
  ])('does not inject guidance for a definitely short-circuited commit: %s', command => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    git('add', '--', 'src/billing/index.ts');

    const hook = runHook(command);

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
  });

  it('does not inject Safeword guidance outside a Safeword project', () => {
    rmSync(nodePath.join(directory, '.safeword'), { recursive: true });
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    git('add', '--', 'src/billing/index.ts');

    const hook = runHook('git status --short && git commit -m "remove billing"');

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe('');
    expect(hook.stderr).toBe('');
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
