/**
 * Ticket 8VG20K: an action hook outside a plugin runs exactly the installed
 * Safeword version — the project's own package only when it matches
 * `.safeword/version`, otherwise the pinned published package, run through
 * the real `bunx` against a local registry.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers';
import { publishSafeword } from '../helpers/local-npm-registry.js';

const HEAL = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/session-architecture-heal.ts',
);

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) removeTemporaryDirectory(directory);
});

function scratch(): string {
  const directory = createTemporaryDirectory();
  directories.push(directory);
  return directory;
}

/** Record which CLI ran: the CLI writes its own label to MARKER. */
const recordAs = (label: string) =>
  `require('node:fs').writeFileSync(process.env.MARKER, ${JSON.stringify(label)});\n`;

/** A project pinned to 1.2.3 whose node_modules carries `installedVersion`; returns which CLI ran. */
function cliRunByHeal(installedVersion: string): string {
  const project = scratch();
  const marker = nodePath.join(project, 'ran');
  writeTestFile(project, '.safeword/version', '1.2.3\n');
  // A real install: the package declares its bin, and .bin/safeword runs it.
  writeTestFile(
    project,
    'node_modules/safeword/package.json',
    JSON.stringify({ name: 'safeword', version: installedVersion, bin: { safeword: 'cli.js' } }),
  );
  const installedLabel = `installed ${installedVersion}`;
  const installedCli = `#!/usr/bin/env node\n${recordAs(installedLabel)}`;
  writeTestFile(project, 'node_modules/safeword/cli.js', installedCli);
  writeTestFile(project, 'node_modules/.bin/safeword', installedCli);
  chmodSync(nodePath.join(project, 'node_modules/safeword/cli.js'), 0o755);
  chmodSync(nodePath.join(project, 'node_modules/.bin/safeword'), 0o755);
  const published = publishSafeword({
    root: scratch(),
    version: '1.2.3',
    cliSource: recordAs('published 1.2.3'),
  });
  const temporary = scratch();

  try {
    const result = spawnSync('bun', [HEAL], {
      cwd: project,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: project,
        CLAUDE_PLUGIN_ROOT: '',
        SAFEWORD_PLUGIN_CLI: '',
        MARKER: marker,
        BUN_CONFIG_REGISTRY: published.registry,
        BUN_INSTALL_CACHE_DIR: published.cache,
        // bun x keeps installed packages under TMPDIR; keep this one isolated.
        TMPDIR: temporary,
      },
      encoding: 'utf8',
      timeout: 40_000,
    });
    expect(result.status).toBe(0);
    return readFileSync(marker, 'utf8');
  } finally {
    published.stop();
  }
}

describe('action hooks run the installed Safeword version', () => {
  it.each([
    ['1.2.3', 'installed 1.2.3'],
    ['9.0.0', 'published 1.2.3'],
  ])('with node_modules safeword %s the hook runs %s', (installedVersion, expected) => {
    expect(cliRunByHeal(installedVersion)).toBe(expected);
  });
});
