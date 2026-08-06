import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

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
