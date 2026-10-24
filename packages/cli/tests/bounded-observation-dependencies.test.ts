import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { dependencyIdentity } from '../src/bounded-observation/identity.js';

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function candidate(installed = '1.0.0', declared = '1.0.0'): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'bounded-dependency-test-'));
  temporary.push(root);
  mkdirSync(nodePath.join(root, 'node_modules/foo'), { recursive: true });
  writeFileSync(nodePath.join(root, '.gitignore'), 'node_modules/\n');
  writeFileSync(
    nodePath.join(root, 'package.json'),
    JSON.stringify({
      name: 'bounded-fixture',
      version: '1.0.0',
      dependencies: { foo: declared },
    }),
  );
  writeFileSync(
    nodePath.join(root, 'bun.lock'),
    JSON.stringify({
      lockfileVersion: 1,
      configVersion: 1,
      workspaces: { '': { name: 'bounded-fixture', dependencies: { foo: '1.0.0' } } },
      packages: { foo: ['foo@1.0.0', '', {}, 'fixture-only-integrity'] },
    }),
  );
  writeFileSync(
    nodePath.join(root, 'node_modules/foo/package.json'),
    JSON.stringify({
      name: 'foo',
      version: installed,
    }),
  );
  writeFileSync(nodePath.join(root, 'node_modules/foo/index.js'), 'export const value = 1;\n');
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['add', '.gitignore', 'package.json', 'bun.lock'], { cwd: root });
  return root;
}

describe('bounded installed dependency prerequisites', () => {
  it('binds a compatible installed tree without running an installer', () => {
    expect(dependencyIdentity(candidate())['dependency:node_modules']).toMatch(/^[\da-f]{64}$/u);
  });

  it('refuses an installed version absent from the committed lock', () => {
    const root = candidate('2.0.0');
    expect(() => dependencyIdentity(root)).toThrow('Installed dependency foo@2.0.0');
  });

  it('refuses direct resolution to a version locked only for another dependency', () => {
    const root = candidate('2.0.0');
    const path = nodePath.join(root, 'bun.lock');
    const lock = JSON.parse(readFileSync(path, 'utf8')) as {
      packages: Record<string, unknown>;
    };
    lock.packages['other/foo'] = ['foo@2.0.0', '', {}, 'fixture-only-integrity'];
    writeFileSync(path, JSON.stringify(lock));
    expect(() => dependencyIdentity(root)).toThrow('Installed dependency foo resolves');
  });

  it('refuses a manifest that disagrees with its locked dependency declarations', () => {
    const root = candidate('1.0.0', '2.0.0');
    expect(() => dependencyIdentity(root)).toThrow('Manifest package.json disagrees with bun.lock');
  });

  it('refuses an undeclared installed package rather than silently binding it', () => {
    const root = candidate();
    mkdirSync(nodePath.join(root, 'node_modules/bar'));
    writeFileSync(
      nodePath.join(root, 'node_modules/bar/package.json'),
      JSON.stringify({ name: 'bar', version: '1.0.0' }),
    );
    expect(() => dependencyIdentity(root)).toThrow('Installed dependency bar@1.0.0');
  });

  it('refuses an unreadable lock format before execution', () => {
    const root = candidate();
    writeFileSync(nodePath.join(root, 'bun.lock'), '{truncated');
    expect(() => dependencyIdentity(root)).toThrow('Unsupported bun.lock');
  });

  it('still binds actual installed bytes under the same allowed version', () => {
    const root = candidate();
    const before = dependencyIdentity(root);
    const path = nodePath.join(root, 'node_modules/foo/index.js');
    writeFileSync(path, `${readFileSync(path, 'utf8')}export const changed = true;\n`);
    expect(dependencyIdentity(root)).not.toEqual(before);
  });
});
