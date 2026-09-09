import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertBundledHookCommand,
  codexPluginHookCommands,
  type CodexPluginHookEntry,
} from '../src/codex-plugin/hooks.js';
import {
  assertPackedCodexPlugin,
  extractPackedCliPackage,
  packCliPackage,
} from './helpers/codex-plugin-package.js';

function treeDigest(root: string): string {
  const hash = createHash('sha256');
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true }).toSorted((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const path = nodePath.join(directory, entry.name);
      hash.update(nodePath.relative(root, path));
      if (entry.isDirectory()) visit(path);
      else hash.update(readFileSync(path));
    }
  };
  visit(root);
  return hash.digest('hex');
}

function filesUnder(root: string, relative = ''): string[] {
  return readdirSync(nodePath.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const path = nodePath.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(root, path) : [path];
  });
}

describe('Codex plugin release contract', () => {
  it.each(['base', 'cachebusted'])(
    'generates a complete bundle at explicit effective version %s',
    versionKind => {
      const root = nodePath.resolve(import.meta.dirname, '..');
      const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-effective-version-'));
      const packageVersion = (
        JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8')) as {
          version: string;
        }
      ).version;
      const effectiveVersion =
        versionKind === 'base' ? packageVersion : `${packageVersion.split('+', 1)[0]}+codex.test`;
      const output = nodePath.join(fixture, 'plugin');

      try {
        const generation = spawnSync(
          'bun',
          ['scripts/generate-codex-plugin.ts', '--version', effectiveVersion, '--output', output],
          { cwd: root, encoding: 'utf8' },
        );

        expect(generation.status, generation.stderr).toBe(0);
        expect(existsSync(output), generation.stdout).toBe(true);
        const manifestContents = readFileSync(
          nodePath.join(output, '.codex-plugin/plugin.json'),
          'utf8',
        );
        const runtimePackageContents = readFileSync(nodePath.join(output, 'package.json'), 'utf8');
        const generatedHookManifest = readFileSync(nodePath.join(output, 'hooks.json'));
        const sourceHookManifest = readFileSync(nodePath.join(root, 'codex-plugin/hooks.json'));
        expect(JSON.parse(manifestContents)).toMatchObject({ version: effectiveVersion });
        expect(JSON.parse(runtimePackageContents)).toMatchObject({ version: effectiveVersion });
        expect(generatedHookManifest).toEqual(sourceHookManifest);
        const generatedHooks = (JSON.parse(generatedHookManifest.toString()) as {
          hooks: Record<string, CodexPluginHookEntry[]>;
        }).hooks;
        for (const command of codexPluginHookCommands(generatedHooks)) {
          expect(() => {
            assertBundledHookCommand(command);
          }).not.toThrow();
        }
        const bundleContents = filesUnder(output)
          .map(path => readFileSync(nodePath.join(output, path), 'utf8'))
          .join('\n');
        expect(bundleContents).toContain(`/safeword/${effectiveVersion}/runtime/cli.js`);
        if (effectiveVersion !== packageVersion) {
          expect(bundleContents).not.toContain(`/safeword/${packageVersion}/runtime/cli.js`);
        }

        const runtimePath = nodePath.join(output, 'runtime/cli.js');
        const runtime = spawnSync('bun', [runtimePath, '--version'], { encoding: 'utf8' });
        expect(runtime.status, runtime.stderr).toBe(0);
        expect(runtime.stdout.trim()).toBe(effectiveVersion);

        const codexHome = nodePath.join(fixture, 'codex-home');
        const project = nodePath.join(fixture, 'project');
        mkdirSync(project);
        const sessionStart = spawnSync(
          'bun',
          [runtimePath, 'hook', 'codex', 'session-start', '--plugin-hook'],
          {
            cwd: project,
            encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: '', CODEX_HOME: codexHome },
            input: JSON.stringify({ session_id: `effective-version-${versionKind}` }),
          },
        );
        expect(sessionStart.status, sessionStart.stderr).toBe(0);
        const proof = JSON.parse(
          readFileSync(
            nodePath.join(codexHome, 'safeword/hook-proof-v2/session-start.json'),
            'utf8',
          ),
        ) as Record<string, unknown>;
        expect(proof).toMatchObject({ plugin_version: effectiveVersion });
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    },
    30_000,
  );

  it.each([
    ['not-a-version', 'Effective version is not valid SemVer'],
    ['0.84.0+codex.test', 'Effective version must describe the same release as'],
  ])(
    'rejects effective version %s without changing the shipped bundle',
    (effectiveVersion, expectedError) => {
      const root = nodePath.resolve(import.meta.dirname, '..');
      const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-rejection-'));
      const output = nodePath.join(fixture, 'plugin');
      const shippedRoot = nodePath.join(root, 'codex-plugin');
      const before = treeDigest(shippedRoot);
      try {
        const generation = spawnSync(
          'bun',
          ['scripts/generate-codex-plugin.ts', '--version', effectiveVersion, '--output', output],
          { cwd: root, encoding: 'utf8' },
        );

        expect(generation.status).not.toBe(0);
        expect(generation.stderr).toContain(expectedError);
        expect(existsSync(output)).toBe(false);
        expect(treeDigest(shippedRoot)).toBe(before);
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    },
  );

  it('rejects a version override without a fresh output', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const shippedRoot = nodePath.join(root, 'codex-plugin');
    const before = treeDigest(shippedRoot);
    const generation = spawnSync(
      'bun',
      ['scripts/generate-codex-plugin.ts', '--version', '0.83.1+codex.test'],
      { cwd: root, encoding: 'utf8' },
    );

    expect(generation.status).not.toBe(0);
    expect(generation.stderr).toContain('--version and --output must be provided together');
    expect(treeDigest(shippedRoot)).toBe(before);
  });

  it('rejects a custom output inside the checked-in plugin directory', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const shippedRoot = nodePath.join(root, 'codex-plugin');
    const output = nodePath.join(shippedRoot, `.cachebusted-test-${process.pid}`);
    const packageVersion = (
      JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8')) as { version: string }
    ).version;
    const before = treeDigest(shippedRoot);

    try {
      const generation = spawnSync(
        'bun',
        [
          'scripts/generate-codex-plugin.ts',
          '--version',
          `${packageVersion.split('+', 1)[0]}+codex.test`,
          '--output',
          output,
        ],
        { cwd: root, encoding: 'utf8' },
      );

      expect(generation.status).not.toBe(0);
      expect(generation.stderr).toContain(
        'Custom output must be outside the checked-in Codex plugin directory',
      );
      expect(existsSync(output)).toBe(false);
      expect(treeDigest(shippedRoot)).toBe(before);
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  });

  it('keeps default generation deterministic at the package version', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const generation = spawnSync('bun', ['scripts/generate-codex-plugin.ts', '--check'], {
      cwd: root,
      encoding: 'utf8',
    });
    const packageVersion = (
      JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8')) as { version: string }
    ).version;

    expect(generation.status, generation.stderr).toBe(0);
    expect(generation.stdout).toContain(`current at ${packageVersion}`);
  });

  it('does not change Claude or Cursor artifacts during cachebusted generation', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const repoRoot = nodePath.resolve(root, '../..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-host-parity-'));
    const output = nodePath.join(fixture, 'plugin');
    const packageVersion = (
      JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8')) as { version: string }
    ).version;
    const cachebustedVersion = `${packageVersion.split('+', 1)[0]}+codex.parity`;
    const protectedTrees = [
      nodePath.join(repoRoot, '.claude'),
      nodePath.join(repoRoot, '.cursor'),
      nodePath.join(root, '../../plugin'),
      nodePath.join(root, 'codex-plugin'),
    ];
    const before = protectedTrees.map(treeDigest);
    try {
      const generation = spawnSync(
        'bun',
        ['scripts/generate-codex-plugin.ts', '--version', cachebustedVersion, '--output', output],
        { cwd: root, encoding: 'utf8' },
      );

      expect(generation.status, generation.stderr).toBe(0);
      expect(treeDigest(output)).not.toBe(treeDigest(nodePath.join(root, 'codex-plugin')));
      expect(protectedTrees.map(treeDigest)).toEqual(before);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('accepts a cachebusted bundle identity without repair guidance', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const repoRoot = nodePath.resolve(root, '../..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-status-'));
    const codexHome = nodePath.join(fixture, 'codex-home');
    const marketplaceRoot = nodePath.join(fixture, 'marketplace');
    const output = nodePath.join(marketplaceRoot, 'packages/cli/codex-plugin');
    const project = nodePath.join(fixture, 'project');
    const packageVersion = (
      JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8')) as {
        version: string;
      }
    ).version;
    const cachebustedVersion = `${packageVersion.split('+', 1)[0]}+codex.status`;
    mkdirSync(project);
    mkdirSync(codexHome, { recursive: true });
    mkdirSync(nodePath.join(marketplaceRoot, '.agents/plugins'), { recursive: true });
    mkdirSync(nodePath.dirname(output), { recursive: true });
    cpSync(
      nodePath.join(repoRoot, '.agents/plugins/marketplace.json'),
      nodePath.join(marketplaceRoot, '.agents/plugins/marketplace.json'),
    );

    try {
      const environment = {
        ...process.env,
        CLAUDE_PROJECT_DIR: '',
        CODEX_HOME: codexHome,
      };
      const generation = spawnSync(
        'bun',
        ['scripts/generate-codex-plugin.ts', '--version', cachebustedVersion, '--output', output],
        { cwd: root, encoding: 'utf8', env: environment },
      );
      expect(generation.status, generation.stderr).toBe(0);

      const marketplaceAdd = spawnSync(
        'codex',
        ['plugin', 'marketplace', 'add', marketplaceRoot, '--json'],
        { encoding: 'utf8', env: environment },
      );
      expect(marketplaceAdd.status, marketplaceAdd.stderr).toBe(0);
      const install = spawnSync(
        'codex',
        ['plugin', 'add', 'safeword', '--marketplace', 'safeword', '--json'],
        { encoding: 'utf8', env: environment },
      );
      expect(install.status, install.stderr).toBe(0);
      const installed = JSON.parse(install.stdout) as { installedPath: string; version: string };
      expect(installed.version).toBe(cachebustedVersion);
      const runtimePath = nodePath.join(installed.installedPath, 'runtime/cli.js');
      const sessionStart = spawnSync(
        'bun',
        [runtimePath, 'hook', 'codex', 'session-start', '--plugin-hook'],
        {
          cwd: project,
          encoding: 'utf8',
          env: environment,
          input: JSON.stringify({ session_id: 'cachebusted-status' }),
        },
      );
      expect(sessionStart.status, sessionStart.stderr).toBe(0);

      const status = spawnSync('bun', [runtimePath, 'codex', 'status', '--json'], {
        cwd: project,
        encoding: 'utf8',
        env: environment,
      });
      expect(status.status, status.stderr).toBe(2);
      const result = JSON.parse(status.stdout) as Record<string, unknown>;
      expect(result).toMatchObject({
        data: {
          migration: { state: 'plugin_enabled_hook_unproven' },
          proof: { plugin_version: cachebustedVersion },
        },
      });
      expect(JSON.stringify(result.next_actions)).not.toContain('safeword codex migrate');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 30_000);

  it('records the independently adoptable task-bound Codex plugin-root contract', () => {
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
    const ticketRelativePath = '0HZBXF-keep-cachebusted-codex-plugins-operational/design.md';
    const activeDesignPath = nodePath.join(repoRoot, '.project/tickets', ticketRelativePath);
    const designPath = existsSync(activeDesignPath)
      ? activeDesignPath
      : nodePath.join(repoRoot, '.project/tickets/completed', ticketRelativePath);
    const design = readFileSync(designPath, 'utf8');
    const upstreamContract = design
      .split('## Upstream Codex contract\n', 2)[1]
      ?.split('\n## ', 1)[0];

    expect(upstreamContract).toContain('task-bound `PLUGIN_ROOT`');
    expect(upstreamContract).toContain('exact immutable plugin directory');
    expect(upstreamContract).toContain('Host adoption is a non-dependency for this delivery');
    expect(upstreamContract).toContain('independently adoptable later');
  });

  it('runs every hook through the bundled plugin CLI', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const version = JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8'))
      .version as string;
    const manifest = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/.codex-plugin/plugin.json'), 'utf8'),
    ) as { version: string };
    const runtimePackage = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/package.json'), 'utf8'),
    ) as { version: string };
    const hooks = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/hooks.json'), 'utf8'),
    ) as {
      hooks: Record<string, CodexPluginHookEntry[]>;
    };

    expect(manifest.version).toBe(version);
    expect(runtimePackage.version).toBe(version);
    const commands = codexPluginHookCommands(hooks.hooks);
    expect(commands).toEqual([
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex session-start --plugin-hook',
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex pre-tool-use --plugin-hook',
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex post-tool-use --plugin-hook',
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex user-prompt-submit --plugin-hook',
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex stop --plugin-hook',
    ]);
    for (const command of commands) {
      expect(() => {
        assertBundledHookCommand(command);
      }).not.toThrow();
    }
    expect(readFileSync(nodePath.join(root, 'codex-plugin/runtime/cli.js'), 'utf8')).toBe(
      readFileSync(nodePath.resolve(root, '../../plugin/runtime/cli.js'), 'utf8'),
    );
  });

  it('rejects unsafe plugin hook execution paths', () => {
    expect(() => {
      assertBundledHookCommand('npx safeword@0.68.0 hook codex session-start');
    }).toThrow('must not install packages');
    expect(() => {
      assertBundledHookCommand('bunx --bun safeword hook codex session-start');
    }).toThrow('must not install packages');
    expect(() => {
      assertBundledHookCommand(
        'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex session-start --dangerously-bypass-hook-trust',
      );
    }).toThrow('must not bypass');
  });

  it('executes the bundled CLI without project dependencies or a populated package cache', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-runtime-'));
    try {
      const result = spawnSync(
        'bun',
        [nodePath.join(root, 'codex-plugin/runtime/cli.js'), '--version'],
        {
          cwd: fixture,
          encoding: 'utf8',
          env: { ...process.env, BUN_INSTALL_CACHE_DIR: nodePath.join(fixture, 'empty-cache') },
        },
      );
      const version = (
        JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8')) as {
          version: string;
        }
      ).version;

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(version);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('executes from the cache path reported by a real Codex plugin install', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const repoRoot = nodePath.resolve(root, '../..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-install-'));
    const codexHome = nodePath.join(fixture, 'home');
    const marketplaceRoot = nodePath.join(fixture, 'marketplace');
    mkdirSync(codexHome, { recursive: true });
    mkdirSync(nodePath.join(marketplaceRoot, '.agents/plugins'), { recursive: true });
    mkdirSync(nodePath.join(marketplaceRoot, 'packages/cli'), { recursive: true });
    cpSync(
      nodePath.join(repoRoot, '.agents/plugins/marketplace.json'),
      nodePath.join(marketplaceRoot, '.agents/plugins/marketplace.json'),
    );
    cpSync(
      nodePath.join(root, 'codex-plugin'),
      nodePath.join(marketplaceRoot, 'packages/cli/codex-plugin'),
      {
        recursive: true,
      },
    );

    try {
      const environment = { ...process.env, CLAUDE_PROJECT_DIR: '', CODEX_HOME: codexHome };
      const marketplaceAddResult = spawnSync(
        'codex',
        ['plugin', 'marketplace', 'add', marketplaceRoot, '--json'],
        { encoding: 'utf8', env: environment },
      );
      expect(marketplaceAddResult.status, marketplaceAddResult.stderr).toBe(0);
      const install = spawnSync(
        'codex',
        ['plugin', 'add', 'safeword', '--marketplace', 'safeword', '--json'],
        { encoding: 'utf8', env: environment },
      );
      expect(install.status, install.stderr).toBe(0);

      const installed = JSON.parse(install.stdout) as { installedPath: string; version: string };
      expect(realpathSync(installed.installedPath)).toBe(
        realpathSync(
          nodePath.join(codexHome, 'plugins/cache/safeword/safeword', installed.version),
        ),
      );
      const runtime = spawnSync(
        'bun',
        [nodePath.join(installed.installedPath, 'runtime/cli.js'), '--version'],
        { encoding: 'utf8', env: environment },
      );
      expect(runtime.status, runtime.stderr).toBe(0);
      expect(runtime.stdout.trim()).toBe(installed.version);

      const unenrolledProject = nodePath.join(fixture, 'unenrolled-project');
      mkdirSync(unenrolledProject, { recursive: true });
      const sessionStart = spawnSync(
        'bun',
        [
          nodePath.join(installed.installedPath, 'runtime/cli.js'),
          'hook',
          'codex',
          'session-start',
          '--plugin-hook',
        ],
        {
          cwd: unenrolledProject,
          encoding: 'utf8',
          env: environment,
          input: JSON.stringify({ session_id: 'release-contract' }),
        },
      );
      expect(sessionStart.status, sessionStart.stderr).toBe(0);
      expect(JSON.parse(sessionStart.stdout)).toMatchObject({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: expect.stringContaining('Safeword session bootstrap'),
        },
      });
      const sessionProof = JSON.parse(
        readFileSync(nodePath.join(codexHome, 'safeword/hook-proof-v2/session-start.json'), 'utf8'),
      ) as Record<string, unknown>;
      const hookManifest = readFileSync(nodePath.join(installed.installedPath, 'hooks.json'));
      const sourceHookManifest = readFileSync(nodePath.join(root, 'codex-plugin/hooks.json'));
      expect(hookManifest).toEqual(sourceHookManifest);
      expect(sessionProof).toMatchObject({
        schema_version: 3,
        event: 'session-start',
        plugin_version: installed.version,
        manifest_sha256: createHash('sha256').update(sourceHookManifest).digest('hex'),
        project_directory: realpathSync(unenrolledProject),
        session_id: 'release-contract',
      });
      const status = spawnSync(
        'bun',
        [nodePath.join(installed.installedPath, 'runtime/cli.js'), 'codex', 'status', '--json'],
        { cwd: unenrolledProject, encoding: 'utf8', env: environment },
      );
      expect(status.status, status.stderr).toBe(2);
      expect(JSON.parse(status.stdout)).toMatchObject({
        data: {
          migration: { state: 'plugin_enabled_hook_unproven' },
          proof: {
            status: 'partial',
            plugin_version: installed.version,
            manifest_sha256: createHash('sha256').update(sourceHookManifest).digest('hex'),
            events: ['session-start'],
          },
        },
      });

      const projectDirectory = nodePath.join(fixture, 'project');
      mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
      cpSync(
        nodePath.join(root, 'templates/SAFEWORD.md'),
        nodePath.join(projectDirectory, '.safeword/SAFEWORD.md'),
      );
      const hook = spawnSync(
        'bun',
        [
          nodePath.join(installed.installedPath, 'runtime/cli.js'),
          'hook',
          'codex',
          'pre-tool-use',
          '--plugin-hook',
        ],
        {
          cwd: projectDirectory,
          encoding: 'utf8',
          env: { ...environment, CLAUDE_PROJECT_DIR: projectDirectory },
          input: JSON.stringify({
            session_id: 'release-contract',
            tool_name: 'Bash',
            tool_input: { command: "sed -n '1,20p' README.md" },
          }),
        },
      );
      expect(hook.status, hook.stderr).toBe(0);
      expect(hook.stdout).toBe('');

      const baseInstalledPath = installed.installedPath;
      const cachebustedVersion = `${installed.version.split('+', 1)[0]}+codex.test`;
      const marketplacePlugin = nodePath.join(marketplaceRoot, 'packages/cli/codex-plugin');
      rmSync(marketplacePlugin, { recursive: true, force: true });
      const generation = spawnSync(
        'bun',
        [
          'scripts/generate-codex-plugin.ts',
          '--version',
          cachebustedVersion,
          '--output',
          marketplacePlugin,
        ],
        { cwd: root, encoding: 'utf8', env: environment },
      );
      expect(generation.status, generation.stderr).toBe(0);

      const cachebustedInstall = spawnSync(
        'codex',
        ['plugin', 'add', 'safeword', '--marketplace', 'safeword', '--json'],
        { encoding: 'utf8', env: environment },
      );
      expect(cachebustedInstall.status, cachebustedInstall.stderr).toBe(0);
      const cachebusted = JSON.parse(cachebustedInstall.stdout) as {
        installedPath: string;
        version: string;
      };
      expect(cachebusted.version).toBe(cachebustedVersion);
      expect(readFileSync(nodePath.join(cachebusted.installedPath, 'hooks.json'))).toEqual(
        readFileSync(nodePath.join(root, 'codex-plugin/hooks.json')),
      );
      expect(existsSync(baseInstalledPath)).toBe(true);
      const preservedBaseRuntime = spawnSync(
        'bun',
        [nodePath.join(baseInstalledPath, 'runtime/cli.js'), '--version'],
        { encoding: 'utf8', env: environment },
      );
      expect(preservedBaseRuntime.status, preservedBaseRuntime.stderr).toBe(0);
      expect(preservedBaseRuntime.stdout.trim()).toBe(installed.version);
      expect(realpathSync(cachebusted.installedPath)).toBe(
        realpathSync(
          nodePath.join(codexHome, 'plugins/cache/safeword/safeword', cachebustedVersion),
        ),
      );
      const generatedWorkflow = readFileSync(
        nodePath.join(cachebusted.installedPath, 'skills/self-review/SKILL.md'),
        'utf8',
      );
      expect(generatedWorkflow).toContain(
        `/plugins/cache/safeword/safeword/${cachebustedVersion}/runtime/cli.js`,
      );
      expect(generatedWorkflow).not.toContain(
        `/plugins/cache/safeword/safeword/${installed.version}/runtime/cli.js`,
      );

      const cachebustedRuntime = spawnSync(
        'bun',
        [nodePath.join(cachebusted.installedPath, 'runtime/cli.js'), '--version'],
        { encoding: 'utf8', env: environment },
      );
      expect(cachebustedRuntime.status, cachebustedRuntime.stderr).toBe(0);
      expect(cachebustedRuntime.stdout.trim()).toBe(cachebustedVersion);

      const cachebustedSessionStart = spawnSync(
        'bun',
        [
          nodePath.join(cachebusted.installedPath, 'runtime/cli.js'),
          'hook',
          'codex',
          'session-start',
          '--plugin-hook',
        ],
        {
          cwd: unenrolledProject,
          encoding: 'utf8',
          env: environment,
          input: JSON.stringify({ session_id: 'cachebusted-release-contract' }),
        },
      );
      expect(cachebustedSessionStart.status, cachebustedSessionStart.stderr).toBe(0);
      const cachebustedStatus = spawnSync(
        'bun',
        [nodePath.join(cachebusted.installedPath, 'runtime/cli.js'), 'codex', 'status', '--json'],
        { cwd: unenrolledProject, encoding: 'utf8', env: environment },
      );
      expect(cachebustedStatus.status, cachebustedStatus.stderr).toBe(2);
      const cachebustedStatusResult = JSON.parse(cachebustedStatus.stdout) as Record<
        string,
        unknown
      >;
      expect(cachebustedStatusResult).toMatchObject({
        data: {
          migration: { state: 'plugin_enabled_hook_unproven' },
          proof: { plugin_version: cachebustedVersion },
        },
      });
      expect(JSON.stringify(cachebustedStatusResult.next_actions)).not.toContain(
        'safeword codex migrate',
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 30_000);

  it('includes the complete generated plugin in a Bun-packed archive', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-pack-'));
    try {
      const archive = packCliPackage(root, fixture);
      const packageDirectory = extractPackedCliPackage(archive, fixture);

      expect(() => {
        assertPackedCodexPlugin(root, packageDirectory);
      }).not.toThrow();
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('rejects a packed plugin with a missing generated asset', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-pack-'));
    try {
      const archive = packCliPackage(root, fixture);
      const packageDirectory = extractPackedCliPackage(archive, fixture);
      rmSync(nodePath.join(packageDirectory, 'codex-plugin/skills/bdd/references/DISCOVERY.md'));

      expect(() => {
        assertPackedCodexPlugin(root, packageDirectory);
      }).toThrow('missing expected asset');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('rejects a packed plugin with a missing packaged hook artifact', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-pack-'));
    try {
      const archive = packCliPackage(root, fixture);
      const packageDirectory = extractPackedCliPackage(archive, fixture);
      rmSync(nodePath.join(packageDirectory, 'codex-plugin/templates/SAFEWORD.md'));

      expect(() => {
        assertPackedCodexPlugin(root, packageDirectory);
      }).toThrow('generated tree does not match its source tree');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('uses only Codex-supported tool matchers for edit hooks', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const hooks = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/hooks.json'), 'utf8'),
    ) as {
      hooks: Record<string, CodexPluginHookEntry[]>;
    };

    const preToolUseHooks = hooks.hooks.PreToolUse ?? [];
    const postToolUseHooks = hooks.hooks.PostToolUse ?? [];
    expect(preToolUseHooks).toHaveLength(1);
    expect(postToolUseHooks).toHaveLength(1);
    expect(preToolUseHooks[0]?.matcher).toBe('^(apply_patch|Bash|Edit|Write)$');
    expect(postToolUseHooks[0]?.matcher).toBe('^(apply_patch|Bash|Edit|Write)$');
  });
});
