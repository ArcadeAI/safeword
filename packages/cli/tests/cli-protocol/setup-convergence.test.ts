import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { convergeSetup } from '../../src/commands/converge-setup.js';
import { createTemporaryDirectory, runCliWithoutInstall } from '../helpers.js';

describe('convergent setup', () => {
  it('uses the concise shared renderer for an ordinary interactive-style invocation', async () => {
    const directory = createTemporaryDirectory();
    const result = await runCliWithoutInstall(['setup', '--cwd', directory], { cwd: directory });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.split('\n').filter(line => line.startsWith('Next:'))).toHaveLength(1);
    expect(result.stdout).toMatch(/^Complete\nChanged: yes\n/);
    expect(result.stdout).toContain('Configuration is healthy');
    expect(result.stdout).not.toContain('Created: .safeword/');
  });

  it('reports changed once and unchanged on an identical second run', async () => {
    const directory = createTemporaryDirectory();
    const arguments_ = [
      'setup',
      '--json',
      '--no-input',
      '--offline',
      '--cwd',
      directory,
      '--no-modify',
    ];

    const first = await runCliWithoutInstall(arguments_, { cwd: directory });
    expect(first.exitCode).toBe(0);
    expect(first.stderr).toBe('');
    expect(JSON.parse(first.stdout)).toMatchObject({
      state: 'changed',
      changed: true,
    });

    const second = await runCliWithoutInstall(arguments_, { cwd: directory });
    expect(second.exitCode).toBe(0);
    expect(second.stderr).toBe('');
    expect(JSON.parse(second.stdout)).toMatchObject({
      state: 'healthy',
      changed: false,
    });
    const manifest = JSON.parse(readFileSync(nodePath.join(directory, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(manifest.scripts?.['lint:eslint']).toBeUndefined();
  });

  it('journals a completed workspace write when a later workspace update fails', async () => {
    const directory = createTemporaryDirectory();
    const packagePath = nodePath.join(directory, 'packages/a/package.json');
    mkdirSync(nodePath.dirname(packagePath), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
    writeFileSync(packagePath, JSON.stringify({ name: 'a' }));

    const result = await convergeSetup(directory, {
      noModify: true,
      adapters: {
        configureWorkspaces: () => {
          writeFileSync(packagePath, JSON.stringify({ name: 'a', scripts: { format: 'fmt' } }));
          throw new Error('later workspace failed');
        },
      },
    });

    expect(result.state).toBe('failed');
    expect(result.effects.files).toContainEqual({
      kind: 'update',
      target: 'packages/a/package.json',
    });
    expect(readFileSync(packagePath, 'utf8')).toContain('"format":"fmt"');
  });

  it('journals a workspace write when an adapter returns no declared effects', async () => {
    const directory = createTemporaryDirectory();
    const packagePath = nodePath.join(directory, 'packages/a/package.json');
    mkdirSync(nodePath.dirname(packagePath), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
    writeFileSync(packagePath, JSON.stringify({ name: 'a' }));

    const result = await convergeSetup(directory, {
      noModify: true,
      adapters: {
        configureWorkspaces: () => {
          writeFileSync(packagePath, JSON.stringify({ name: 'a', scripts: { format: 'fmt' } }));
          return [];
        },
      },
    });

    expect(result.effects.files).toContainEqual({
      kind: 'update',
      target: 'packages/a/package.json',
    });
  });

  it('journals a namespace move when the later migration stage fails', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(directory, '.safeword-project'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.safeword/version'), '0.69.0');
    writeFileSync(nodePath.join(directory, '.safeword-project/keep.md'), 'keep\n');
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'fixture' }));

    const result = await convergeSetup(directory, {
      migrateNamespace: true,
      noModify: true,
      adapters: {
        executeNamespaceMigration: cwd => {
          renameSync(nodePath.join(cwd, '.safeword-project'), nodePath.join(cwd, '.project'));
          throw new Error('config rewrite failed');
        },
      },
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: 'NAMESPACE_MIGRATION_FAILED' }),
    );
    expect(result.effects.files).toContainEqual({
      kind: 'create',
      target: '.project/keep.md',
    });
    expect(result.effects.files).toContainEqual({
      kind: 'delete',
      target: '.safeword-project/keep.md',
    });
  });

  it('refuses a downgrade before migrating the legacy namespace', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(directory, '.safeword-project'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.safeword/version'), '999.0.0');
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'future' }));

    const result = await convergeSetup(directory, { migrateNamespace: true, noModify: true });

    expect(result.state).toBe('failed');
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'CLI_DOWNGRADE_REFUSED' }),
    );
    expect(result.effects.files).toEqual([]);
    expect(readFileSync(nodePath.join(directory, '.safeword/version'), 'utf8')).toBe('999.0.0');
    expect(existsSync(nodePath.join(directory, '.project'))).toBe(false);
  });

  it.each(['v999.0.0', 'garbage'])(
    'fails closed on unreadable project version %s before changing the project',
    async projectVersion => {
      const directory = createTemporaryDirectory();
      mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
      mkdirSync(nodePath.join(directory, '.safeword-project'), { recursive: true });
      writeFileSync(nodePath.join(directory, '.safeword/version'), projectVersion);
      writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'future' }));

      const result = await convergeSetup(directory, { migrateNamespace: true, noModify: true });

      expect(result.state).toBe('failed');
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'PROJECT_VERSION_UNSAFE' }),
      );
      expect(result.effects.files).toEqual([]);
      expect(readFileSync(nodePath.join(directory, '.safeword/version'), 'utf8')).toBe(
        projectVersion,
      );
      expect(existsSync(nodePath.join(directory, '.project'))).toBe(false);
    },
  );
});
