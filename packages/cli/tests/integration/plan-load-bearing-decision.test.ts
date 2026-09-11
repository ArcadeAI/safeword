import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

it('keeps every load-bearing decision in the focused review path', { timeout: 60_000 }, () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      './node_modules/.bin/cucumber-js',
      'features/approve-coherent-implementation-plans.feature',
      '--name',
      '^A load-bearing decision cannot disappear from the review path$',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  expect(
    result.status,
    `focused review did not reject the missing load-bearing decision\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  ).toBe(0);
  expect(result.stdout).toMatch(/1 scenario \(1 passed\)/);
});
