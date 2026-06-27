import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { stagedChangeAffectsArchitecture } from '../../templates/hooks/lib/architecture-staged-scope.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

// Wiring test: real git index → the scope gate the commit hook runs (#425, #363).
// Mocks nothing — the contract IS what `git diff --cached` / `git show` report.
describe('architecture staged-scope gate (#425)', () => {
  let directory: string;

  function git(...args: string[]): string {
    return execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  }

  function write(relative: string, content: string): void {
    const absolute = nodePath.join(directory, relative);
    mkdirSync(nodePath.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }

  function commitAll(message: string): void {
    git('add', '-A');
    git('commit', '-m', message);
  }

  beforeEach(() => {
    directory = createTemporaryDirectory();
    git('init');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    write('package.json', JSON.stringify({ name: 'fixture', version: '1.0.0' }, undefined, 2));
    write('src/auth/index.ts', 'export const auth = true;\n');
    commitAll('initial');
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  it('does not trigger on a version-only package.json bump', () => {
    write('package.json', JSON.stringify({ name: 'fixture', version: '1.1.0' }, undefined, 2));
    git('add', '--', 'package.json');

    expect(stagedChangeAffectsArchitecture(directory)).toBe(false);
  });

  it('triggers when a dependency is added to package.json', () => {
    write(
      'package.json',
      JSON.stringify(
        { name: 'fixture', version: '1.0.0', dependencies: { zod: '^3' } },
        undefined,
        2,
      ),
    );
    git('add', '--', 'package.json');

    expect(stagedChangeAffectsArchitecture(directory)).toBe(true);
  });

  it('triggers when a workspace glob changes', () => {
    write(
      'package.json',
      JSON.stringify(
        { name: 'fixture', version: '1.0.0', workspaces: ['packages/*'] },
        undefined,
        2,
      ),
    );
    git('add', '--', 'package.json');

    expect(stagedChangeAffectsArchitecture(directory)).toBe(true);
  });

  it('triggers when a src file is staged', () => {
    write('src/billing/index.ts', 'export const billing = true;\n');
    git('add', '--', 'src/billing/index.ts');

    expect(stagedChangeAffectsArchitecture(directory)).toBe(true);
  });

  it('triggers when a schema or boundary-config file is staged', () => {
    write('db/schema.sql', 'CREATE TABLE t (id int);\n');
    git('add', '--', 'db/schema.sql');

    expect(stagedChangeAffectsArchitecture(directory)).toBe(true);
  });

  it('does not trigger for an unrelated docs/config commit', () => {
    write('README.md', '# docs\n');
    write('.safeword/config.json', '{}\n');
    git('add', '--', 'README.md', '.safeword/config.json');

    expect(stagedChangeAffectsArchitecture(directory)).toBe(false);
  });

  it('does not trigger when nothing is staged', () => {
    expect(stagedChangeAffectsArchitecture(directory)).toBe(false);
  });

  it('does not trigger when only the generated doc is staged (no self-loop)', () => {
    write('.project/architecture.generated.md', '<!-- regenerated -->\n');
    git('add', '--', '.project/architecture.generated.md');

    expect(stagedChangeAffectsArchitecture(directory)).toBe(false);
  });
});
