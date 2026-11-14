import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

it('keeps impl-plan.md as the single feature design plan of record', { timeout: 65_000 }, () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      './node_modules/.bin/cucumber-js',
      'features/approve-coherent-implementation-plans.feature',
      '--name',
      '^One design plan remains the feature plan of record$',
    ],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 60_000 },
  );
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  expect(result.status, `single-plan-of-record review failed\n${output}`).toBe(0);
  expect(output).toMatch(/4 scenarios \(4 passed\)/);
});
