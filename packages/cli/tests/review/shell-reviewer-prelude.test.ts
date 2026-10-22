import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { installReviewer } from '../fixtures/delivery-cli.js';
import { cleanupTrustedReviewerDirectories, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

afterEach(cleanupTrustedReviewerDirectories);

it.each([
  { label: 'version', args: ['--version'], output: 'claude 1.0.0\n' },
  { label: 'help', args: ['--help'], output: `${REVIEWER_CAPABILITIES.claude}\n` },
  {
    label: 'help following model options',
    args: ['--model', 'fixture-model', '--help'],
    output: `${REVIEWER_CAPABILITIES.claude}\n`,
  },
])('answers the $label probe before reading reviewer input', ({ args, output }) => {
  const executable = nodePath.join(installReviewer(), 'claude');
  const child = spawnSync(executable, args, { encoding: 'utf8', input: '' });
  expect(child.status, child.stderr).toBe(0);
  expect(child.stdout).toBe(output);
  expect(child.stderr).toBe('');
});
