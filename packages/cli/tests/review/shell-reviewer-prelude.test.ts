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
])('returns the expected $label metadata', ({ args, output }) => {
  const executable = nodePath.join(installReviewer(), 'claude');
  const child = spawnSync(executable, args, { encoding: 'utf8', input: '' });
  expect(child.status, child.stderr).toBe(0);
  expect(child.stdout).toBe(output);
  expect(child.stderr).toBe('');
});

it.each(['first-dispatch', 'different-dispatch'])(
  'echoes the payload dispatch ID %s',
  dispatchId => {
    const executable = nodePath.join(installReviewer(), 'claude');
    const child = spawnSync(executable, [], {
      encoding: 'utf8',
      input: JSON.stringify({ kind: 'quality-review', dispatch_id: dispatchId }),
      env: {
        ...process.env,
        SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: '',
        SAFEWORD_REVIEW_FAKE_VERDICT: '',
        SAFEWORD_REVIEW_FAKE_FINDING: '',
      },
      timeout: 5000,
    });
    expect(child.status, child.stderr).toBe(0);
    expect(child.stderr).toBe('');
    expect(JSON.parse(child.stdout)).toEqual({
      schema_version: 1,
      dispatch_id: dispatchId,
      reviewer_agent: 'claude',
      verdict: 'approve',
      summary: 'approved',
      findings: [],
    });
  },
);
