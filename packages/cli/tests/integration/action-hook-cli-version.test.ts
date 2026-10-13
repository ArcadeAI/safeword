/**
 * Ticket 8VG20K: an action hook outside a plugin runs exactly the installed
 * Safeword version — the project's own package only when it matches
 * `.safeword/version`, otherwise the pinned published package.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers';

const HEAL = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/session-architecture-heal.ts',
);

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) removeTemporaryDirectory(directory);
});

/** A project pinned to 1.2.3 whose node_modules carries `installedVersion`; returns which CLI ran. */
function cliRunByHeal(installedVersion: string): string {
  const project = createTemporaryDirectory();
  const bin = createTemporaryDirectory();
  directories.push(project, bin);
  const marker = nodePath.join(project, 'ran');
  writeTestFile(project, '.safeword/version', '1.2.3\n');
  writeTestFile(
    project,
    'node_modules/safeword/package.json',
    JSON.stringify({ name: 'safeword', version: installedVersion }),
  );
  writeTestFile(
    project,
    'node_modules/.bin/safeword',
    `#!/bin/sh\necho installed > ${JSON.stringify(marker)}\n`,
  );
  chmodSync(nodePath.join(project, 'node_modules/.bin/safeword'), 0o755);
  writeTestFile(bin, 'bunx', `#!/bin/sh\necho "bunx $1" > ${JSON.stringify(marker)}\n`);
  chmodSync(nodePath.join(bin, 'bunx'), 0o755);

  const result = spawnSync('bun', [HEAL], {
    cwd: project,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      CLAUDE_PLUGIN_ROOT: '',
      SAFEWORD_PLUGIN_CLI: '',
      PATH: `${bin}${nodePath.delimiter}${process.env.PATH ?? ''}`,
    },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  expect(result.status).toBe(0);
  return readFileSync(marker, 'utf8').trim();
}

describe('action hooks run the installed Safeword version', () => {
  it.each([
    ['1.2.3', 'installed'],
    ['9.0.0', 'bunx safeword@1.2.3'],
  ])('with node_modules safeword %s the hook runs %s', (installedVersion, expected) => {
    expect(cliRunByHeal(installedVersion)).toBe(expected);
  });
});
