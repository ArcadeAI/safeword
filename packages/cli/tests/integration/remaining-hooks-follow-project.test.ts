/**
 * The remaining per-tool and SessionStart hooks act on the project the call
 * resolves to, not the launch checkout (#5467 part 2b). Each hook runs with
 * CLAUDE_PROJECT_DIR and its process cwd at launch checkout A, which is not
 * enrolled, while the call targets enrolled worktree B. A hook that still
 * picked its project from CLAUDE_PROJECT_DIR would see no Safeword at A and
 * stay silent, so each assertion fails unless the hook resolved B.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const HOOKS = nodePath.resolve(import.meta.dirname, '../../templates/hooks');

function runHook(hook: string, launch: string, input: Record<string, unknown>) {
  return spawnSync('bun', [nodePath.join(HOOKS, hook)], {
    input: JSON.stringify(input),
    cwd: launch,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: launch,
      CLAUDE_PLUGIN_ROOT: '',
      SAFEWORD_PLUGIN_CLI: '',
    },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('remaining hooks act on the resolved project (#5467)', () => {
  let root: string;
  let launch: string;
  let worktree: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = nodePath.join(root, 'launch');
    mkdirSync(launch);
    writeFileSync(nodePath.join(launch, '.git'), 'gitdir: elsewhere\n');
    worktree = nodePath.join(root, 'worktree');
    mkdirSync(nodePath.join(worktree, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(worktree, '.git'), 'gitdir: elsewhere\n');
    writeFileSync(nodePath.join(worktree, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    writeFileSync(nodePath.join(worktree, '.safeword', 'version'), '9.9.9-worktree\n');
    mkdirSync(nodePath.join(worktree, 'src'));
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  it('session-version reports the version of the worktree the session starts in', () => {
    const result = runHook('session-version.ts', launch, {
      session_id: `version-${process.pid}`,
      hook_event_name: 'SessionStart',
      cwd: worktree,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('v9.9.9-worktree');
  });

  it('session-lint-check checks the lint setup of the worktree the session starts in', () => {
    const result = runHook('session-lint-check.ts', launch, {
      session_id: `lint-check-${process.pid}`,
      hook_event_name: 'SessionStart',
      cwd: worktree,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ESLint config not found');
  });

  it('post-tool-bypass-warn warns about a bypass added in the worktree', () => {
    const file = nodePath.join(worktree, 'src/a.ts');
    writeFileSync(file, '// eslint-disable-next-line\nexport const a = 1;\n');

    const result = runHook('post-tool-bypass-warn.ts', launch, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      cwd: launch,
      tool_input: { file_path: file, new_string: '// eslint-disable-next-line' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('eslint-disable');
  });

  it("pre-tool-config-guard asks before an edit to the worktree's CI config", () => {
    const file = nodePath.join(worktree, '.gitlab-ci.yml');

    const result = runHook('pre-tool-config-guard.ts', launch, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      cwd: launch,
      tool_input: { file_path: file, old_string: 'a', new_string: 'b' },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('ask');
  });

  it("post-tool-sync-learnings warns about a stamp in the worktree's learnings", () => {
    const learning = nodePath.join(worktree, '.project/learnings/astro.md');
    mkdirSync(nodePath.dirname(learning), { recursive: true });
    writeFileSync(learning, '# Astro\n\nCovers: content config\n\n✅ Verified by build\n');

    const result = runHook('post-tool-sync-learnings.ts', launch, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      cwd: launch,
      tool_input: { file_path: learning },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Verification stamp detected in .project/learnings/astro.md');
  });

  /** A stub source CLI in the worktree that records where and for which project it ran. */
  function stubWorktreeCli(): string {
    const log = nodePath.join(root, 'cli-runs.jsonl');
    mkdirSync(nodePath.join(worktree, 'packages/cli/src'), { recursive: true });
    writeFileSync(nodePath.join(worktree, 'packages/cli/package.json'), '{"name":"safeword"}\n');
    writeFileSync(
      nodePath.join(worktree, 'packages/cli/src/cli.ts'),
      `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), project: process.env.CLAUDE_PROJECT_DIR }) + '\\n');\n`,
    );
    return log;
  }

  function cliRuns(log: string): { args: string[]; project: string }[] {
    return readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { args: string[]; project: string });
  }

  it('post-tool-sync-learnings tells the CLI it is syncing the worktree', () => {
    const log = stubWorktreeCli();
    const learning = nodePath.join(worktree, '.project/learnings/caching.md');
    mkdirSync(nodePath.dirname(learning), { recursive: true });
    writeFileSync(learning, '# Caching\n\nCovers: caching\n');

    const result = runHook('post-tool-sync-learnings.ts', launch, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      cwd: launch,
      tool_input: { file_path: learning },
    });

    expect(result.status).toBe(0);
    const runs = cliRuns(log);
    expect(runs.map(run => run.args[0])).toEqual(['sync-learnings']);
    expect(realpathSync(runs[0]?.project ?? '')).toBe(realpathSync(worktree));
  });

  it('the done gate runs the test plan the CLI resolves for the worktree', () => {
    // Like the real CLI, the stub resolves the plan for the project named by
    // CLAUDE_PROJECT_DIR: its test command runs there and leaves a marker.
    mkdirSync(nodePath.join(worktree, 'packages/cli/src'), { recursive: true });
    writeFileSync(nodePath.join(worktree, 'packages/cli/package.json'), '{"name":"safeword"}\n');
    writeFileSync(
      nodePath.join(worktree, 'packages/cli/src/cli.ts'),
      [
        'const project = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();',
        "const kind = process.argv[process.argv.indexOf('--kind') + 1];",
        "const plan = kind === 'test'",
        "  ? [{ command: 'touch tests-ran-here', cwd: project, runner: 'test', language: 'javascript', available: true }]",
        '  : [];',
        'console.log(JSON.stringify({ schema_version: 1, data: { plan } }));',
      ].join('\n'),
    );
    const script = `const { runTests } = await import(${JSON.stringify(nodePath.join(HOOKS, 'lib/test-runner.ts'))});\nconsole.log(JSON.stringify(runTests(${JSON.stringify(worktree)})));`;

    const result = spawnSync('bun', ['-e', script], {
      cwd: launch,
      env: { ...process.env, CLAUDE_PROJECT_DIR: launch, SAFEWORD_CLI: '' },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    expect(result.status, result.stderr).toBe(0);
    const testResult = JSON.parse(result.stdout.trim().split('\n').at(-1) ?? '{}') as {
      passed?: boolean;
      skipped?: boolean;
      resolutionFailed?: boolean;
    };
    expect(testResult).toMatchObject({ passed: true, skipped: false });
    expect(testResult.resolutionFailed).not.toBe(true);
    expect(existsSync(nodePath.join(worktree, 'tests-ran-here'))).toBe(true);
    expect(existsSync(nodePath.join(launch, 'tests-ran-here'))).toBe(false);
  });

  it("post-tool-lint runs the linter with the worktree's config for a relative edit", () => {
    // Both checkouts carry a Ruff config; a stub ruff records the exact
    // command line, so only the config the hook really used can pass.
    for (const checkout of [launch, worktree]) {
      mkdirSync(nodePath.join(checkout, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(checkout, '.safeword', 'ruff.toml'), 'line-length = 100\n');
    }
    writeFileSync(nodePath.join(worktree, 'src/app.py'), 'x = 1\n');
    const stubBin = nodePath.join(root, 'stub-bin');
    const invocationLog = nodePath.join(root, 'invocations.log');
    mkdirSync(stubBin);
    for (const command of ['ruff', 'bunx', 'git']) {
      const stub = nodePath.join(stubBin, command);
      writeFileSync(
        stub,
        `#!/bin/sh\nprintf '%s %s\\n' ${JSON.stringify(command)} "$*" >> ${JSON.stringify(invocationLog)}\nexit 0\n`,
      );
      chmodSync(stub, 0o755);
    }

    // A relative edit path: relative to the reported cwd (the worktree), not
    // to the hook process's cwd (the launch checkout).
    const result = spawnSync('bun', [nodePath.join(HOOKS, 'post-tool-lint.ts')], {
      input: JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        cwd: worktree,
        tool_input: { file_path: 'src/app.py' },
      }),
      cwd: launch,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: launch,
        HOME: root,
        PATH: `${stubBin}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    expect(result.status, result.stderr).toBe(0);
    const ruffRuns = readFileSync(invocationLog, 'utf8')
      .split('\n')
      .filter(line => line.startsWith('ruff '));
    expect(ruffRuns.length).toBeGreaterThan(0);
    const worktreeConfig = `${realpathSync(worktree)}/.safeword/ruff.toml`;
    const launchConfig = `${realpathSync(launch)}/.safeword/ruff.toml`;
    for (const run of ruffRuns) {
      expect(run).toContain(worktreeConfig);
      expect(run).not.toContain(launchConfig);
      expect(run).toContain(`${realpathSync(worktree)}/src/app.py`);
    }
  });
});
