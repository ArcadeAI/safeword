import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

it('blocks a persisted entity owner that contradicts its authority', { timeout: 65_000 }, () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      './node_modules/.bin/cucumber-js',
      'features/approve-coherent-implementation-plans.feature',
      '--name',
      '^Conflicting data ownership blocks approval$',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  expect(result.status, `data-ownership review failed\n${output}`).toBe(0);
  expect(output).toMatch(/1 scenario \(1 passed\)/);
});
