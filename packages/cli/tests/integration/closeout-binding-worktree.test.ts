/**
 * Closeout finds the session binding wherever it runs (#5467 part 3a).
 *
 * The real pre-tool hooks write the binding before closeout runs, and closeout
 * reads it from the git root of its own cwd. These tests launch the session in
 * the primary checkout of a real repository, run closeout's command in a
 * linked worktree, and read the binding the way closeout does: from that
 * worktree's root. Real closeout adopting the session is proven end to end in
 * closeout-host-adapters.test.ts.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readFreshCloseoutBinding,
  rememberCloseoutBinding,
} from '../../templates/hooks/lib/closeout-binding.ts';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  repoRoot,
  testCliPath,
} from '../helpers';

const HOOKS = nodePath.join(repoRoot, 'packages/cli/templates/hooks');
const CLOSEOUT = 'bun .safeword/scripts/closeout-cleanup.ts --pr 42';

function git(cwd: string, ...arguments_: string[]): void {
  const result = spawnSync('git', arguments_, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${arguments_.join(' ')}: ${result.stderr}`);
}

/** A host environment with no ambient agent session, launched in `launch`. */
const AMBIENT_AGENT_KEYS = new Set([
  'CLAUDE_SESSION_ID',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_PLUGIN_ROOT',
  'SAFEWORD_PLUGIN_CLI',
  'SAFEWORD_AGENT_RUNTIME',
  'CODEX_THREAD_ID',
]);

/** A host environment with no ambient agent session, launched in `launch`. */
function hostEnvironment(launch: string): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !AMBIENT_AGENT_KEYS.has(key)),
    ),
    CLAUDE_PROJECT_DIR: launch,
  };
}

