import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

function configureMinimalProject(directory: string): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(directory, '.safeword', 'version'), '0.69.0\n');
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
          command: 'setup',
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
      findings: [{ code: 'PLAN_STALE' }],
    });
  });

  it('reports package files changed by a partially failed full removal', async () => {
    const directory = createTemporaryDirectory();
    configureMinimalProject(directory);
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
          { kind: 'update', target: 'package.json' },
          { kind: 'create', target: 'package-lock.json' },
        ]),
      },
      errors: [{ code: 'PACKAGE_UNINSTALL_FAILED' }],
    });
  });
});
