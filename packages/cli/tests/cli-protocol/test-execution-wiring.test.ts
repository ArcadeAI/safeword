import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

describe('test execution CLI wiring', () => {
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
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
