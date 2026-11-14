import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { resolveTestPlan } from '../../src/test-plan/resolve';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

function makeDogfoodProject(failedBuild?: string): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-dogfood-bdd-'));
  directories.push(root);
  const manifest = JSON.parse(
    readFileSync(nodePath.resolve(import.meta.dirname, '../../../../package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  writeFileSync(nodePath.join(root, 'bun.lock'), '');
  writeFileSync(
    nodePath.join(root, 'package.json'),
    JSON.stringify({
      workspaces: ['packages/*'],
      scripts: {
        'pretest:bdd': manifest.scripts['pretest:bdd'],
        'test:bdd': manifest.scripts['test:bdd'],
      },
    }),
  );
  for (const name of ['cli', 'retro-relay']) {
    const directory = nodePath.join(root, 'packages', name);
    mkdirSync(directory, { recursive: true });
    const marker = (label: string) =>
      String.raw`node -e "require('node:fs').appendFileSync('../../executed', '${label}\n')"`;
    writeFileSync(
      nodePath.join(directory, 'package.json'),
      JSON.stringify({
        scripts: {
          build: marker(`${name} build`) + (failedBuild === name ? ' && exit 1' : ''),
          ...(name === 'cli' && { 'test:bdd': marker('bdd') }),
        },
      }),
    );
  }
  return root;
}

it('runs the dogfood BDD plan once after both required builds', () => {
  const root = makeDogfoodProject();
  const plan = resolveTestPlan(root, { kind: 'bdd', isToolAvailable: () => true });
  for (const entry of plan) execSync(entry.command, { cwd: entry.cwd, stdio: 'pipe' });

  expect(readFileSync(nodePath.join(root, 'executed'), 'utf8').trim().split('\n')).toEqual([
    'cli build',
    'retro-relay build',
    'bdd',
  ]);
  expect(plan.map(entry => entry.cwd)).toEqual([root]);
});

it.each(['cli', 'retro-relay'])('blocks BDD when the %s prerequisite build fails', failedBuild => {
  const root = makeDogfoodProject(failedBuild);
  const plan = resolveTestPlan(root, { kind: 'bdd', isToolAvailable: () => true });

  expect(() => {
    for (const entry of plan) execSync(entry.command, { cwd: entry.cwd, stdio: 'pipe' });
  }).toThrow();
  expect(readFileSync(nodePath.join(root, 'executed'), 'utf8').trim().split('\n')).toEqual(
    failedBuild === 'cli' ? ['cli build'] : ['cli build', 'retro-relay build'],
  );
});