describe('closeout binding follows the worktree closeout runs in (#5467)', () => {
  let root: string;
  let primary: string;
  let worktreeA: string;
  let worktreeB: string;

  function repo(config?: Record<string, unknown>): void {
    mkdirSync(nodePath.join(primary, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(primary, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    if (config) {
      writeFileSync(nodePath.join(primary, '.safeword', 'config.json'), JSON.stringify(config));
    }
    git(primary, 'init', '-q', '-b', 'main');
    git(primary, 'config', 'user.email', 'test@example.com');
    git(primary, 'config', 'user.name', 'Test');
    git(primary, 'add', '-A');
    git(primary, 'commit', '-q', '-m', 'init');
    git(primary, 'worktree', 'add', '-q', worktreeA, '-b', 'topic-a');
    git(primary, 'worktree', 'add', '-q', worktreeB, '-b', 'topic-b');
  }

  function runClaudeHook(shellCwd: string, command: string, id: string, transcript?: string) {
    return spawnSync('bun', [nodePath.join(HOOKS, 'pre-tool-quality.ts')], {
      cwd: primary,
      env: hostEnvironment(primary),
      input: JSON.stringify({
        session_id: id,
        ...(transcript !== undefined && { transcript_path: transcript }),
        hook_event_name: 'PreToolUse',
        cwd: shellCwd,
        tool_name: 'Bash',
        tool_input: { command },
      }),
      encoding: 'utf8',
    });
  }

  beforeEach(() => {
    root = createTemporaryDirectory();
    primary = nodePath.join(root, 'primary');
    worktreeA = nodePath.join(root, 'worktree-a');
    worktreeB = nodePath.join(root, 'worktree-b');
    mkdirSync(primary);
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  it('closeout run inside a worktree finds the binding the Claude hook recorded', () => {
    repo();

    const result = runClaudeHook(worktreeA, CLOSEOUT, 'claude-session-a');

    expect(result.status, result.stderr).toBe(0);
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeA })).toMatchObject({
      runtime: 'claude',
      id: 'claude-session-a',
    });
  });

  it('follows a leading cd into the worktree closeout runs in', () => {
    repo();

    const result = runClaudeHook(primary, `cd ${worktreeA} && ${CLOSEOUT}`, 'claude-session-cd');

    expect(result.status, result.stderr).toBe(0);
    expect(readFreshCloseoutBinding({ projectDirectory: primary })).toBeUndefined();
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeA })).toMatchObject({
      id: 'claude-session-cd',
    });
  });

  it('keeps each worktree binding when worktrees share one absolute namespace root', () => {
    const shared = nodePath.join(root, 'shared-project-state');
    mkdirSync(shared);
    repo({ paths: { projectRoot: shared } });

    expect(runClaudeHook(worktreeA, CLOSEOUT, 'session-a').status).toBe(0);
    expect(runClaudeHook(worktreeB, CLOSEOUT, 'session-b').status).toBe(0);

    expect(readFreshCloseoutBinding({ projectDirectory: worktreeA })).toMatchObject({
      id: 'session-a',
    });
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeB })).toMatchObject({
      id: 'session-b',
    });
  });

  it.each([
    { script: 'the relative', path: () => '.safeword/scripts/closeout-cleanup.ts' },
    {
      script: "another worktree's absolute",
      path: () => nodePath.join(worktreeB, '.safeword/scripts/closeout-cleanup.ts'),
    },
  ])(
    'denies $script closeout script behind a cd it cannot follow, leaving a waiting binding alone',
    ({ path }) => {
      repo();
      rememberCloseoutBinding({ projectDirectory: worktreeA, runtime: 'claude', id: 'earlier' });
      const stateDirectory = nodePath.join(worktreeA, '.project');
      const before = readdirSync(stateDirectory)
        .filter(name => name.startsWith('closeout-session-binding'))
        .map(name => readFileSync(nodePath.join(stateDirectory, name), 'utf8'));

      const result = runClaudeHook(
        primary,
        `cd "$TARGET" && bun ${path()} --pr 42`,
        'claude-session-var',
      );

      expect(result.status, result.stderr).toBe(0);
      const output = JSON.parse(result.stdout) as {
        hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
      };
      expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput?.permissionDecisionReason).toContain(
        `\`bun ${path()} --pr 42\``,
      );
      const after = readdirSync(stateDirectory)
        .filter(name => name.startsWith('closeout-session-binding'))
        .map(name => readFileSync(nodePath.join(stateDirectory, name), 'utf8'));
      expect(after).toEqual(before);
    },
  );

  it.each([
    'cd -- WORKTREE && CLOSEOUT',
    'cd -P WORKTREE && CLOSEOUT',
    'pushd WORKTREE && CLOSEOUT',
    'cd WORKTREE && popd && CLOSEOUT',
    '(cd WORKTREE && CLOSEOUT)',
    'builtin cd WORKTREE && CLOSEOUT',
    'cd WORKTREE/../worktree-* && CLOSEOUT',
    'cd WORKTREE | true; CLOSEOUT',
    'cd WORKTREE & CLOSEOUT',
    'env -C WORKTREE CLOSEOUT',
    'cd "${CLAUDE_PLUGIN_ROOT}" && CLOSEOUT',
    'cd "$TARGET" && bun run .safeword/scripts/closeout-cleanup.ts --pr 42',
    'bun run .safeword/scripts/closeout-cleanup.ts --pr 42',
    './.safeword/scripts/closeout-cleanup.ts --pr 42',
    'node .safeword/scripts/closeout-cleanup.ts --pr 42',
    'bun $HOME/.safeword/scripts/closeout-cleanup.ts --pr 42',
    'CLOSEOUT\nbun .safeword/scripts/closeout-cleanup.ts --pr 43',
    'cd worktree-a && CLOSEOUT',
    'cd "$TARGET" && exec bun .safeword/scripts/closeout-cleanup.ts --pr 42',
    'time bun .safeword/scripts/closeout-cleanup.ts --pr 42',
    `cd "$TARGET" && git -c 'alias.finish=!bun .safeword/scripts/closeout-cleanup.ts' finish --pr 42`,
    `cd "$TARGET" && git -c alias.finish='!bun' finish .safeword/scripts/closeout-cleanup.ts --pr 42`,
  ])('denies closeout behind a directory change it does not follow: %s', form => {
    repo();

    const result = runClaudeHook(
      primary,
      form.split('WORKTREE').join(worktreeA).split('CLOSEOUT').join(CLOSEOUT),
      'claude-session-forms',
    );

    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
    // The recovery is a runnable closeout command, never a wrapper or a second command.
    expect(output.hookSpecificOutput?.permissionDecisionReason).toMatch(
      /`bun [^`\s]*closeout-cleanup\.ts --pr 4[23]`/u,
    );
  });

  it.each([
    'grep -n binding .safeword/scripts/closeout-cleanup.ts | head -5',
    'git add packages/cli/templates/scripts/closeout-cleanup.ts',
  ])('leaves a command that only reads or stages the closeout script alone: %s', command => {
    repo();

    const result = runClaudeHook(worktreeA, command, 'claude-session-read');

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('deny');
  });

  it('keeps a quoted plugin script path with spaces in the recovery command', () => {
    repo();
    const plugin = nodePath.join(root, 'My Plugin');
    const script = nodePath.join(plugin, 'resources/scripts/closeout-cleanup.ts');

    const result = spawnSync('bun', [nodePath.join(HOOKS, 'pre-tool-quality.ts')], {
      cwd: primary,
      env: { ...hostEnvironment(primary), CLAUDE_PLUGIN_ROOT: plugin },
      input: JSON.stringify({
        session_id: 'claude-session-plugin',
        hook_event_name: 'PreToolUse',
        cwd: primary,
        tool_name: 'Bash',
        tool_input: { command: `cd "$TARGET" && bun "${script}" --pr 42` },
      }),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput?.permissionDecisionReason).toContain(
      `\`bun "${script}" --pr 42\``,
    );
  });

  it('gives a recovery the hook accepts when the agent used a ./ script path', () => {
    repo();
    const denied = runClaudeHook(
      primary,
      'cd "$TARGET" && bun ./.safeword/scripts/closeout-cleanup.ts --pr 42',
      'claude-session-dot',
    );
    const reason = (
      JSON.parse(denied.stdout) as { hookSpecificOutput?: { permissionDecisionReason?: string } }
    ).hookSpecificOutput?.permissionDecisionReason;
    const recovery = /`(bun [^`]+)`/u.exec(reason ?? '')?.[1];
    expect(recovery).toBeDefined();

    // Following the recovery from the worktree is accepted and records the binding.
    const retried = runClaudeHook(worktreeA, recovery ?? '', 'claude-session-dot');

    expect(retried.stdout).not.toContain('deny');
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeA })).toMatchObject({
      id: 'claude-session-dot',
    });
  });

  it("gives a recovery the hook accepts when the agent used the plugin's closeout command", () => {
    repo();
    const plugin = nodePath.join(root, 'plugin');
    const environment = { ...hostEnvironment(primary), CLAUDE_PLUGIN_ROOT: plugin };
    const run = (cwd: string, command: string) =>
      spawnSync('bun', [nodePath.join(HOOKS, 'pre-tool-quality.ts')], {
        cwd: primary,
        env: environment,
        input: JSON.stringify({
          session_id: 'claude-session-plugin-retry',
          hook_event_name: 'PreToolUse',
          cwd,
          tool_name: 'Bash',
          tool_input: { command },
        }),
        encoding: 'utf8',
      });
    const denied = run(
      primary,
      'cd "$TARGET" && bun "${CLAUDE_PLUGIN_ROOT}"/resources/scripts/closeout-cleanup.ts --pr 42',
    );
    const reason = (
      JSON.parse(denied.stdout) as { hookSpecificOutput?: { permissionDecisionReason?: string } }
    ).hookSpecificOutput?.permissionDecisionReason;
    const recovery = /`(bun [^`]+)`/u.exec(reason ?? '')?.[1];
    expect(recovery).toBeDefined();

    const retried = run(worktreeA, recovery ?? '');

    expect(retried.stdout).not.toContain('deny');
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeA })).toMatchObject({
      id: 'claude-session-plugin-retry',
    });
  });

  it('denies two closeout runs in one command, since only one binding can be recorded', () => {
    repo();

    const result = runClaudeHook(
      worktreeA,
      `${CLOSEOUT}; cd ${worktreeB} && bun .safeword/scripts/closeout-cleanup.ts --pr 43`,
      'claude-session-twice',
    );

    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string };
    };
    expect(output.hookSpecificOutput?.permissionDecision).toBe('deny');
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeA })).toBeUndefined();
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeB })).toBeUndefined();
  });

  it('closeout run inside a worktree finds the binding the Codex hook recorded', () => {
    repo();
    const environment = hostEnvironment(primary);

    const result = spawnSync(process.execPath, [testCliPath, 'hook', 'codex', 'pre-tool-use'], {
      cwd: primary,
      env: environment,
      input: JSON.stringify({
        session_id: 'codex-session-a',
        cwd: worktreeA,
        tool_name: 'Bash',
        tool_input: { command: CLOSEOUT },
      }),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeA })).toMatchObject({
      runtime: 'codex',
      id: 'codex-session-a',
    });
  });

  it('closeout run inside a worktree finds the binding the Cursor hook recorded', () => {
    repo();

    const result = spawnSync('bun', [nodePath.join(HOOKS, 'cursor/before-shell-execution.ts')], {
      cwd: primary,
      env: hostEnvironment(primary),
      input: JSON.stringify({
        workspace_roots: [primary],
        conversation_id: 'cursor-conversation-a',
        cwd: worktreeA,
        command: CLOSEOUT,
      }),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFreshCloseoutBinding({ projectDirectory: worktreeA })).toMatchObject({
      runtime: 'cursor',
      id: 'cursor-conversation-a',
    });
  });
});
