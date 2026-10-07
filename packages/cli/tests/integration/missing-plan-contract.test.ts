import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

it(
  'blocks installed Implementation Plan review when its packaged contract is missing',
  { timeout: 60_000 },
  () => {
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
      `installed CLI did not name the generate:plan-rubric recovery for its missing packaged decision-quality contract\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    ).toBe(0);
    expect(result.stdout).toMatch(/1 scenario \(1 passed\)/);
  },
);
