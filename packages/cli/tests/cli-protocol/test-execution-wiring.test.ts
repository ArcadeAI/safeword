import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

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
        '--offline',
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
        '--offline',
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
        '--offline',
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
          { source: 'command' },
          { source: 'personal' },
          { source: 'project' },
          { source: 'built-in', mode: 'local' },
        ],
      },
    });
  });

  it('uses a valid private preference without changing the shared project config', async () => {
    const directory = createTemporaryDirectory();
    const personalDirectory = nodePath.join(directory, '.project', 'personal');
    mkdirSync(personalDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(personalDirectory, 'config.json'),
      JSON.stringify({ schemaVersion: 1, testExecution: 'remote-preferred' }),
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
    const personalDirectory = nodePath.join(directory, '.project', 'personal');
    const projectDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(personalDirectory, { recursive: true });
    mkdirSync(projectDirectory, { recursive: true });
    const personalConfig = JSON.stringify({ schemaVersion: 1, testExecution: input.mode });
    const projectConfig = JSON.stringify({ testExecution: 'remote-preferred' });
    writeFileSync(nodePath.join(personalDirectory, 'config.json'), personalConfig);
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
      [
        'project',
        'test',
        '--lane',
        'done',
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
        effective: { mode: input.mode, source: 'personal' },
        dispatch: { attempted: false },
        fallback: { used: input.fallbackUsed },
        executed: 1,
      },
    });
    expect(readFileSync(nodePath.join(directory, 'runs.log'), 'utf8')).toBe('run\n');
    expect(readFileSync(nodePath.join(personalDirectory, 'config.json'), 'utf8')).toBe(
      personalConfig,
    );
    expect(readFileSync(nodePath.join(projectDirectory, 'config.json'), 'utf8')).toBe(
      projectConfig,
    );
  });

  it('fails closed for malformed personal configuration without changing files', async () => {
    const directory = createTemporaryDirectory();
    const personalDirectory = nodePath.join(directory, '.project', 'personal');
    mkdirSync(personalDirectory, { recursive: true });
    writeFileSync(nodePath.join(personalDirectory, 'config.json'), '{ bad json');

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
});
