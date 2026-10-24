/* eslint-disable vitest/no-import-node-test -- This real human-output preflight never starts a test runner. */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import nodePath from 'node:path';
import { test } from 'node:test';

import { createObserverCandidate } from '../fixtures/bounded-observation.js';

void test(
  'human dirty-input refusal includes the fixed recovery command',
  { timeout: 120_000 },
  () => {
    const candidate = createObserverCandidate();
    try {
      appendFileSync(
        nodePath.join(candidate.root, 'packages/cli/vitest.base.ts'),
        '\n// Controlled dirty input.\n',
      );
      const result = spawnSync(
        'bun',
        [
          '--no-env-file',
          'packages/cli/src/cli.ts',
          'proof',
          'observe-bounded-delivery',
          '--no-input',
        ],
        { cwd: candidate.root, env: candidate.environment, encoding: 'utf8', timeout: 60_000 },
      );
      assert.equal(result.error, undefined, String(result.error));
      assert.equal(result.status, 2, result.stdout + result.stderr);
      const message = result.stdout + result.stderr;
      assert.match(message, /Execution-only/iu);
      assert.match(message, /Uncommitted input packages\/cli\/vitest\.base\.ts/u);
      assert.match(message, /commit or clean/iu);
      assert.ok(
        message.includes('safeword proof observe-bounded-delivery'),
        `Human refusal must name the fixed observation recovery command: ${message}`,
      );
    } finally {
      candidate.dispose();
    }
  },
);
