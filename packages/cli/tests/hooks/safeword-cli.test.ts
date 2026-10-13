import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { safewordClis, trustedSafewordClis } from '../../templates/hooks/lib/safeword-cli.js';
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
  it('prefers the plugin bundle, then pinned bunx run from the home directory', () => {
    const root = project();
    const plugin = pluginRoot();

    expect(trustedSafewordClis(root, { CLAUDE_PLUGIN_ROOT: plugin })).toEqual([
      { command: 'bun', args: [nodePath.join(plugin, 'runtime/cli.js')], cwd: root },
      { command: 'bunx', args: ['safeword@1.2.3'], cwd: homedir() },
    ]);
  });

  it('uses pinned bunx when no plugin is present', () => {
    expect(trustedSafewordClis(project(), {})).toEqual([
      { command: 'bunx', args: ['safeword@1.2.3'], cwd: homedir() },
    ]);
  });

  it('includes the Codex plugin cache for the pinned version', () => {
    const root = project();
    const codexHome = scratchDirectory();
    const cached = write(codexHome, 'plugins/cache/safeword/safeword/1.2.3/runtime/cli.js');

    expect(trustedSafewordClis(root, { CODEX_HOME: codexHome })[0]).toEqual({
      command: 'bun',
      args: [cached],
      cwd: root,
    });
  });

  it('refuses a plugin path inside the project, which project code could edit', () => {
    const root = project();
    const inside = write(root, 'evil/runtime/cli.js');

    expect(
      trustedSafewordClis(root, { SAFEWORD_PLUGIN_CLI: inside }).map(cli => cli.command),
    ).toEqual(['bunx']);
  });

  it('refuses this repo source and the installed package', () => {
    const root = project();
    write(root, 'packages/cli/package.json', '{"name":"safeword"}');
    write(root, 'packages/cli/src/cli.ts');
    write(root, 'node_modules/safeword/dist/cli.js');

    expect(trustedSafewordClis(root, {}).map(cli => cli.command)).toEqual(['bunx']);
  });

  it('returns nothing for a project with no pinned version and no plugin', () => {
    expect(trustedSafewordClis(scratchDirectory(), {})).toEqual([]);
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
    const installed = write(root, 'node_modules/safeword/dist/cli.js');

    expect(safewordClis(root, {})).toEqual([
      { command: 'bun', args: [source], cwd: root },
      { command: 'bun', args: [installed], cwd: root },
      { command: 'bunx', args: ['safeword@1.2.3'], cwd: root },
    ]);
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
