import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { convergeSetup } from '../../src/lifecycle/project-install.js';
import { VERSION } from '../../src/version.js';
import { createTemporaryDirectory, runCliWithoutInstall } from '../helpers.js';

const PROJECT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function readProjectConfig(directory: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(nodePath.join(directory, '.safeword/config.json'), 'utf8'),
  ) as Record<string, unknown>;
}

function writeProjectConfig(directory: string, config: Record<string, unknown>): void {
  writeFileSync(nodePath.join(directory, '.safeword/config.json'), `${JSON.stringify(config)}\n`);
}

function withoutProjectIdentity(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'projectUUID'));
}

function runOfflineSetup(directory: string) {
  return runCliWithoutInstall(
    ['setup', '--json', '--no-input', '--offline', '--cwd', directory, '--no-modify'],
    { cwd: directory },
  );
}

async function expectOfflineSetupSuccess(directory: string): Promise<void> {
  const result = await runOfflineSetup(directory);
  expect(result.exitCode).toBe(0);
}

describe('convergent setup', () => {
  it('creates a local public-retro project identity on first setup', async () => {
    const directories = [createTemporaryDirectory(), createTemporaryDirectory()];
    const identities: unknown[] = [];

    for (const directory of directories) {
      const result = await runOfflineSetup(directory);

      expect(result.exitCode).toBe(0);
      identities.push(readProjectConfig(directory).projectUUID);
      expect(existsSync(nodePath.join(directory, '.safeword/retro-attempts'))).toBe(false);
    }

    expect(identities[0]).toMatch(PROJECT_UUID);
    expect(identities[1]).toMatch(PROJECT_UUID);
    expect(identities[0]).not.toBe(identities[1]);
  });

  it('repairs a malformed public-retro project identity locally', async () => {
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
    const initialSetup = await runCliWithoutInstall(arguments_, { cwd: directory });
    expect(initialSetup.exitCode).toBe(0);
    const configPath = nodePath.join(directory, '.safeword/config.json');
    const config = readProjectConfig(directory);
    writeFileSync(configPath, `${JSON.stringify({ ...config, projectUUID: 'not-a-uuid' })}\n`);

    const repair = await runCliWithoutInstall(arguments_, { cwd: directory });

    expect(repair.exitCode).toBe(0);
    const repaired = readProjectConfig(directory);
    expect(repaired.projectUUID).toMatch(PROJECT_UUID);
    expect(repaired.projectUUID).not.toBe('not-a-uuid');
  });

  it('creates a missing identity during upgrade and preserves it on later setup', async () => {
    const directory = createTemporaryDirectory();
    await expectOfflineSetupSuccess(directory);
    const legacyConfig = withoutProjectIdentity(readProjectConfig(directory));
    writeProjectConfig(directory, legacyConfig);

    await expectOfflineSetupSuccess(directory);
    const upgradedIdentity = readProjectConfig(directory).projectUUID;
    expect(upgradedIdentity).toMatch(PROJECT_UUID);

    await expectOfflineSetupSuccess(directory);
    expect(readProjectConfig(directory).projectUUID).toBe(upgradedIdentity);
  });

  it.each(['reinstalled', 'upgraded'])('preserves project identity when %s', async () => {
    const directory = createTemporaryDirectory();
    await expectOfflineSetupSuccess(directory);
    const identity = readProjectConfig(directory).projectUUID;

    await expectOfflineSetupSuccess(directory);

    expect(readProjectConfig(directory).projectUUID).toBe(identity);
    expect(existsSync(nodePath.join(directory, '.safeword/retro-attempts'))).toBe(false);
  });

  it('normalizes an uppercase identity during setup', async () => {
    const directory = createTemporaryDirectory();
    await expectOfflineSetupSuccess(directory);
    writeProjectConfig(directory, {
      ...readProjectConfig(directory),
      projectUUID: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    });

    await expectOfflineSetupSuccess(directory);
    expect(readProjectConfig(directory).projectUUID).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('generates a new identity when the configured identity is removed', async () => {
    const directory = createTemporaryDirectory();
    await expectOfflineSetupSuccess(directory);
    const firstIdentity = readProjectConfig(directory).projectUUID;
    const configWithoutIdentity = withoutProjectIdentity(readProjectConfig(directory));
    writeProjectConfig(directory, configWithoutIdentity);

    await expectOfflineSetupSuccess(directory);
    const recreatedIdentity = readProjectConfig(directory).projectUUID;
    expect(recreatedIdentity).toMatch(PROJECT_UUID);
    expect(recreatedIdentity).not.toBe(firstIdentity);
  });

  it('rejects a malformed public-retro collection setting before changing the project', async () => {
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
    const initialSetup = await runCliWithoutInstall(arguments_, { cwd: directory });
    expect(initialSetup.exitCode).toBe(0);

    const configPath = nodePath.join(directory, '.safeword/config.json');
    const missingManagedFile = nodePath.join(directory, '.safeword/guides/testing-guide.md');
    const malformedConfig = `${JSON.stringify({
      ...JSON.parse(readFileSync(configPath, 'utf8')),
      publicRetrospectiveCollection: 'off',
    })}\n`;
    writeFileSync(configPath, malformedConfig);
    rmSync(missingManagedFile);

    const result = await runCliWithoutInstall(arguments_, { cwd: directory });

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ state: 'failed', changed: false });
    expect(readFileSync(configPath, 'utf8')).toBe(malformedConfig);
    expect(existsSync(missingManagedFile)).toBe(false);
    expect(result.stdout).toContain('publicRetrospectiveCollection must be true or false');
  });

  it('uses the concise shared renderer for an ordinary interactive-style invocation', async () => {
    const directory = createTemporaryDirectory();
    const result = await runCliWithoutInstall(['setup', '--cwd', directory], { cwd: directory });

    expect(result.exitCode).toBe(0);
    const nextLines = result.stdout.split('\n').filter(line => line.startsWith('Next:'));
    expect(nextLines).toHaveLength(1);
    expect(nextLines[0]).toMatch(/^Next: (?:\/reload-plugins|safeword install --agents=claude)$/u);
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

  it('converges after a project-scoped Claude install records plugin enrollment', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.claude'), { recursive: true });
    mkdirSync(nodePath.join(directory, 'packages/a'), { recursive: true });
    mkdirSync(nodePath.join(directory, 'packages/b'), { recursive: true });
    mkdirSync(nodePath.join(directory, 'packages/c'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        name: 'pnpm-workspace',
        private: true,
        packageManager: 'pnpm@11.7.0',
        workspaces: ['packages/*'],
      }),
    );
    writeFileSync(nodePath.join(directory, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
    for (const name of ['a', 'b', 'c']) {
      writeFileSync(
        nodePath.join(directory, `packages/${name}/package.json`),
        JSON.stringify({ name: `workspace-${name}`, private: true }),
      );
    }
    // A 0.71-style project has legacy Claude hooks, so setup retains that
    // delivery until the explicit cleanup transaction completes.
    writeFileSync(
      nodePath.join(directory, '.claude/settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command: 'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/pre-tool-quality.ts',
                },
              ],
            },
          ],
        },
      }),
    );
    const arguments_ = [
      'setup',
      '--json',
      '--no-input',
      '--offline',
      '--cwd',
      directory,
      '--no-modify',
    ];

    const upgraded = await runCliWithoutInstall(arguments_, { cwd: directory });
    expect(upgraded.exitCode).toBe(0);

    // Claude records project-scope enrollment in the same settings file while
    // preserving the existing legacy hook block.
    const settingsPath = nodePath.join(directory, '.claude/settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(
      settingsPath,
      `${JSON.stringify(
        {
          ...settings,
          enabledPlugins: { 'safeword@safeword': true },
          extraKnownMarketplaces: {
            safeword: {
              source: {
                source: 'git',
                url: 'https://github.com/ArcadeAI/safeword.git',
                ref: 'stable',
              },
            },
          },
        },
        undefined,
        2,
      )}\n`,
    );

    const converged = await runCliWithoutInstall(arguments_, { cwd: directory });
    expect(converged.exitCode).toBe(0);
    const envelope = JSON.parse(converged.stdout) as {
      findings: { code: string }[];
    } & Record<string, unknown>;
    expect(envelope).toMatchObject({
      state: 'healthy',
      changed: false,
      next_actions: [{ command: '/reload-plugins', mutates: false, requires_human: true }],
    });
    expect(envelope.findings).toContainEqual(
      expect.objectContaining({ code: 'SETUP_CLAUDE_PLUGIN_PRESERVED' }),
    );
  });

  it('still routes an enrolled project through install when the run delivered changes', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.claude'), { recursive: true });
    // Enrollment is recorded before the first delivery, so this run both sees
    // the plugin as enabled and rewrites files. `enabledPlugins` carries no
    // version, so it cannot prove Claude already holds this build.
    writeFileSync(
      nodePath.join(directory, '.claude/settings.json'),
      `${JSON.stringify({ enabledPlugins: { 'safeword@safeword': true } }, undefined, 2)}\n`,
    );

    const result = await runCliWithoutInstall(
      ['setup', '--json', '--no-input', '--offline', '--cwd', directory, '--no-modify'],
      { cwd: directory },
    );

    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout) as {
      changed: boolean;
      findings: { code: string }[];
      next_actions: { command: string }[];
    };
    expect(envelope.changed).toBe(true);
    expect(envelope.next_actions).toEqual([
      { command: 'safeword install --agents=claude', mutates: true, requires_human: true },
    ]);
    expect(envelope.findings.map(finding => finding.code)).not.toContain(
      'SETUP_CLAUDE_PLUGIN_PRESERVED',
    );
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
        expect.objectContaining({
          code: 'PROJECT_VERSION_UNSAFE',
          message: expect.stringContaining(
            `safeword install --repair-version-marker --cwd '${directory}'`,
          ),
        }),
      );
      expect(result.recovery).toEqual([
        {
          command: `safeword install --repair-version-marker --cwd '${directory}'`,
          description:
            'Replace the unreadable version marker with the current CLI version, then complete installation.',
          requiresHuman: true,
        },
      ]);
      expect(result.effects.files).toEqual([]);
      expect(readFileSync(nodePath.join(directory, '.safeword/version'), 'utf8')).toBe(
        projectVersion,
      );
      expect(existsSync(nodePath.join(directory, '.project'))).toBe(false);
    },
  );

  it('repairs an unreadable project version only after explicit confirmation', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.safeword/version'), 'garbage');
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'repair' }));

    const result = await runCliWithoutInstall(
      [
        'setup',
        '--repair-version-marker',
        '--json',
        '--no-input',
        '--cwd',
        directory,
        '--no-modify',
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      errors: [],
    });
    expect(readFileSync(nodePath.join(directory, '.safeword/version'), 'utf8').trim()).toBe(
      VERSION,
    );
  });

  it('does not let version repair bypass a valid newer project marker', async () => {
    const directory = createTemporaryDirectory();
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.safeword/version'), '999.0.0');
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'future' }));

    const result = await convergeSetup(directory, {
      repairVersionMarker: true,
      noModify: true,
    });

    expect(result).toMatchObject({
      state: 'failed',
      errors: [expect.objectContaining({ code: 'CLI_DOWNGRADE_REFUSED' })],
    });
    expect(readFileSync(nodePath.join(directory, '.safeword/version'), 'utf8')).toBe('999.0.0');
  });

  it('refuses a newer multiply linked marker before changing either directory entry', async () => {
    const directory = createTemporaryDirectory();
    const externalVersion = nodePath.join(directory, 'external-version');
    const projectVersion = nodePath.join(directory, '.safeword/version');
    mkdirSync(nodePath.dirname(projectVersion), { recursive: true });
    writeFileSync(externalVersion, '999.0.0');
    linkSync(externalVersion, projectVersion);
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'future' }));

    const result = await convergeSetup(directory, {
      repairVersionMarker: true,
      noModify: true,
    });

    expect(result).toMatchObject({
      state: 'failed',
      changed: false,
      effects: { files: [] },
      errors: [expect.objectContaining({ code: 'CLI_DOWNGRADE_REFUSED' })],
    });
    expect(readFileSync(projectVersion, 'utf8')).toBe('999.0.0');
    expect(readFileSync(externalVersion, 'utf8')).toBe('999.0.0');
    expect(lstatSync(projectVersion).nlink).toBe(2);
  });

  it('refuses to repair a symbolic version marker without touching its target', async () => {
    const directory = createTemporaryDirectory();
    const externalVersion = nodePath.join(directory, 'external-version');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(externalVersion, 'garbage');
    symlinkSync(externalVersion, nodePath.join(directory, '.safeword/version'));
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'symlink' }));

    const result = await runCliWithoutInstall(
      [
        'setup',
        '--repair-version-marker',
        '--json',
        '--no-input',
        '--cwd',
        directory,
        '--no-modify',
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 1, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [
        expect.objectContaining({
          code: 'PROJECT_VERSION_MARKER_UNSAFE',
          message: expect.stringContaining('symbolic links are never followed or repaired'),
        }),
      ],
      recovery: [],
    });
    expect(readFileSync(externalVersion, 'utf8')).toBe('garbage');
  });

  it('offers explicit recovery for a multiply linked version marker', async () => {
    const directory = createTemporaryDirectory();
    const externalVersion = nodePath.join(directory, 'external-version');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(externalVersion, 'garbage');
    linkSync(externalVersion, nodePath.join(directory, '.safeword/version'));
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'hardlink' }));

    const result = await convergeSetup(directory, { noModify: true });

    expect(result).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [
        expect.objectContaining({
          code: 'PROJECT_VERSION_MARKER_UNSAFE',
          message: expect.stringContaining('multiple directory entries'),
        }),
      ],
      recovery: [
        {
          command: `safeword install --repair-version-marker --cwd '${directory}'`,
          description:
            'Replace the linked project version marker without changing its other hardlink peers, then complete installation.',
          requiresHuman: true,
        },
      ],
    });
    expect(readFileSync(externalVersion, 'utf8')).toBe('garbage');
  });

  it('repairs a multiply linked marker without changing its peer', async () => {
    const directory = createTemporaryDirectory();
    const externalVersion = nodePath.join(directory, 'external-version');
    const projectVersion = nodePath.join(directory, '.safeword/version');
    mkdirSync(nodePath.dirname(projectVersion), { recursive: true });
    writeFileSync(externalVersion, 'garbage');
    linkSync(externalVersion, projectVersion);
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'hardlink' }));

    const result = await runCliWithoutInstall(
      [
        'setup',
        '--repair-version-marker',
        '--json',
        '--no-input',
        '--cwd',
        directory,
        '--no-modify',
      ],
      { cwd: directory },
    );

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      effects: {
        files: expect.arrayContaining([{ kind: 'update', target: '.safeword/version' }]),
      },
    });
    expect(readFileSync(projectVersion, 'utf8').trim()).toBe(VERSION);
    expect(readFileSync(externalVersion, 'utf8')).toBe('garbage');
  });

  it('refuses to repair through a symbolic Safeword directory', async () => {
    const directory = createTemporaryDirectory();
    const externalSafeword = nodePath.join(directory, 'external-safeword');
    mkdirSync(externalSafeword);
    writeFileSync(nodePath.join(externalSafeword, 'version'), 'garbage');
    symlinkSync(externalSafeword, nodePath.join(directory, '.safeword'), 'dir');
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({ name: 'parent-symlink' }),
    );

    const result = await convergeSetup(directory, {
      repairVersionMarker: true,
      noModify: true,
    });

    expect(result).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [
        expect.objectContaining({
          code: 'PROJECT_VERSION_UNSAFE',
          message: expect.stringContaining('.safeword must be an ordinary directory'),
        }),
      ],
      recovery: [],
    });
    expect(readFileSync(nodePath.join(externalSafeword, 'version'), 'utf8')).toBe('garbage');
  });
});
