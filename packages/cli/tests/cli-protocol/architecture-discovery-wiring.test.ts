import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { addGlobalOptions } from '../../src/cli-protocol/execute.js';
import { registerPublicCommandCatalog } from '../../src/cli-protocol/register.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

vi.mock('node:fs', { spy: true });

const directories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories) removeTemporaryDirectory(directory);
  directories.length = 0;
});

describe('project architecture discovery wiring', () => {
  it.each([
    { mode: 'heal', options: [] as string[], expectedState: 'changed' },
    { mode: 'check', options: ['--check'], expectedState: 'action_required' },
  ])('reads the workspace manifest once for a registered-command $mode', async testCase => {
    const directory = createTemporaryDirectory();
    directories.push(directory);
    const manifestPath = nodePath.join(directory, 'package.json');
    writeFileSync(manifestPath, JSON.stringify({ name: 'root', workspaces: ['packages/*'] }));
    const packageDirectory = nodePath.join(directory, 'packages', 'core');
    mkdirSync(nodePath.join(packageDirectory, 'src', 'auth'), { recursive: true });
    writeFileSync(
      nodePath.join(packageDirectory, 'package.json'),
      JSON.stringify({ name: 'core' }),
    );
    vi.mocked(readFileSync).mockClear();

    const stdout: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      stdout.push(String(chunk));
      return true;
    });
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      const program = new Command().name('safeword');
      addGlobalOptions(program);
      registerPublicCommandCatalog(program);
      await program.parseAsync([
        'node',
        'safeword',
        'project',
        'architecture',
        ...testCase.options,
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ]);

      expect(JSON.parse(stdout.join(''))).toMatchObject({
        state: testCase.expectedState,
        data: { command: 'project architecture' },
      });
      const manifestReads = vi
        .mocked(readFileSync)
        .mock.calls.filter(([candidate]) => candidate === manifestPath);
      expect(manifestReads).toHaveLength(1);
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});
