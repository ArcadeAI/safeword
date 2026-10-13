import {
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  safewordClis,
  trustedEnvironment,
  type TrustedRuntime,
  trustedSafewordClis,
} from '../../templates/hooks/lib/safeword-cli.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers';

// Ticket 8VG20K: every hook finds the Safeword CLI through one shared lookup.
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) removeTemporaryDirectory(directory);
});

function scratchDirectory(): string {
  const path = createTemporaryDirectory();
  directories.push(path);
  return path;
}

function write(root: string, relative: string, content = ''): string {
  const path = nodePath.join(root, relative);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

/** A Safeword project pinned to 1.2.3. */
function project(): string {
  const root = scratchDirectory();
  write(root, '.safeword/version', '1.2.3\n');
  return root;
}

function pluginRoot(): string {
  const root = scratchDirectory();
  write(root, 'runtime/cli.js');
  return root;
}

describe('trusted Safeword CLI lookup', () => {
  /** A Bun binary outside every project, as an absolute path. */
  function runtime(): TrustedRuntime {
    return { path: write(scratchDirectory(), 'bin/bun'), isBun: true };
  }
  const real = (path: string) => realpathSync(path);

  it('prefers the plugin bundle, then bun x pinned to the project version from home', () => {
    const root = project();
    const plugin = pluginRoot();
    const bun = runtime();
    const cli = real(nodePath.join(plugin, 'runtime/cli.js'));

    expect(trustedSafewordClis(root, { CLAUDE_PLUGIN_ROOT: plugin }, bun)).toEqual([
      { command: real(bun.path), args: ['--no-env-file', cli], cwd: nodePath.dirname(cli) },
      {
        command: real(bun.path),
        args: ['x', '--bun', 'safeword@1.2.3'],
        cwd: homedir(),
        downloads: true,
      },
    ]);
  });

  it('uses pinned bun x when no plugin is present', () => {
    const bun = runtime();
    expect(trustedSafewordClis(project(), {}, bun)).toEqual([
      {
        command: real(bun.path),
        args: ['x', '--bun', 'safeword@1.2.3'],
        cwd: homedir(),
        downloads: true,
      },
    ]);
  });

  it('includes the Codex plugin cache for the pinned version', () => {
    const root = project();
    const codexHome = scratchDirectory();
    const cached = real(write(codexHome, 'plugins/cache/safeword/safeword/1.2.3/runtime/cli.js'));
    const bun = runtime();

    expect(trustedSafewordClis(root, { CODEX_HOME: codexHome }, bun)[0]).toEqual({
      command: real(bun.path),
      args: ['--no-env-file', cached],
      cwd: nodePath.dirname(cached),
    });
  });

  it('refuses a plugin path inside the project, which project code could edit', () => {
    const root = project();
    const inside = write(root, 'evil/runtime/cli.js');

    expect(
      trustedSafewordClis(root, { SAFEWORD_PLUGIN_CLI: inside }, runtime()).map(cli => cli.args[0]),
    ).toEqual(['x']);
  });

  it("runs a symlinked plugin CLI from its real directory, not the link's", () => {
    const root = project();
    const external = real(write(scratchDirectory(), 'runtime/cli.js'));
    const link = nodePath.join(root, 'linked-cli.js');
    symlinkSync(external, link);

    expect(trustedSafewordClis(root, { SAFEWORD_PLUGIN_CLI: link }, runtime())[0]?.cwd).toBe(
      nodePath.dirname(external),
    );
  });

  it('runs the package from outside the project when the project is the home directory', () => {
    const root = project();
    const previousHome = process.env.HOME;
    process.env.HOME = root;
    try {
      const runner = trustedSafewordClis(root, {}, runtime()).at(-1);
      expect(runner?.args).toEqual(['x', '--bun', 'safeword@1.2.3']);
      expect(runner?.cwd).not.toBe(root);
      expect(realpathSync(runner?.cwd ?? root).startsWith(realpathSync(root))).toBe(false);
    } finally {
      process.env.HOME = previousHome;
    }
  });

  it('refuses a runtime inside the project', () => {
    const root = project();
    const bun: TrustedRuntime = { path: write(root, 'bin/bun'), isBun: true };

    expect(trustedSafewordClis(root, { CLAUDE_PLUGIN_ROOT: pluginRoot() }, bun)).toEqual([]);
  });

  it('refuses this repo source and the installed package', () => {
    const root = project();
    write(root, 'packages/cli/package.json', '{"name":"safeword"}');
    write(root, 'packages/cli/src/cli.ts');
    write(root, 'node_modules/.bin/safeword');

    expect(trustedSafewordClis(root, {}, runtime()).map(cli => cli.args[0])).toEqual(['x']);
  });

  it('returns nothing for a project with no pinned version and no plugin', () => {
    expect(trustedSafewordClis(scratchDirectory(), {}, runtime())).toEqual([]);
  });
});

describe('working Safeword CLI lookup', () => {
  it('prefers the plugin bundle', () => {
    const root = project();
    const plugin = write(pluginRoot(), 'runtime/cli.js');

    expect(safewordClis(root, { SAFEWORD_PLUGIN_CLI: plugin })[0]).toEqual({
      command: 'bun',
      args: [plugin],
      cwd: root,
    });
  });

  it('then this repo source, the installed package, and pinned bunx', () => {
    const root = project();
    const source = write(root, 'packages/cli/src/cli.ts');
    write(root, 'packages/cli/package.json', '{"name":"safeword"}');
    const installed = write(root, 'node_modules/.bin/safeword');
    write(root, 'node_modules/safeword/package.json', '{"name":"safeword","version":"1.2.3"}');

    expect(safewordClis(root, {})).toEqual([
      { command: 'bun', args: [source], cwd: root },
      { command: installed, args: [], cwd: root },
      { command: 'bunx', args: ['safeword@1.2.3'], cwd: root, downloads: true },
    ]);
  });

  it('uses the installed package only when it matches the pinned version', () => {
    const root = project();
    const installed = write(root, 'node_modules/.bin/safeword');
    write(root, 'node_modules/safeword/package.json', '{"name":"safeword","version":"9.0.0"}');
    expect(safewordClis(root, {}).map(cli => cli.command)).toEqual(['bunx']);

    write(root, 'node_modules/safeword/package.json', '{"name":"safeword","version":"1.2.3"}');
    expect(safewordClis(root, {}).map(cli => cli.command)).toEqual([installed, 'bunx']);
  });

  it('ignores a lookalike source checkout that is not the safeword package', () => {
    const root = project();
    write(root, 'packages/cli/src/cli.ts');
    write(root, 'packages/cli/package.json', '{"name":"other"}');

    expect(safewordClis(root, {}).map(cli => cli.args[0])).toEqual(['safeword@1.2.3']);
  });

  it('never falls back to an unpinned or latest bunx', () => {
    expect(safewordClis(scratchDirectory(), {})).toEqual([]);
  });
});

describe('every hook uses the shared lookup', () => {
  const HOOKS = nodePath.resolve(import.meta.dirname, '../../templates/hooks');
  // Auto-upgrade deliberately runs the newest version.
  const UPGRADE = new Set(['lib/auto-upgrade.ts']);

  function hookSources(): [string, string][] {
    return readdirSync(HOOKS, { recursive: true, encoding: 'utf8' })
      .filter(path => path.endsWith('.ts') && !UPGRADE.has(path))
      .map(path => [path, readFileSync(nodePath.join(HOOKS, path), 'utf8')]);
  }

  it('never runs safeword@latest or an unpinned bunx safeword', () => {
    const offenders = hookSources()
      .filter(([, source]) => /safeword@latest|'bunx',\s*'safeword'/u.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it('never resolves the plugin CLI path outside the shared module', () => {
    const offenders = hookSources()
      .filter(
        ([path, source]) =>
          path !== 'lib/safeword-cli.ts' && /'runtime',\s*'cli\.js'/u.test(source),
      )
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});

describe('trusted CLI environment', () => {
  it('drops path settings that resolve inside the project, symlinks and not-yet-created ones included', () => {
    const root = project();
    const outside = scratchDirectory();
    const link = nodePath.join(outside, 'link-to-project');
    symlinkSync(root, link);

    expect(
      trustedEnvironment(root, {
        HOME: outside,
        TMPDIR: nodePath.join(root, 'tmp'),
        BUN_INSTALL_CACHE_DIR: nodePath.join(link, 'cache'),
        XDG_STATE_HOME: nodePath.join(outside, 'not-created-yet'),
      }),
    ).toEqual({ HOME: outside, XDG_STATE_HOME: nodePath.join(outside, 'not-created-yet') });
  });

  it('keeps host paths and registry settings but drops runtime preload options', () => {
    expect(
      trustedEnvironment(scratchDirectory(), {
        PATH: '/usr/bin',
        HOME: '/home/user',
        BUN_CONFIG_REGISTRY: 'https://registry.example',
        BUN_OPTIONS: '--preload ./forge.ts',
        NODE_OPTIONS: '--require ./forge.js',
        SAFEWORD_PLUGIN_CLI: '/plugin/runtime/cli.js',
      }),
    ).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/user',
      BUN_CONFIG_REGISTRY: 'https://registry.example',
    });
  });
});
