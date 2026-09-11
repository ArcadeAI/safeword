import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

it('blocks installed Implementation Plan review when its packaged contract is missing', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      './node_modules/.bin/cucumber-js',
      'features/approve-coherent-implementation-plans.feature',
      '--name',
      '^A missing packaged contract blocks installed review$',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  expect(
    result.status,
    `installed CLI must block authoring and approval when the packaged decision-quality contract is missing\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  ).toBe(0);
});
