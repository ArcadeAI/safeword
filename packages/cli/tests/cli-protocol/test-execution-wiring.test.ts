import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

// eslint-disable-next-line unicorn/no-null -- JSON output deliberately represents no action with null.
const NONE = null;

function initializePrivateConfigRepo(directory: string): void {
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  writeFileSync(nodePath.join(directory, '.gitignore'), '.safeword/config.local.json\n');
}

describe('test execution CLI wiring', () => {
  it('runs the project-owned remote setup command before the test plan', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({
        remoteTest: {
          setupCommand: "node -e \"require('node:fs').writeFileSync('prepared','yes')\"",
        },
      }),
    );
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'prepared-test-project',
        private: true,
        packageManager: 'npm@11.0.0',
        scripts: {
          'test:done':
            "node -e \"process.exit(require('node:fs').readFileSync('prepared','utf8')==='yes'?0:1)\"",
        },
      }),
    );

    const result = await runCli(
      ['project', 'test', '--prepare-remote', '--no-input', '--cwd', directory],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(0);
    expect(readFileSync(nodePath.join(directory, 'prepared'), 'utf8')).toBe('yes');
  });

  it('requires action when no runnable test plan exists', async () => {
    const directory = createTemporaryDirectory();

    const result = await runCli(['project', 'test', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
    });

    expect(result).toMatchObject({ exitCode: 2, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [expect.objectContaining({ code: 'SAFEWORD_TEST_PLAN_EMPTY' })],
      data: { command: 'project test', executed: 0 },
    });
  });

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
        workflow: {
          state: 'not_installed',
          affectedPath: '.github/workflows/safeword-remote-tests.yml',
          nextAction: 'install_remote_tests',
        },
      },
    });
  });

  it.each([
    [
      'absent',
      undefined,
      "Run `bunx safeword project test-execution remote setup` to install Safeword's test workflow.",
    ],
    [
      'customer-owned',
      'customer',
      "Safeword won't overwrite the differing workflow. Compare or move it aside, then run the command again.",
    ],
    ['unsafe', 'symlink', 'Repair the workflow path, then run the command again.'],
  ] as const)('renders the %s status action plainly', async (_fixture, setup, sentence) => {
    const directory = createTemporaryDirectory();
    if (setup === 'customer') {
      const path = nodePath.join(directory, '.github', 'workflows', 'safeword-remote-tests.yml');
      mkdirSync(nodePath.dirname(path), { recursive: true });
      writeFileSync(path, 'name: customer\n');
    } else if (setup === 'symlink') {
      symlinkSync(directory, nodePath.join(directory, '.github'));
    }

    const result = await runCli(
      [
        'project',
        'test-execution',
        'remote',
        'status',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(sentence);
  });

  it('returns stable status output when the project does not change', async () => {
    const directory = createTemporaryDirectory();
    const args = [
      'project',
      'test-execution',
      'remote',
      'status',
      '--json',
      '--no-input',
      '--offline',
      '--cwd',
      directory,
    ];

    const first = await runCli(args, { cwd: directory });
    const second = await runCli(args, { cwd: directory });

    expect(second).toEqual(first);
  });

  it('installs the managed remote workflow without changing execution preference', async () => {
    const directory = createTemporaryDirectory();
    const safewordDirectory = nodePath.join(directory, '.safeword');
    const bundledWorkflow = readFileSync(
      nodePath.join(process.cwd(), 'templates/workflows/remote-tests.yml'),
      'utf8',
    );
    mkdirSync(safewordDirectory, { recursive: true });
    const projectConfig = JSON.stringify({ testExecution: 'remote-preferred' });
    writeFileSync(nodePath.join(safewordDirectory, 'config.json'), projectConfig);

    const result = await runCli(
      [
        'project',
        'test-execution',
        'remote',
        'setup',
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
      state: 'changed',
      data: {
        command: 'project test-execution remote setup',
        workflow: { state: 'current', changed: true, effectiveMode: 'remote-preferred' },
      },
    });
    expect(
      readFileSync(
        nodePath.join(directory, '.github', 'workflows', 'safeword-remote-tests.yml'),
        'utf8',
      ),
    ).toBe(bundledWorkflow);
    expect(readFileSync(nodePath.join(safewordDirectory, 'config.json'), 'utf8')).toBe(
      projectConfig,
    );
  });

  it('upgrades every released workflow through the packaged setup command', async () => {
    const fixtureDirectory = nodePath.join(process.cwd(), 'tests', 'fixtures');
    const bundledWorkflow = readFileSync(
      nodePath.join(process.cwd(), 'templates/workflows/remote-tests.yml'),
      'utf8',
    );
    const releasedFixtures = readdirSync(fixtureDirectory).filter(name =>
      /^remote-workflow-v\d+\.yml$/.test(name),
    );
    expect(releasedFixtures.length).toBeGreaterThan(0);

    for (const fixtureName of releasedFixtures) {
      const directory = createTemporaryDirectory();
      const workflowPath = nodePath.join(
        directory,
        '.github',
        'workflows',
        'safeword-remote-tests.yml',
      );
      mkdirSync(nodePath.dirname(workflowPath), { recursive: true });
      writeFileSync(workflowPath, readFileSync(nodePath.join(fixtureDirectory, fixtureName)));

      const result = await runCli(
        [
          'project',
          'test-execution',
          'remote',
          'setup',
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
        state: 'changed',
        data: {
          command: 'project test-execution remote setup',
          workflow: { state: 'current', changed: true },
        },
      });
      expect(readFileSync(workflowPath, 'utf8')).toBe(bundledWorkflow);
    }
  });

  it('removes only the managed remote workflow without changing execution preference', async () => {
    const directory = createTemporaryDirectory();
    const safewordDirectory = nodePath.join(directory, '.safeword');
    const workflowDirectory = nodePath.join(directory, '.github', 'workflows');
    const workflowPath = nodePath.join(workflowDirectory, 'safeword-remote-tests.yml');
    const bundledWorkflow = readFileSync(
      nodePath.join(process.cwd(), 'templates/workflows/remote-tests.yml'),
      'utf8',
    );
    mkdirSync(safewordDirectory, { recursive: true });
    mkdirSync(workflowDirectory, { recursive: true });
    const projectConfig = JSON.stringify({ testExecution: 'remote-preferred' });
    writeFileSync(nodePath.join(safewordDirectory, 'config.json'), projectConfig);
    writeFileSync(workflowPath, bundledWorkflow);

    const result = await runCli(
      [
        'project',
        'test-execution',
        'remote',
        'disable',
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
      state: 'changed',
      data: {
        command: 'project test-execution remote disable',
        workflow: { state: 'not_installed', changed: true },
      },
    });
    expect(() => readFileSync(workflowPath, 'utf8')).toThrow();
    expect(readFileSync(nodePath.join(safewordDirectory, 'config.json'), 'utf8')).toBe(
      projectConfig,
    );
  });

  it('disables the packaged workflow after project configuration is absent', async () => {
    const directory = createTemporaryDirectory();
    const workflowPath = nodePath.join(
      directory,
      '.github',
      'workflows',
      'safeword-remote-tests.yml',
    );
    mkdirSync(nodePath.dirname(workflowPath), { recursive: true });
    const bundledWorkflow = readFileSync(
      nodePath.join(process.cwd(), 'templates', 'workflows', 'remote-tests.yml'),
    );
    writeFileSync(workflowPath, bundledWorkflow);

    const result = await runCli(
      [
        'project',
        'test-execution',
        'remote',
        'disable',
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      data: { workflow: { state: 'not_installed', changed: true } },
    });
    expect(() => readFileSync(workflowPath, 'utf8')).toThrow();
  });

  it('treats a customer-owned workflow as a successful disable no-op', async () => {
    const directory = createTemporaryDirectory();
    const workflowPath = nodePath.join(
      directory,
      '.github',
      'workflows',
      'safeword-remote-tests.yml',
    );
    mkdirSync(nodePath.dirname(workflowPath), { recursive: true });
    writeFileSync(workflowPath, 'name: customer workflow\n');

    const result = await runCli(
      [
        'project',
        'test-execution',
        'remote',
        'disable',
        '--json',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );
    const output = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output).toMatchObject({
      state: 'healthy',
      data: {
        command: 'project test-execution remote disable',
        workflow: {
          state: 'customer_owned',
          changed: false,
          affectedPath: NONE,
          nextAction: NONE,
        },
      },
    });
    expect(readFileSync(workflowPath, 'utf8')).toBe('name: customer workflow\n');
  });

  it.each([
    ['setup', 2, 'action_required'],
    ['disable', 0, 'healthy'],
  ] as const)(
    'reports customer-owned %s consistently in JSON',
    async (command, exitCode, state) => {
      const directory = createTemporaryDirectory();
      const workflowPath = nodePath.join(
        directory,
        '.github',
        'workflows',
        'safeword-remote-tests.yml',
      );
      mkdirSync(nodePath.dirname(workflowPath), { recursive: true });
      writeFileSync(workflowPath, 'name: customer\n');

      const result = await runCli(
        [
          'project',
          'test-execution',
          'remote',
          command,
          '--json',
          '--no-input',
          '--offline',
          '--cwd',
          directory,
        ],
        { cwd: directory },
      );

      expect(result.exitCode).toBe(exitCode);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state,
        data: { workflow: { state: 'customer_owned', changed: false } },
      });
      expect(readFileSync(workflowPath, 'utf8')).toBe('name: customer\n');
    },
  );

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
