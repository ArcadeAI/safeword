import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

function initializePrivateConfigRepo(directory: string): void {
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  writeFileSync(nodePath.join(directory, '.gitignore'), '.safeword/config.local.json\n');
}

describe('test execution CLI wiring', () => {
  it('runs the resolved done plan once when a command selects local execution', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'local-test-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:done': String.raw`node -e "require('node:fs').appendFileSync('runs.log','run\n')"`,
        },
      }),
    );

    const result = await runCli(
      [
        'project',
        'test',
        '--lane',
        'done',
        '--execution',
        'local',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/local.*command|command.*local/i);
    expect(readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toBe('run\n');
  });

  it('preserves a nonzero exit from the resolved full verification plan', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ testExecution: 'remote-preferred' }),
    );
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'local-verification-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:ci': String.raw`node -e "require('node:fs').appendFileSync('runs.log','run\n');process.exit(23)"`,
        },
      }),
    );

    const result = await runCli(
      [
        'project',
        'test',
        '--lane',
        'full',
        '--execution',
        'local',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(23);
    expect(result.stderr).toMatch(/exited with status 23/i);
    expect(readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toBe('run\n');
  });

  it('reports fallback before dispatch when a command prefers unavailable remote execution', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'remote-preferred-test-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:done': String.raw`node -e "require('node:fs').appendFileSync('runs.log','run\n')"`,
        },
      }),
    );

    const result = await runCli(
      [
        'project',
        'test',
        '--lane',
        'done',
        '--execution',
        'remote-preferred',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      data: {
        effective: { mode: 'remote-preferred', source: 'command' },
        remote: { available: false },
        dispatch: { attempted: false },
        fallback: { used: true, execution: 'local', reason: 'remote-unavailable' },
        executed: 1,
      },
    });
    expect(readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toBe('run\n');
  });

  it('refuses repository test commands offline before executing the plan', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'offline-test-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:done': String.raw`node -e "require('node:fs').appendFileSync('runs.log','run\n')"`,
        },
      }),
    );

    const result = await runCli(
      ['project', 'test', '--json', '--no-input', '--offline', '--cwd', directory],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 2, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [expect.objectContaining({ code: 'CLI_ONLINE_REQUIRED' })],
      data: { command: 'project test', offline: true },
    });
    expect(() => readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toThrow();
  });

  it('preserves JSON output from every executed language runner', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'requirements.txt'), '');
    writeFileSync(
      nodePath.join(directory, 'test_sample.py'),
      "import unittest\n\nclass SampleTest(unittest.TestCase):\n    def test_output(self):\n        print('python-output')\n",
    );
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'polyglot-output-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: { 'test:done': `node -e "console.log('javascript-output')"` },
      }),
    );

    const result = await runCli(['project', 'test', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
      env: { SAFEWORD_FAKE_TOOLS: 'only:npm,python3' },
    });

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      data: {
        executed: 2,
        childOutput: [
          { runner: 'npm', stdout: expect.stringContaining('javascript-output') },
          { runner: 'unittest', stdout: expect.stringContaining('python-output') },
        ],
      },
    });
  });

  it('captures noisy JSON runner output beyond Node default buffer limits', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'noisy-output-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: { 'test:done': `node -e "process.stdout.write('x'.repeat(1250000))"` },
      }),
    );

    const result = await runCli(['project', 'test', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
    });

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    const output = JSON.parse(result.stdout) as {
      state: string;
      data: { childOutput: { runner: string; stdout: string; stderr: string }[] };
    };
    expect(output.state).toBe('healthy');
    expect(output.data.childOutput).toHaveLength(1);
    expect(output.data.childOutput[0]).toMatchObject({ runner: 'npm', stderr: '' });
    expect(output.data.childOutput[0]?.stdout).toContain('x'.repeat(1_250_000));
  });

  it.each([
    { source: 'project', lane: 'done', planKind: 'test' },
    { source: 'personal', lane: 'full', planKind: 'verify' },
  ] as const)('falls back to the $planKind plan for a $source preference', async input => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ testExecution: 'remote-preferred' }),
    );
    if (input.source === 'personal') {
      initializePrivateConfigRepo(directory);
      const personalDirectory = nodePath.join(directory, '.safeword');
      mkdirSync(personalDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(personalDirectory, 'config.local.json'),
        JSON.stringify({ testExecution: 'remote-preferred' }),
      );
    }
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'preference-fallback-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:done': String.raw`node -e "require('node:fs').appendFileSync('runs.log','done\n')"`,
          'test:ci': String.raw`node -e "require('node:fs').appendFileSync('runs.log','full\n')"`,
        },
      }),
    );

    const result = await runCli(
      ['project', 'test', '--lane', input.lane, '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        effective: { mode: 'remote-preferred', source: input.source },
        remote: { available: false },
        dispatch: { attempted: false },
        fallback: { used: true, execution: 'local', reason: 'remote-unavailable' },
        planKind: input.planKind,
        executed: 1,
      },
    });
    expect(readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toBe(`${input.lane}\n`);
  });

  it('reports the built-in local preference without changing a project', async () => {
    const directory = createTemporaryDirectory();
    const result = await runCli(
      [
        'project',
        'test-execution',
        'status',
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      changed: false,
      effects: { files: [], configuration: [] },
      data: {
        command: 'project test-execution status',
        effective: { mode: 'local', source: 'built-in' },
        remote: { available: false },
        scopes: [
          { source: 'command', mode: 'not applicable' },
          { source: 'personal' },
          { source: 'project' },
          { source: 'built-in', mode: 'local' },
        ],
      },
    });
  });

  it('reports an absent managed remote workflow without mutation', async () => {
    const directory = createTemporaryDirectory();

    const result = await runCli(
      [
        'project',
        'test-execution',
        'remote',
        'status',
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      changed: false,
      data: {
        command: 'project test-execution remote status',
        // eslint-disable-next-line unicorn/no-null -- JSON lifecycle protocol uses null for no path/action.
        workflow: { state: 'not_installed', affectedPath: null, nextAction: null },
      },
    });
  });

  it('uses a valid private preference without changing the shared project config', async () => {
    const directory = createTemporaryDirectory();
    initializePrivateConfigRepo(directory);
    const personalDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(personalDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(personalDirectory, 'config.local.json'),
      JSON.stringify({ testExecution: 'remote-preferred' }),
    );

    const result = await runCli(
      [
        'project',
        'test-execution',
        'status',
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        effective: { mode: 'remote-preferred', source: 'personal' },
        scopes: expect.arrayContaining([
          expect.objectContaining({ source: 'personal', mode: 'remote-preferred' }),
        ]),
      },
    });
  });

  it.each([
    { mode: 'local', fallbackUsed: false },
    { mode: 'remote-preferred', fallbackUsed: true },
  ] as const)('uses a $mode personal preference for a test request', async input => {
    const directory = createTemporaryDirectory();
    initializePrivateConfigRepo(directory);
    const personalDirectory = nodePath.join(directory, '.safeword');
    const projectDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(personalDirectory, { recursive: true });
    mkdirSync(projectDirectory, { recursive: true });
    const personalConfig = JSON.stringify({ testExecution: input.mode });
    const projectConfig = JSON.stringify({ testExecution: 'remote-preferred' });
    writeFileSync(nodePath.join(personalDirectory, 'config.local.json'), personalConfig);
    writeFileSync(nodePath.join(projectDirectory, 'config.json'), projectConfig);
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'personal-preference-test-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:done': String.raw`node -e "require('node:fs').appendFileSync('runs.log','run\n')"`,
        },
      }),
    );

    const result = await runCli(
      ['project', 'test', '--lane', 'done', '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        effective: { mode: input.mode, source: 'personal' },
        dispatch: { attempted: false },
        fallback: { used: input.fallbackUsed },
        executed: 1,
      },
    });
    expect(readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toBe('run\n');
    expect(readFileSync(nodePath.join(personalDirectory, 'config.local.json'), 'utf8')).toBe(
      personalConfig,
    );
    expect(readFileSync(nodePath.join(projectDirectory, 'config.json'), 'utf8')).toBe(
      projectConfig,
    );
  });

  it('keeps personal preferences isolated between worktrees', async () => {
    const worktreeA = createTemporaryDirectory();
    const worktreeB = createTemporaryDirectory();
    for (const [directory, mode] of [
      [worktreeA, 'local'],
      [worktreeB, 'remote-preferred'],
    ] as const) {
      initializePrivateConfigRepo(directory);
      const personalDirectory = nodePath.join(directory, '.safeword');
      mkdirSync(personalDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(personalDirectory, 'config.local.json'),
        JSON.stringify({ testExecution: mode }),
      );
    }

    const readStatus = (directory: string) =>
      runCli(
        [
          'project',
          'test-execution',
          'status',
          '--json',
          '--no-input',
          '--offline',
          '--cwd',
          directory,
        ],
        { cwd: directory },
      );
    const [resultA, resultB] = await Promise.all([readStatus(worktreeA), readStatus(worktreeB)]);

    const statusA = JSON.parse(resultA.stdout) as Record<string, unknown>;
    const statusB = JSON.parse(resultB.stdout) as Record<string, unknown>;
    expect(resultA).toMatchObject({ exitCode: 0, stderr: '' });
    expect(resultB).toMatchObject({ exitCode: 0, stderr: '' });
    expect(statusA).toMatchObject({
      data: {
        effective: { mode: 'local', source: 'personal' },
        scopes: expect.arrayContaining([
          expect.objectContaining({
            source: 'personal',
            mode: 'local',
            path: '.safeword/config.local.json',
          }),
        ]),
      },
    });
    expect(statusB).toMatchObject({
      data: {
        effective: { mode: 'remote-preferred', source: 'personal' },
        scopes: expect.arrayContaining([
          expect.objectContaining({
            source: 'personal',
            mode: 'remote-preferred',
            path: '.safeword/config.local.json',
          }),
        ]),
      },
    });
  });

  it('fails closed for malformed personal configuration without changing files', async () => {
    const directory = createTemporaryDirectory();
    initializePrivateConfigRepo(directory);
    const personalDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(personalDirectory, { recursive: true });
    writeFileSync(nodePath.join(personalDirectory, 'config.local.json'), '{ bad json');

    const result = await runCli(
      [
        'project',
        'test-execution',
        'status',
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      effects: { files: [], configuration: [] },
      errors: [expect.objectContaining({ code: 'SAFEWORD_TEST_EXECUTION_INVALID' })],
    });
  });

  it('blocks an unignored personal configuration before executing a test plan', async () => {
    const directory = createTemporaryDirectory();
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    const personalDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(personalDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(personalDirectory, 'config.local.json'),
      JSON.stringify({ testExecution: 'local' }),
    );
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'unsafe-personal-config-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:done': String.raw`node -e "require('node:fs').appendFileSync('runs.log','run\n')"`,
        },
      }),
    );

    const result = await runCli(
      ['project', 'test', '--lane', 'done', '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [
        expect.objectContaining({
          code: 'SAFEWORD_TEST_EXECUTION_INVALID',
          message: expect.stringMatching(/ignored.*untracked/i),
        }),
      ],
    });
    expect(() => readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toThrow();
  });

  it('rejects duplicate execution overrides before executing a test plan', async () => {
    const directory = createTemporaryDirectory();
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'duplicate-execution-mode-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:done': String.raw`node -e "require('node:fs').appendFileSync('runs.log','run\n')"`,
        },
      }),
    );

    const result = await runCli(
      [
        'project',
        'test',
        '--lane',
        'done',
        '--execution',
        'local',
        '--execution',
        'remote-preferred',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [expect.objectContaining({ code: 'SAFEWORD_TEST_EXECUTION_INVALID' })],
    });
    expect(() => readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toThrow();
  });
});
