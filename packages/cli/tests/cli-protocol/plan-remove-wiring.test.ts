import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { createTemporaryDirectory, runCli, runCliWithLiteralArguments } from '../helpers.js';
import { installFakeCodexRuntime } from '../helpers/fake-codex-runtime.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const CURRENT_MARKETPLACE_REF = SAFEWORD_SCHEMA.version.includes('-')
  ? `v${SAFEWORD_SCHEMA.version}`
  : 'stable';

function configureMinimalProject(directory: string): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(directory, '.safeword', 'version'), '0.69.0\n');
}

function createMissingClaudeHost(directory: string): string {
  const bin = nodePath.join(directory, 'bin');
  mkdirSync(bin, { recursive: true });
  const claude = nodePath.join(bin, 'claude');
  writeFileSync(
    claude,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then',
      String.raw`  printf '%s\n' '2.1.170'`,
      'else',
      String.raw`  printf '%s\n' '[]'`,
      'fi',
      '',
    ].join('\n'),
  );
  chmodSync(claude, 0o755);
  return bin;
}

function createUserScopedClaudeHost(
  directory: string,
  marketplaceCurrent = true,
  autoUpdate = true,
): { bin: string; claudeConfig: string; log: string } {
  const bin = nodePath.join(directory, 'bin');
  const claudeConfig = nodePath.join(directory, 'claude-config');
  const log = nodePath.join(directory, 'claude.log');
  const removed = nodePath.join(directory, 'claude.removed');
  mkdirSync(bin, { recursive: true });
  mkdirSync(claudeConfig, { recursive: true });
  if (marketplaceCurrent) {
    writeFileSync(
      nodePath.join(claudeConfig, 'settings.json'),
      `${JSON.stringify({
        env: { CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '1' },
        extraKnownMarketplaces: {
          safeword: {
            source: {
              source: 'git',
              url: 'https://github.com/ArcadeAI/safeword.git',
              ref: CURRENT_MARKETPLACE_REF,
            },
            autoUpdate,
          },
        },
      })}\n`,
    );
  }
  const claude = nodePath.join(bin, 'claude');
  writeFileSync(
    claude,
    `#!/bin/sh
set -eu
printf '%s\n' "$*" >> ${JSON.stringify(log)}
case "$*" in
  '--version') echo '2.1.170' ;;
  'plugin marketplace list --json')
    ${marketplaceCurrent ? `echo '[{"name":"safeword","source":{"url":"https://github.com/ArcadeAI/safeword.git","ref":"${CURRENT_MARKETPLACE_REF}"}}]'` : "echo '[]'"}
    ;;
  'plugin list --json')
    if [ -f ${JSON.stringify(removed)} ]; then
      echo '[]'
    else
      echo '[{"id":"safeword@safeword","scope":"user","version":"${SAFEWORD_SCHEMA.version}","enabled":true,"installPath":${JSON.stringify(nodePath.join(REPO_ROOT, 'plugin'))}}]'
    fi
    ;;
  'plugin uninstall safeword@safeword --scope user --keep-data')
    touch ${JSON.stringify(removed)}
    ;;
  *) exit 97 ;;
esac
`,
  );
  chmodSync(claude, 0o755);
  return { bin, claudeConfig, log };
}

