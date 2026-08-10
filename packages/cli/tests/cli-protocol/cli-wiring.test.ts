import { readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import {
  installEmptyClaudeRuntime,
  installFakeCodexRuntime,
} from '../helpers/fake-codex-runtime.js';

describe('predictable CLI wiring', () => {
  it.each([['retro-relay-retry'], ['retro-relay-discard', '00000000-0000-4000-8000-000000002251']])(
    'renders %s through the public machine envelope',
    async (...command) => {
      const directory = createTemporaryDirectory();
      const result = await runCli([
        ...command,
        '--json',
        '--quiet',
        '--no-input',
        '--offline',
        '--cwd',
        directory,
      ]);

      expect(result.stderr).toBe('');
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      const envelope = JSON.parse(result.stdout) as {
        schema_version?: number;
        state?: string;
        data?: { command?: string };
      };
      expect(envelope.schema_version).toBe(1);
      expect(envelope.data?.command).toBe(command[0]);
      expect(['healthy', 'action_required']).toContain(envelope.state);
    },
  );

  it('publishes capabilities as JSON-only stdout', async () => {
    const result = await runCli(['capabilities', '--json', '--no-input']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    const envelope = JSON.parse(result.stdout) as {
      schema_version: number;
      data: {
        commands: {
          name: string;
          options: { flags: string; description: string; value_kind?: string }[];
        }[];
      };
    };
    expect(envelope.schema_version).toBe(1);
    expect(envelope.data.commands.some(command => command.name === 'boundary')).toBe(false);
    expect(envelope.data.commands.find(command => command.name === 'remove')?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flags: '--plan <id>',
          value_kind: 'plan-identity',
        }),
      ]),
    );
    expect(
      envelope.data.commands.find(command => command.name === 'tracker sync')?.options,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flags: '--plan',
        }),
      ]),
    );
  });

  it('accepts global machine options before or after a command', async () => {
    const before = await runCli(['--json', '--no-input', 'capabilities']);
    const after = await runCli(['capabilities', '--json', '--no-input']);

    expect(before).toMatchObject({ exitCode: 0, stderr: '' });
    expect(before.stdout).toBe(after.stdout);
  });

  it('uses bare Safeword as read-only status with one next action', async () => {
    const directory = createTemporaryDirectory();
    const runtime = installFakeCodexRuntime(createTemporaryDirectory(), {
      pluginEnabled: false,
      pluginInitiallyInstalled: false,
    });
    installEmptyClaudeRuntime(runtime.bin);
    const before = readdirSync(directory);
    const result = await runCli(['--json', '--no-input', '--offline', '--cwd', directory], {
      cwd: directory,
      env: {
        CODEX_HOME: runtime.codexHome,
        SAFEWORD_CODEX_LOG: runtime.logPath,
        PATH: `${runtime.bin}:${process.env.PATH ?? ''}`,
      },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('');
    expect(readdirSync(directory)).toEqual(before);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      state: 'action_required',
      changed: false,
      effects: {
        files: [],
        packages: [],
        configuration: [],
        network: [],
        destructive: [],
      },
      next_actions: [{ command: 'safeword install', mutates: true, requires_human: false }],
    });
  });

  it('keeps status read-only with options after the command', async () => {
    const directory = createTemporaryDirectory();
    const before = readdirSync(directory);
    const result = await runCli(
      ['status', '--json', '--no-input', '--offline', '--cwd', directory],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(2);
    expect(readdirSync(directory)).toEqual(before);
    expect(JSON.parse(result.stdout)).toMatchObject({ state: 'action_required' });
  });
});
