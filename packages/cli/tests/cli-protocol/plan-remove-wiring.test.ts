import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    expect(JSON.parse(applied.stdout)).toMatchObject({
      state: 'changed',
      changed: true,
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
      findings: [{ code: 'PLAN_STALE' }],
    });
  });
});