describe('plan and remove wiring', () => {
  it('previews reconciliation without changing the project', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const versionPath = nodePath.join(directory, '.safeword', 'version');
    const before = readFileSync(versionPath, 'utf8');

    const result = await runCli(['plan', '--json', '--no-input', '--offline', '--cwd', directory], {
      cwd: directory,
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('');
    expect(readFileSync(versionPath, 'utf8')).toBe(before);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      state: 'action_required',
      changed: false,
      effects: { network: [], destructive: [] },
      data: {
        plan: {
          schema_version: 1,
          command: 'install',
          id: expect.stringMatching(/^[a-f\d]{64}$/),
        },
      },
    });
  });

  it('requires a plan identity before removal', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);

    const preview = await runCli(['remove', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
    });
    expect(preview.exitCode).toBe(2);
    const envelope = JSON.parse(preview.stdout) as {
      data: { plan: { id: string; effects: { destructive: unknown[] } } };
    };
    expect(envelope.data.plan.effects.destructive.length).toBeGreaterThan(0);
    expect(JSON.parse(preview.stdout)).toMatchObject({
      changed: false,
      effects: {
        files: [],
        packages: [],
        configuration: [],
        network: [],
        destructive: [],
      },
    });

    const applied = await runCli(
      [
        'remove',
        '--json',
        '--no-input',
        '--yes',
        '--plan',
        envelope.data.plan.id,
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );
    expect(applied.exitCode).toBe(0);
    const appliedEnvelope = JSON.parse(applied.stdout) as {
      state: string;
      changed: boolean;
      effects: {
        destructive: { kind: string; target: string; operation?: string }[];
        packages: unknown[];
        network: unknown[];
      };
    };
    expect(appliedEnvelope).toMatchObject({
      state: 'changed',
      changed: true,
    });
    expect(appliedEnvelope.effects.destructive.length).toBeGreaterThan(0);
    expect(appliedEnvelope.effects.destructive.every(effect => effect.kind === 'remove')).toBe(
      true,
    );
    expect(
      appliedEnvelope.effects.destructive.every(effect => effect.operation === undefined),
    ).toBe(true);
    expect(appliedEnvelope.effects.packages).toEqual([]);
    expect(appliedEnvelope.effects.network).toEqual([]);
  });

  it('rejects an option token swallowed as a malformed removal plan identity', async () => {
    const directory = createTemporaryDirectory();

    const result = await runCli(
      ['remove', '--plan', '--definitely-invalid', '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [{ code: 'CLI_ARGUMENT_INVALID', retryable: false }],
    });
  });

  it('renders a missing removal plan value through the machine envelope', async () => {
    const result = await runCli(['remove', '--plan', '--json', '--no-input']);

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [{ code: 'CLI_ARGUMENT_INVALID', retryable: false }],
    });
  });

  it('advertises a full-removal action that can be executed verbatim', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);

    const preview = await runCli(['remove', '--full', '--json', '--no-input'], {
      cwd: directory,
    });
    const envelope = JSON.parse(preview.stdout) as {
      next_actions: { command: string }[];
    };
    const advertised = envelope.next_actions[0]?.command;
    expect(advertised).toMatch(/^safeword remove --full --yes --plan [a-f\d]{64}$/);

    const applied = await runCli(advertised?.split(' ').slice(1) ?? [], { cwd: directory });

    expect(applied.exitCode).toBe(0);
    expect(applied.stdout).toContain('Changed: yes');
  });

  it('rejects a full-uninstall plan after a lockfile changes without mutating', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      `${JSON.stringify({ devDependencies: { safeword: '^0.69.0' } })}\n`,
    );
    const lockPath = nodePath.join(directory, 'package-lock.json');
    writeFileSync(lockPath, '{"lockfileVersion":3}\n');

    const preview = await runCli(
      ['uninstall', '--agents=none', '--full', '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );
    const envelope = JSON.parse(preview.stdout) as { data: { plan: { id: string } } };
    writeFileSync(lockPath, '{"lockfileVersion":3,"changed":true}\n');

    const applied = await runCli(
      [
        'uninstall',
        '--agents=none',
        '--full',
        '--yes',
        '--plan',
        envelope.data.plan.id,
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(applied.exitCode).toBe(2);
    expect(JSON.parse(applied.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PLAN_STALE' }],
    });
    expect(readFileSync(lockPath, 'utf8')).toContain('"changed":true');
    expect(readFileSync(nodePath.join(directory, '.safeword/version'), 'utf8')).toBe('0.69.0\n');
  });

  it.each([
    { agents: 'none', expected: '--agents=none' },
    { agents: 'claude', expected: '--agents=claude' },
    { agents: 'cursor', expected: '--agents=cursor' },
  ])('preserves $agents selection in plan next actions', async ({ agents, expected }) => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const bin = createMissingClaudeHost(directory);
    const environment = { PATH: `${bin}:${process.env.PATH ?? ''}` };

    for (const operation of ['install', 'uninstall']) {
      const preview = await runCli(
        ['plan', operation, '--agents', agents, '--json', '--no-input', '--cwd', directory],
        { cwd: directory, env: environment },
      );
      const envelope = JSON.parse(preview.stdout) as {
        next_actions: { command: string }[];
      };

      expect(envelope.next_actions[0]?.command).toContain(expected);
    }
  });

  it('includes the Cursor project surface in default uninstall plans', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const bin = createMissingClaudeHost(directory);

    const preview = await runCliWithLiteralArguments(
      ['plan', 'uninstall', '--json', '--no-input', '--cwd', directory],
      { cwd: directory, env: { PATH: `${bin}:${process.env.PATH ?? ''}` } },
    );
    const envelope = JSON.parse(preview.stdout) as {
      next_actions: { command: string }[];
    };

    expect(envelope.next_actions[0]?.command).toContain('--agents=claude,codex,cursor');
  });

  it('defaults install plans to user scope and its observed state', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const { bin, claudeConfig } = createUserScopedClaudeHost(directory);
    const environment = {
      CLAUDE_CONFIG_DIR: claudeConfig,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
    };

    const preview = await runCli(
      ['plan', 'install', '--agents=claude', '--json', '--no-input', '--cwd', directory],
      { cwd: directory, env: environment },
    );
    const envelope = JSON.parse(preview.stdout) as {
      next_actions: { command: string }[];
      data: { plan: { effects: { configuration: { target: string }[] } } };
    };

    expect(preview.exitCode).toBe(2);
    expect(envelope.next_actions[0]?.command).toContain('--scope=user');
    expect(envelope.data.plan.effects.configuration).not.toContainEqual(
      expect.objectContaining({ target: 'Claude profile plugin' }),
    );
  });

  it('plans Claude convergence when the plugin is current but its marketplace is missing', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const { bin, claudeConfig } = createUserScopedClaudeHost(directory, false);
    const environment = {
      CLAUDE_CONFIG_DIR: claudeConfig,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
    };

    const preview = await runCli(
      [
        'plan',
        'install',
        '--agents=claude',
        '--scope=user',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory, env: environment },
    );
    const envelope = JSON.parse(preview.stdout) as {
      data: {
        plan: {
          effects: {
            configuration: { target: string }[];
            network: { target: string }[];
          };
        };
      };
    };

    expect(envelope.data.plan.effects.configuration).toContainEqual(
      expect.objectContaining({ kind: 'add', target: 'safeword', operation: 'user' }),
    );
    expect(envelope.data.plan.effects.network).toContainEqual(
      expect.objectContaining({ kind: 'add', target: 'Claude plugin marketplace' }),
    );
  });

  it('preserves an explicit Claude native-update opt-out without planning effects', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const { bin, claudeConfig } = createUserScopedClaudeHost(directory, true, false);
    const environment = {
      CLAUDE_CONFIG_DIR: claudeConfig,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
    };

    const preview = await runCli(
      [
        'plan',
        'install',
        '--agents=claude',
        '--scope=user',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory, env: environment },
    );
    const effects = (
      JSON.parse(preview.stdout) as {
        data: {
          plan: {
            effects: {
              configuration: { target: string }[];
              network: { target: string }[];
            };
          };
        };
      }
    ).data.plan.effects;

    expect(effects.configuration).not.toContainEqual(
      expect.objectContaining({ target: 'Claude profile plugin' }),
    );
    expect(effects.network).not.toContainEqual(
      expect.objectContaining({ target: 'Claude profile plugin' }),
    );
  });

  it('does not plan Codex installation effects while activation is pending', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const runtime = installFakeCodexRuntime(directory, {
      pluginEnabled: true,
      pluginInitiallyInstalled: true,
      pluginVersion: SAFEWORD_SCHEMA.version,
    });
    const marker = nodePath.join(runtime.codexHome, 'safeword/activation-pending-v2.json');
    mkdirSync(nodePath.dirname(marker), { recursive: true });
    writeFileSync(marker, '{"schema_version":');
    const environment = {
      CODEX_HOME: runtime.codexHome,
      SAFEWORD_CODEX_LOG: runtime.logPath,
      PATH: `${runtime.bin}:${process.env.PATH ?? ''}`,
    };

    const preview = await runCli(
      ['plan', 'install', '--agents=codex', '--json', '--no-input', '--cwd', directory],
      { cwd: directory, env: environment },
    );
    const effects = (
      JSON.parse(preview.stdout) as {
        data: {
          plan: {
            effects: {
              configuration: { target: string }[];
              network: { target: string }[];
            };
          };
        };
      }
    ).data.plan.effects;

    expect(effects.configuration).not.toContainEqual(
      expect.objectContaining({ target: 'Codex profile plugin' }),
    );
    expect(effects.network).not.toContainEqual(
      expect.objectContaining({ target: 'Codex profile plugin' }),
    );
  });

  it('omits Claude removal effects when the requested scope is absent', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const bin = createMissingClaudeHost(directory);
    const environment = { PATH: `${bin}:${process.env.PATH ?? ''}` };

    const preview = await runCli(
      [
        'plan',
        'uninstall',
        '--agents=claude',
        '--scope=user',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory, env: environment },
    );
    const envelope = JSON.parse(preview.stdout) as {
      next_actions: { command: string }[];
      data: { plan: { effects: { destructive: { target: string }[] } } };
    };

    expect(envelope.next_actions[0]?.command).toContain('--scope=user');
    expect(envelope.data.plan.effects.destructive).not.toContainEqual(
      expect.objectContaining({ target: 'Claude profile plugin' }),
    );
  });

  it('previews and removes the exact requested Claude scope', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const { bin, claudeConfig, log } = createUserScopedClaudeHost(directory);
    const environment = {
      CLAUDE_CONFIG_DIR: claudeConfig,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
    };

    const preview = await runCli(
      ['uninstall', '--agents=claude', '--scope=user', '--json', '--no-input', '--cwd', directory],
      { cwd: directory, env: environment },
    );
    const envelope = JSON.parse(preview.stdout) as { next_actions: { command: string }[] };
    const advertised = envelope.next_actions[0]?.command;
    expect(advertised).toMatch(
      /^safeword uninstall --agents=claude --scope=user --yes --plan [a-f\d]{64}$/,
    );

    const applied = await runCli(
      [...(advertised?.split(' ').slice(1) ?? []), '--json', '--no-input', '--cwd', directory],
      { cwd: directory, env: environment },
    );

    expect(applied.exitCode).toBe(0);
    expect(readFileSync(log, 'utf8')).toContain(
      'plugin uninstall safeword@safeword --scope user --keep-data',
    );
  });

  it('rejects user scope when Claude is not selected', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);

    for (const arguments_ of [
      ['install', '--agents=codex', '--scope=user'],
      ['plan', 'uninstall', '--agents=codex', '--scope=user'],
      ['uninstall', '--agents=none', '--scope=user'],
    ]) {
      const result = await runCli([...arguments_, '--json', '--no-input', '--cwd', directory], {
        cwd: directory,
      });

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        errors: [
          {
            code: 'CLI_ARGUMENT_INVALID',
            message: 'User scope requires Claude in the selected agents.',
          },
        ],
      });
    }
  });

  it('rejects invalid install scope even when Claude is not selected', async () => {
    const directory = createTemporaryDirectory();

    const result = await runCli(
      ['install', '--agents=none', '--scope=bogus', '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message: expect.stringMatching(/scope must be either project or user/u),
        },
      ],
    });
  });

  it('does not report an absent Cursor surface as changed during uninstall', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);

    const preview = await runCli(
      ['uninstall', '--agents=cursor', '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );
    const advertised = (JSON.parse(preview.stdout) as { next_actions: { command: string }[] })
      .next_actions[0]?.command;
    const applied = await runCli(
      [...(advertised?.split(' ').slice(1) ?? []), '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );
    const envelope = JSON.parse(applied.stdout) as {
      data: { surfaces: { name: string; state: string }[] };
    };

    expect(applied.exitCode).toBe(0);
    expect(envelope.data.surfaces).toContainEqual({
      name: 'cursor',
      selected: true,
      state: 'healthy',
    });
  });

  it('reports Cursor changed when selected Cursor assets are removed', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const cursorCommand = nodePath.join(directory, '.cursor/commands/explain.md');
    mkdirSync(nodePath.dirname(cursorCommand), { recursive: true });
    writeFileSync(
      cursorCommand,
      readFileSync(nodePath.join(REPO_ROOT, 'packages/cli/templates/commands/explain.md')),
    );

    const preview = await runCli(
      ['uninstall', '--agents=cursor', '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );
    const advertised = (JSON.parse(preview.stdout) as { next_actions: { command: string }[] })
      .next_actions[0]?.command;
    const applied = await runCli(
      [...(advertised?.split(' ').slice(1) ?? []), '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );
    const envelope = JSON.parse(applied.stdout) as {
      data: { surfaces: { name: string; selected: boolean; state: string }[] };
    };

    expect(applied.exitCode).toBe(0);
    expect(envelope.data.surfaces).toContainEqual({
      name: 'cursor',
      selected: true,
      state: 'changed',
    });
  });

  it('previews and applies canonical full uninstall with its package effects', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', devDependencies: { safeword: '0.69.0' } }),
    );
    const bin = nodePath.join(directory, 'bin');
    mkdirSync(bin);
    const npm = nodePath.join(bin, 'npm');
    writeFileSync(npm, '#!/bin/sh\nexit 0\n');
    chmodSync(npm, 0o755);
    const environment = { PATH: `${bin}:${process.env.PATH ?? ''}` };

    const preview = await runCli(
      ['uninstall', '--agents=none', '--full', '--json', '--no-input', '--cwd', directory],
      { cwd: directory, env: environment },
    );
    const envelope = JSON.parse(preview.stdout) as {
      next_actions: { command: string }[];
      data: { plan: { effects: { packages: { target: string }[] } } };
    };
    expect(envelope.data.plan.effects.packages).toContainEqual(
      expect.objectContaining({ target: 'safeword' }),
    );
    const advertised = envelope.next_actions[0]?.command;
    expect(advertised).toMatch(
      /^safeword uninstall --agents=none --full --yes --plan [a-f\d]{64}$/,
    );

    const applied = await runCli(
      [...(advertised?.split(' ').slice(1) ?? []), '--json', '--no-input'],
      {
        cwd: directory,
        env: environment,
      },
    );
    expect(applied.exitCode).toBe(0);
    expect(JSON.parse(applied.stdout)).toMatchObject({
      state: 'changed',
      effects: { packages: expect.arrayContaining([{ kind: 'remove', target: 'safeword' }]) },
    });
  });

  it('removes the Safeword dependency during default uninstall', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', devDependencies: { safeword: '0.69.0' } }),
    );
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
    const bin = nodePath.join(directory, 'bin');
    mkdirSync(bin);
    const npm = nodePath.join(bin, 'npm');
    writeFileSync(npm, '#!/bin/sh\nexit 0\n');
    chmodSync(npm, 0o755);
    const environment = { PATH: `${bin}:${process.env.PATH ?? ''}` };

    const preview = await runCli(
      ['uninstall', '--agents=none', '--json', '--no-input', '--cwd', directory],
      { cwd: directory, env: environment },
    );
    const envelope = JSON.parse(preview.stdout) as {
      next_actions: { command: string }[];
      data: { plan: { effects: { packages: { target: string }[] } } };
    };
    expect(envelope.data.plan.effects.packages).toContainEqual(
      expect.objectContaining({ target: 'safeword' }),
    );

    const advertised = envelope.next_actions[0]?.command;
    const applied = await runCli(
      [...(advertised?.split(' ').slice(1) ?? []), '--json', '--no-input', '--cwd', directory],
      { cwd: directory, env: environment },
    );

    expect(applied.exitCode).toBe(0);
    expect(JSON.parse(applied.stdout)).toMatchObject({
      effects: { packages: expect.arrayContaining([{ kind: 'remove', target: 'safeword' }]) },
      findings: [
        {
          code: 'REMOTE_WORKFLOW_REMAINS',
          message:
            'The optional remote-test workflow remains installed. Run `bunx safeword project test-execution remote disable` to remove it.',
        },
      ],
    });
    expect(readFileSync(workflowPath)).toEqual(bundledWorkflow);
  });

  it('refuses canonical full uninstall offline before mutation', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    const versionPath = nodePath.join(directory, '.safeword/version');
    const before = readFileSync(versionPath, 'utf8');

    const result = await runCli(
      [
        'uninstall',
        '--agents=none',
        '--full',
        '--offline',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(2);
    expect(readFileSync(versionPath, 'utf8')).toBe(before);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      effects: { files: [], packages: [], network: [], destructive: [] },
    });
  });

  it('refuses default uninstall with package effects while offline', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', devDependencies: { safeword: '0.69.0' } }),
    );
    const versionPath = nodePath.join(directory, '.safeword/version');
    const before = readFileSync(versionPath, 'utf8');

    const result = await runCli(
      ['uninstall', '--agents=none', '--offline', '--json', '--no-input', '--cwd', directory],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(2);
    expect(readFileSync(versionPath, 'utf8')).toBe(before);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      effects: { files: [], packages: [], network: [], destructive: [] },
    });
  });

  it('refuses a stale removal plan without mutation', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);

    const preview = await runCli(['remove', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
    });
    const envelope = JSON.parse(preview.stdout) as { data: { plan: { id: string } } };
    const versionPath = nodePath.join(directory, '.safeword', 'version');
    writeFileSync(versionPath, 'changed-after-preview\n');

    const stale = await runCli(
      [
        'remove',
        '--json',
        '--no-input',
        '--yes',
        '--plan',
        envelope.data.plan.id,
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );
    expect(stale.exitCode).toBe(2);
    expect(readFileSync(versionPath, 'utf8')).toBe('changed-after-preview\n');
    expect(JSON.parse(stale.stdout)).toMatchObject({
      state: 'action_required',
      findings: expect.arrayContaining([expect.objectContaining({ code: 'PLAN_STALE' })]),
    });
  });

  it('reports package files changed by a partially failed full removal', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
    writeFileSync(
      nodePath.join(directory, 'AGENTS.md'),
      '**⚠️ ALWAYS READ FIRST:** `.safeword/SAFEWORD.md`\n\n---# Project agents\n',
    );
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'fixture', devDependencies: { safeword: '0.69.0' } }),
    );
    const bin = nodePath.join(directory, 'bin');
    mkdirSync(bin);
    const npm = nodePath.join(bin, 'npm');
    writeFileSync(
      npm,
      [
        '#!/bin/sh',
        String.raw`printf '%s\n' '{"name":"fixture","partial":true}' > package.json`,
        String.raw`printf '%s\n' 'partial lock' > package-lock.json`,
        'exit 9',
        '',
      ].join('\n'),
    );
    chmodSync(npm, 0o755);

    const preview = await runCli(['remove', '--full', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
    });
    const planId = (JSON.parse(preview.stdout) as { data: { plan: { id: string } } }).data.plan.id;
    const applied = await runCli(
      ['remove', '--full', '--json', '--no-input', '--yes', '--plan', planId, '--cwd', directory],
      {
        cwd: directory,
        env: { PATH: `${bin}:${process.env.PATH ?? ''}` },
      },
    );

    expect(applied.exitCode).toBe(1);
    expect(JSON.parse(applied.stdout)).toMatchObject({
      state: 'failed',
      changed: true,
      effects: {
        files: expect.arrayContaining([
          { kind: 'update', target: 'AGENTS.md' },
          { kind: 'update', target: 'package.json' },
          { kind: 'create', target: 'package-lock.json' },
        ]),
      },
      errors: [{ code: 'PACKAGE_UNINSTALL_FAILED' }],
    });
  });
});
